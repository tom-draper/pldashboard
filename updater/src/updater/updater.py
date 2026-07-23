import asyncio
import logging
from datetime import datetime
from typing import Optional

import aiohttp

from updater.data import Data
from updater.data.build_graph import Stage, resolve_order
from updater.data.raw_data import RawData
from updater.data_source import DataSource
from updater.database import Database
from updater.env import require_env_int
from updater.predictions.model_predictions import build_model_predictions
from updater.timing import timed


class Updater:
    def __init__(self):
        self.current_season = require_env_int("SEASON")

        self.data = Data()  # To build
        self._database: Optional[Database] = None

        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 6

        # Fetches new data or reads the local backups, and writes backups.
        self.data_source = DataSource(self.current_season)
        # Populated by build_all before the DataFrames are built.
        self.raw_data = RawData()

    @property
    def database(self):
        """Database connection, created on first use.

        Building from local backups needs no database, so the credentials are
        only required when data is actually uploaded.
        """
        if self._database is None:
            self._database = Database()
        return self._database

    def build_stages(self, num_seasons: int, display_tables: bool = False):
        """Declare each DataFrame build and what it depends on.

        The execution order is derived from these declarations, so adding a
        stage or changing a dependency does not require reordering anything.
        """
        teams = self.data.teams
        return [
            # Standings for the last [num_seasons] seasons
            Stage(
                "standings",
                lambda: teams.standings.build(
                    self.raw_data, self.current_season, num_seasons,
                    display=display_tables,
                ),
            ),
            # Fixtures for the whole season for each team
            Stage(
                "fixtures",
                lambda: teams.fixtures.build(
                    self.raw_data, self.current_season, display=display_tables
                ),
            ),
            # Ratings for each team, based on the last [num_seasons] standings
            Stage(
                "team_ratings",
                lambda: teams.team_ratings.build(
                    teams.standings, self.current_season, self.games_threshold,
                    num_seasons, display=display_tables,
                ),
                depends_on=("standings",),
            ),
            # The personalised advantage each team has at home
            Stage(
                "home_advantages",
                lambda: teams.home_advantages.build(
                    self.raw_data, self.current_season,
                    self.home_games_threshold, num_seasons,
                    display=display_tables,
                ),
            ),
            # Form values for each team for each matchday played so far
            Stage(
                "form",
                lambda: teams.form.build(
                    self.raw_data, teams.team_ratings, self.current_season,
                    display=display_tables,
                ),
                depends_on=("team_ratings",),
            ),
            # Data about the opponent in each team's next game
            Stage(
                "upcoming",
                lambda: teams.upcoming.build(
                    self.raw_data, teams.fixtures, teams.form,
                    teams.team_ratings, teams.home_advantages,
                    self.current_season, num_seasons, display=display_tables,
                ),
                depends_on=("fixtures", "form", "team_ratings", "home_advantages"),
            ),
            Stage("fantasy", lambda: self.data.fantasy.data.build(self.raw_data)),
        ]

    def build_dataframes(self, num_seasons: int, display_tables: bool = False):
        """Builds all DataFrames within `self.data` using the raw data.

        Args:
            num_seasons (int): The number of Premier League seasons to consider.
            display_tables (bool, optional): Print DataFrames once built. Defaults to False.
        """
        for stage in resolve_order(self.build_stages(num_seasons, display_tables)):
            logging.debug(f"Building {stage.name}...")
            stage.build()

    def save_team_data_to_db(self):
        team_data = self.data.teams.to_dict()
        self.database.update_team_data(team_data, self.current_season)

    def save_fantasy_data_to_db(self):
        fantasy_data = self.data.fantasy.to_dict()
        self.database.update_fantasy_data(fantasy_data)

    def save_form_predictions_to_db(self):
        predictions = self.data.teams.upcoming.get_predictions()
        actual_scores = self.data.teams.fixtures.get_actual_scores()
        self.database.update_form_predictions(predictions, actual_scores)
        self.database.update_actual_scores(actual_scores)

    def save_model_predictions_to_db(self, num_seasons: int):
        predictions = build_model_predictions(
            self.raw_data, self.current_season, num_seasons
        )
        actual_scores = self.data.teams.fixtures.get_actual_scores()
        self.database.update_model_predictions(predictions, actual_scores)

    @timed
    def build_all(
        self,
        num_seasons: int = 4,
        display_tables: bool = False,
        request_new: bool = True,
        update_db: bool = True,
    ):
        """Requests any current-season data from football data APIs, and loads
        and previous data from local store. Uses this data to builds all
        DataFrames in `self.data`. Finally, saves all data to local store backup
        and database.

        Args:
            num_seasons (int, optional): Number of Premier League seasons to
                consider including the current season. Defaults to 4.
            display_tables (bool, optional): Print DataFrames once built.
                Defaults to False.
            request_new (bool, optional): Request new data from football data
                APIs, otherwise use local backup. Defaults to True.
            update_db (bool, optional): Upload build data to the hosted
                database. Defaults to True.
        """
        try:
            self.raw_data = self.data_source.build_raw_data(num_seasons, request_new)
        except (aiohttp.ClientError, asyncio.TimeoutError, KeyError, ValueError) as e:
            # A failed fetch must not abort the run: fall back to the last known
            # good backup, and skip the save/upload steps so the backup and
            # database are not overwritten with stale data.
            logging.error(f"❌ Failed to fetch new data: {e}")
            logging.info("🔁 Retrying with local backup data...")
            request_new = False
            self.raw_data = self.data_source.build_raw_data(num_seasons, request_new)

        if request_new:
            # Data came fresh from the API; stamp when so the dashboard can show
            # it. Backup builds leave this unset to signal the data is stale.
            self.data.teams.last_updated = datetime.now()

        self.build_dataframes(num_seasons, display_tables)

        if request_new:
            logging.info("💾 Saving new team data to local backup...")
            self.data_source.save_local_backup(self.raw_data)
            if update_db:
                logging.info("💾 Saving new team data to database...")
                self.save_team_data_to_db()
                logging.info("💾 Saving new fantasy data to database...")
                self.save_fantasy_data_to_db()
                logging.info("💾 Saving predictions to database...")
                self.save_form_predictions_to_db()
                logging.info("💾 Saving v3 predictions to database...")
                self.save_model_predictions_to_db(num_seasons)

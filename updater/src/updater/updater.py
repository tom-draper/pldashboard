import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

import aiohttp
from updater.data import Data
from updater.data.build_graph import Stage, resolve_order
from updater.data.raw_data import RawData
from updater.database import Database
from updater.env import BACKUPS_DIR, require_env, require_env_int
from timebudget import timebudget


class Updater:
    def __init__(self):
        self.current_season = require_env_int("SEASON")

        self.data = Data()  # To build
        self._database: Optional[Database] = None

        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 6

        # Store for new requested API data or old data from local storage
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

    @property
    def url(self):
        return require_env("URL")

    @property
    def headers(self):
        return {"X-Auth-Token": require_env("X_AUTH_TOKEN")}

    # ----------------------------- DATA API -----------------------------------
    @staticmethod
    async def get(
        session: aiohttp.ClientSession, url: str, headers: Optional[dict] = None
    ):
        """Fetch data from url.

        Args:
            session (aiohttp.ClientSession): Session shared across all requests.
            url (str): URL to send GET request.
            headers (dict, optional): Headers to include in request. Defaults
                to None.

        Raises:
            aiohttp.ClientResponseError: Request returned a non-200 status.

        Returns:
            dict: JSON data from response.
        """
        logging.debug(f"🌐 Requesting {url}...")
        async with session.get(url, headers=headers) as response:
            if response.status != 200:
                logging.error(f"❌ Status: {response.status} [{url}]")
                raise aiohttp.ClientResponseError(
                    response.request_info,
                    response.history,
                    status=response.status,
                    message=f"Data request to {url} failed",
                )

            logging.debug(f"✅ Status: {response.status} [{url}]")
            data: dict = await response.json()
            logging.debug(f"Received data from {url}")
            return data

    async def fetch_fixtures_data(self, session: aiohttp.ClientSession, season: int):
        data: dict = await self.get(
            session,
            f"{self.url}v4/competitions/PL/matches/?season={season}",
            headers=self.headers,
        )
        return data["matches"]

    @staticmethod
    def _load_backup(category: str, filename: str):
        path = BACKUPS_DIR / category / filename
        with open(path, "r") as json_file:
            return json.load(json_file)

    def load_fixtures_data(self, season: int):
        logging.debug(f"💾 Loading fixtures data for season {season}...")
        return self._load_backup("fixtures", f"fixtures_{season}.json")

    async def fetch_standings_data(self, session: aiohttp.ClientSession, season: int):
        data: dict = await self.get(
            session,
            f"{self.url}v4/competitions/PL/standings/?season={season}",
            headers=self.headers,
        )
        return data["standings"][0]["table"]

    def load_standings_data(self, season: int):
        logging.debug(f"💾 Loading standings data for season {season}...")
        return self._load_backup("standings", f"standings_{season}.json")

    async def fetch_fantasy_general_data(self, session: aiohttp.ClientSession):
        data: dict = await self.get(
            session, "https://fantasy.premierleague.com/api/bootstrap-static/"
        )
        return data

    def load_fantasy_general_data(self, season: int):
        logging.debug(f"💾 Loading fantasy data for season {season}...")
        return self._load_backup("fantasy", f"general_{season}.json")

    async def fetch_fantasy_fixtures_data(self, session: aiohttp.ClientSession):
        data: dict = await self.get(
            session, "https://fantasy.premierleague.com/api/fixtures/"
        )
        return data

    def load_fantasy_fixtures_data(self, season: int):
        logging.debug(f"💾 Loading fantasy fixtures data for season {season}...")
        return self._load_backup("fantasy", f"fixtures_{season}.json")

    async def fetch_current_season(self):
        """Fetch teams data and fantasy data from football data API and stores
        the results in `self.raw_data`.
        """
        async with aiohttp.ClientSession() as session:
            data = await asyncio.gather(
                self.fetch_fixtures_data(session, self.current_season),
                self.fetch_standings_data(session, self.current_season),
                self.fetch_fantasy_general_data(session),
                self.fetch_fantasy_fixtures_data(session),
            )
        # Fetch data from API (max this season and last season)
        self.raw_data.fixtures[self.current_season] = data[0]
        self.raw_data.standings[self.current_season] = data[1]
        self.raw_data.fantasy_general = data[2]
        self.raw_data.fantasy_fixtures = data[3]
        self.data.teams.last_updated = datetime.now()

    def load_current_season(self):
        """Load teams data and fantasy data for the current Premier League
        season from local store.
        """
        # Fetch data from API (max this season and last season)
        self.raw_data.fixtures[self.current_season] = self.load_fixtures_data(
            self.current_season
        )
        self.raw_data.standings[self.current_season] = self.load_standings_data(
            self.current_season
        )
        self.raw_data.fantasy_general = self.load_fantasy_general_data(
            self.current_season
        )
        self.raw_data.fantasy_fixtures = self.load_fantasy_fixtures_data(
            self.current_season
        )

    def load_previous_seasons(self, num_seasons: int):
        for i in range(1, num_seasons):
            season = self.current_season - i
            self.raw_data.fixtures[season] = self.load_fixtures_data(season)
            self.raw_data.standings[season] = self.load_standings_data(season)

    def set_raw_data(self, num_seasons: int, request_new: bool = True):
        """Sets the raw data object with data from the football data API or
        local store.

        Args:
            num_seasons (int): Number of seasons to set.
            request_new (bool, optional): Request new data from API, otherwise
                load from local store. Defaults to True.
        """
        if request_new:
            asyncio.run(self.fetch_current_season())
        else:
            self.load_current_season()

        self.load_previous_seasons(num_seasons)

    def save_local_backup(self):
        """Save current season fixtures and standings data in `self.raw_data` to
        local store.
        """
        backups = {
            BACKUPS_DIR / "fixtures" / f"fixtures_{self.current_season}.json":
                self.raw_data.fixtures[self.current_season],
            BACKUPS_DIR / "standings" / f"standings_{self.current_season}.json":
                self.raw_data.standings[self.current_season],
            BACKUPS_DIR / "fantasy" / f"general_{self.current_season}.json":
                self.raw_data.fantasy_general,
            BACKUPS_DIR / "fantasy" / f"fixtures_{self.current_season}.json":
                self.raw_data.fantasy_fixtures,
        }
        for path, payload in backups.items():
            with open(path, "w") as f:
                json.dump(payload, f)

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

    def save_predictions_to_db(self):
        predictions = self.data.teams.upcoming.get_predictions()
        actual_scores = self.data.teams.fixtures.get_actual_scores()
        self.database.update_predictions(predictions, actual_scores)
        self.database.update_actual_scores(actual_scores)

    @timebudget
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
            self.set_raw_data(num_seasons, request_new)
        except (aiohttp.ClientError, asyncio.TimeoutError, KeyError, ValueError) as e:
            # A failed fetch must not abort the run: fall back to the last known
            # good backup, and skip the save/upload steps so the backup and
            # database are not overwritten with stale data.
            logging.error(f"❌ Failed to fetch new data: {e}")
            logging.info("🔁 Retrying with local backup data...")
            request_new = False
            self.set_raw_data(num_seasons, request_new)

        self.build_dataframes(num_seasons, display_tables)

        if request_new:
            logging.info("💾 Saving new team data to local backup...")
            self.save_local_backup()
            if update_db:
                logging.info("💾 Saving new team data to database...")
                self.save_team_data_to_db()
                logging.info("💾 Saving new fantasy data to database...")
                self.save_fantasy_data_to_db()
                logging.info("💾 Saving predictions to database...")
                self.save_predictions_to_db()

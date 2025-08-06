import asyncio
import json
import logging
from datetime import datetime
from os import getenv
from os.path import dirname, join
from typing import Optional

import aiohttp
from data import Data
from database import Database
from dotenv import load_dotenv
from fmt import clean_full_team_name
from timebudget import timebudget


class Updater:
    def __init__(self):
        # Import environment variables
        __file__ = "updater.py"
        dotenv_path = join(dirname(__file__), ".env")
        load_dotenv(dotenv_path)

        self.url = getenv("URL")
        self.current_season = int(getenv("SEASON"))
        self.headers = {"X-Auth-Token": getenv("X_AUTH_TOKEN")}
        
        self.data = Data()  # To build
        self.database = Database()

        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 6

        # Store for new requested API data or old data from local storage
        self.raw_data = {
            "fixtures": {},
            "standings": {},
            "fantasy": {"general": {}, "fixtures": {}},
        }


    # ----------------------------- DATA API -----------------------------------
    @staticmethod
    async def get(url: str, headers: Optional[dict] = None):
        """Fetch data from url.

        Args:
            url (str): URL to send GET request.
            headers (dict, optional): Headers to include in request. Defaults
                to None.

        Raises:
            ValueError: Request failed.

        Returns:
            dict: JSON data from response.
        """
        async with aiohttp.ClientSession() as session:
            logging.debug(f"🌐 Requesting {url}...")
            response = await session.request("GET", url=url, headers=headers)

            if response.status != 200:
                logging.error(f"❌ Status: {response.status} [{url}]")
                raise aiohttp.ClientConnectionError(
                    f"Data request to {url} failed with status {response.status}"
                )
            else:
                logging.debug(f"✅ Status: {response.status} [{url}]")

            data: dict = await response.json()
            logging.debug(f"Received data from {url}")
            return data

    async def fetch_fixtures_data(self, season: int):
        data: dict = await self.get(
            f"{self.url}v4/competitions/PL/matches/?season={season}",
            headers=self.headers,
        )
        return data["matches"]

    def load_fixtures_data(self, season: int):
        logging.debug(f"💾 Loading fixtures data for season {season}...")
        with open(f"backups/fixtures/fixtures_{season}.json", "r") as json_file:
            return json.load(json_file)

    async def fetch_standings_data(self, season: int):
        data: dict = await self.get(
            f"{self.url}v4/competitions/PL/standings/?season={season}",
            headers=self.headers,
        )
        return data["standings"][0]["table"]

    def load_standings_data(self, season: int):
        logging.debug(f"💾 Loading standings data for season {season}...")
        with open(f"backups/standings/standings_{season}.json", "r") as json_file:
            return json.load(json_file)

    async def fetch_fantasy_general_data(self):
        data: dict = await self.get(
            "https://fantasy.premierleague.com/api/bootstrap-static/"
        )
        return data

    def load_fantasy_general_data(self, season: int):
        logging.debug(f"💾 Loading fantasy data for season {season}...")
        with open(f"backups/fantasy/general_{season}.json", "r") as json_file:
            return json.load(json_file)

    async def fetch_fantasy_fixtures_data(self):
        data: dict = await self.get("https://fantasy.premierleague.com/api/fixtures/")
        return data

    def load_fantasy_fixtures_data(self, season: int):
        logging.debug(f"💾 Loading fantasy fixtures data for season {season}...")
        with open(f"backups/fantasy/fixtures_{season}.json", "r") as json_file:
            return json.load(json_file)

    async def fetch_current_season(self):
        """Fetch teams data and fantasy data from football data API and stores
        the results in `self.raw_data`.
        """
        data = await asyncio.gather(
            *[
                self.fetch_fixtures_data(self.current_season),
                self.fetch_standings_data(self.current_season),
                self.fetch_fantasy_general_data(),
                self.fetch_fantasy_fixtures_data(),
            ]
        )
        # Fetch data from API (max this season and last season)
        self.raw_data["fixtures"][self.current_season] = data[0]
        self.raw_data["standings"][self.current_season] = data[1]
        self.raw_data["fantasy"]["general"] = data[2]
        self.raw_data["fantasy"]["fixtures"] = data[3]
        self.data.teams.last_updated = datetime.now()

    def load_current_season(self):
        """Load teams data and fantasy data for the current Premier League
        season from local store.
        """
        # Fetch data from API (max this season and last season)
        self.raw_data["fixtures"][self.current_season] = self.load_fixtures_data(
            self.current_season
        )
        self.raw_data["standings"][self.current_season] = self.load_standings_data(
            self.current_season
        )
        self.raw_data["fantasy"]["general"] = self.load_fantasy_general_data(
            self.current_season
        )
        self.raw_data["fantasy"]["fixtures"] = self.load_fantasy_fixtures_data(
            self.current_season
        )

    def load_previous_seasons(self, num_seasons: int):
        for i in range(1, num_seasons):
            season = self.current_season - i
            self.raw_data["fixtures"][season] = self.load_fixtures_data(season)
            self.raw_data["standings"][season] = self.load_standings_data(season)

    def set_raw_data(self, num_seasons: int, request_new: bool = True):
        """Sets the raw data object with data from the football data API or
        local store.

        Args:
            num_seasons (int): Number of seasons to set.
            request_new (bool, optional): Request new data from API, otherwise
                load from local store. Defaults to True.
        """
        if request_new:
            loop = asyncio.get_event_loop()
            loop.run_until_complete(self.fetch_current_season())
        else:
            self.load_current_season()

        self.load_previous_seasons(num_seasons)

    def save_local_backup(self):
        """Save current season fixtures and standings data in `self.raw_data` to
        local store.
        """
        for type in ("fixtures", "standings"):
            with open(f"backups/{type}/{type}_{self.current_season}.json", "w") as f:
                json.dump(self.raw_data[type][self.current_season], f)

        for type in ("general", "fixtures"):
            with open(f"backups/fantasy/{type}_{self.current_season}.json", "w") as f:
                json.dump(self.raw_data["fantasy"][type], f)

    def build_dataframes(self, num_seasons: int, display_tables: bool = False):
        """Builds all DataFrames within `self.data` using the raw data.

        Args:
            num_seasons (int): The number of Premier League seasons to consider.
            display_tables (bool, optional): Print DataFrames once built. Defaults to False.
        """
        # Standings for the last [num_seasons] seasons
        self.data.teams.standings.build(
            self.raw_data, self.current_season, num_seasons, display=display_tables
        )
        # Fixtures for the whole season for each team
        self.data.teams.fixtures.build(
            self.raw_data, self.current_season, display=display_tables
        )
        # Ratings for each team, based on last <no_seasons> seasons standings table
        self.data.teams.team_ratings.build(
            self.data.teams.standings,
            self.current_season,
            self.games_threshold,
            num_seasons,
            display=display_tables,
        )
        # Calculated values to represent the personalised advantage each team has at home
        self.data.teams.home_advantages.build(
            self.raw_data,
            self.current_season,
            self.home_games_threshold,
            num_seasons,
            display=display_tables,
        )
        # Calculated form values for each team for each matchday played so far
        self.data.teams.form.build(
            self.raw_data,
            self.data.teams.team_ratings,
            self.current_season,
            display=display_tables,
        )
        # Data about the opponent in each team's next game
        self.data.teams.upcoming.build(
            self.raw_data,
            self.data.teams.fixtures,
            self.data.teams.form,
            self.data.teams.team_ratings,
            self.data.teams.home_advantages,
            self.current_season,
            num_seasons,
            display=display_tables,
        )
        self.data.fantasy.data.build(self.raw_data)

    def save_team_data_to_db(self):
        team_data = self.data.teams.to_dict()
        self.database.update_team_data(team_data, self.current_season)

    def save_fantasy_data_to_db(self):
        fantasy_data = self.data.fantasy.to_dict()
        self.database.update_fantasy_data(fantasy_data)

    def save_predictions_to_db(self):
        predictions = self.data.teams.upcoming.get_predictions()
        actual_scores = self.data.teams.fixtures.get_actual_scores_new()
        self.database.update_predictions(predictions, actual_scores)
        self.database.update_actual_scores(actual_scores)

    def get_logo_urls(self):
        data: dict = self.raw_data["standings"][self.current_season]

        logo_urls: dict[str, str] = {}
        for standings_row in data:
            team = clean_full_team_name(standings_row["team"]["name"])
            crest_url = standings_row["team"]["crestUrl"]
            logo_urls[team] = crest_url

        return logo_urls

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
        except ValueError as e:
            logging.error(e)
            logging.info("🔁 Retrying with local backup data...")
            self.set_raw_data(num_seasons, request_new := False)

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

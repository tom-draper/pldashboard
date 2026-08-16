"""Where the raw season data comes from.

`DataSource` is the boundary between the outside world and the build: it either
fetches fresh data from the football-data and Fantasy Premier League APIs, or
loads the last-known-good copy from the on-disk backups, and it writes fresh
backups. Keeping this separate from `Updater` means the build orchestration is
not entangled with HTTP and file I/O.
"""

import asyncio
import json
import logging
from typing import Optional

import aiohttp

from updater.data.raw_data import RawData
from updater.env import BACKUPS_DIR, require_env


class DataSource:
    def __init__(self, current_season: int):
        self.current_season = current_season

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

    async def fetch_standings_data(self, session: aiohttp.ClientSession, season: int):
        data: dict = await self.get(
            session,
            f"{self.url}v4/competitions/PL/standings/?season={season}",
            headers=self.headers,
        )
        return data["standings"][0]["table"]

    async def fetch_fantasy_general_data(self, session: aiohttp.ClientSession):
        data: dict = await self.get(
            session, "https://fantasy.premierleague.com/api/bootstrap-static/"
        )
        return data

    async def fetch_fantasy_fixtures_data(self, session: aiohttp.ClientSession):
        data: dict = await self.get(
            session, "https://fantasy.premierleague.com/api/fixtures/"
        )
        return data

    async def fetch_current_season(self, raw_data: RawData):
        """Fetch teams data and fantasy data from the football data API and
        store the results in `raw_data`.
        """
        async with aiohttp.ClientSession() as session:
            data = await asyncio.gather(
                self.fetch_fixtures_data(session, self.current_season),
                self.fetch_standings_data(session, self.current_season),
                self.fetch_fantasy_general_data(session),
                self.fetch_fantasy_fixtures_data(session),
            )
        raw_data.fixtures[self.current_season] = data[0]
        raw_data.standings[self.current_season] = data[1]
        raw_data.fantasy_general = data[2]
        raw_data.fantasy_fixtures = data[3]

    # --------------------------- LOCAL BACKUPS --------------------------------
    @staticmethod
    def _load_backup(category: str, filename: str):
        path = BACKUPS_DIR / category / filename
        with open(path, "r") as json_file:
            return json.load(json_file)

    def load_fixtures_data(self, season: int):
        logging.debug(f"💾 Loading fixtures data for season {season}...")
        return self._load_backup("fixtures", f"fixtures_{season}.json")

    def load_standings_data(self, season: int):
        logging.debug(f"💾 Loading standings data for season {season}...")
        return self._load_backup("standings", f"standings_{season}.json")

    def load_fantasy_general_data(self, season: int):
        logging.debug(f"💾 Loading fantasy data for season {season}...")
        return self._load_backup("fantasy", f"general_{season}.json")

    def load_fantasy_fixtures_data(self, season: int):
        logging.debug(f"💾 Loading fantasy fixtures data for season {season}...")
        return self._load_backup("fantasy", f"fixtures_{season}.json")

    def load_current_season(self, raw_data: RawData):
        """Load teams data and fantasy data for the current Premier League
        season from local store into `raw_data`.
        """
        raw_data.fixtures[self.current_season] = self.load_fixtures_data(
            self.current_season
        )
        raw_data.standings[self.current_season] = self.load_standings_data(
            self.current_season
        )
        raw_data.fantasy_general = self.load_fantasy_general_data(self.current_season)
        raw_data.fantasy_fixtures = self.load_fantasy_fixtures_data(self.current_season)

    def load_previous_seasons(self, raw_data: RawData, num_seasons: int):
        for i in range(1, num_seasons):
            season = self.current_season - i
            raw_data.fixtures[season] = self.load_fixtures_data(season)
            raw_data.standings[season] = self.load_standings_data(season)

    def build_raw_data(self, num_seasons: int, request_new: bool = True) -> RawData:
        """Assemble a fresh `RawData` from the API or from local backups.

        A new object is returned each call so a partly-populated result from a
        failed fetch can never leak into a subsequent retry.

        Args:
            num_seasons (int): Number of seasons to include.
            request_new (bool, optional): Request new data from the API,
                otherwise load from local store. Defaults to True.
        """
        raw_data = RawData()
        if request_new:
            asyncio.run(self.fetch_current_season(raw_data))
        else:
            self.load_current_season(raw_data)

        self.load_previous_seasons(raw_data, num_seasons)
        return raw_data

    def save_local_backup(self, raw_data: RawData):
        """Save current season fixtures and standings data in `raw_data` to
        local store.
        """
        backups = {
            BACKUPS_DIR / "fixtures" / f"fixtures_{self.current_season}.json":
                raw_data.fixtures[self.current_season],
            BACKUPS_DIR / "standings" / f"standings_{self.current_season}.json":
                raw_data.standings[self.current_season],
            BACKUPS_DIR / "fantasy" / f"general_{self.current_season}.json":
                raw_data.fantasy_general,
            BACKUPS_DIR / "fantasy" / f"fixtures_{self.current_season}.json":
                raw_data.fantasy_fixtures,
        }
        for path, payload in backups.items():
            with open(path, "w") as f:
                json.dump(payload, f)

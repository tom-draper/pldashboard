import logging
from typing import Optional

import pandas as pd
from pandas import DataFrame

from updater.data.dataframes.df import DF
from updater.data.raw_data import RawData
from updater.fmt import clean_full_team_name
from updater.timing import timed


class Standings(DF):
    """Class for managing and building football league standings across multiple seasons."""

    # Column mappings for better maintainability
    STANDINGS_COLUMNS = [
        "position",
        "played",
        "won",
        "drawn",
        "lost",
        "points",
        "gF",  # goals for
        "gA",  # goals against
        "gD",  # goal difference
    ]

    COLUMNS_TO_DROP = ["form", "team"]

    def __init__(self, d: Optional[DataFrame] = None):
        super().__init__(d, "standings")

    @staticmethod
    def extract_team_names(raw_data: RawData, season: int) -> list[str]:
        """
        Extract and clean team names from standings data for a given season.

        Args:
            raw_data: The complete JSON data structure
            season: The season year to extract teams from

        Returns:
            List of cleaned team names
        """
        try:
            standings_data = raw_data.standings[season]
            teams = [clean_full_team_name(row["team"]["name"]) for row in standings_data]
            return teams
        except (KeyError, TypeError) as e:
            raise ValueError(
                f"Unable to extract team names for season {season}: {e}"
            ) from e

    def _build_season_standings(self, raw_data: RawData, current_teams: list[str], season: int) -> DataFrame:
        """
        Build standings DataFrame for a single season.

        Args:
            raw_data: The complete JSON data structure
            current_teams: List of current season team names to filter by
            season: The season year to process

        Returns:
            DataFrame with standings data for the specified season
        """
        try:
            standings_data = raw_data.standings[season]
        except KeyError as e:
            raise ValueError(f"Standings data not found for season {season}") from e

        # Convert to DataFrame
        df = pd.DataFrame.from_dict(standings_data)

        # Get team names and set as index
        team_names = self.extract_team_names(raw_data, season)
        df = df.drop(columns=self.COLUMNS_TO_DROP, errors='ignore')
        df.index = team_names

        # Create multi-level column headers with season
        df.columns = pd.MultiIndex.from_product([[season], self.STANDINGS_COLUMNS])

        # Filter to only include teams that are in the current season
        df = df.loc[df.index.intersection(current_teams)]

        return df

    def _log_season_coverage(self, df: DataFrame, season: int) -> None:
        """Record how many of the current season's teams this season covers.

        Fewer than 20 is the normal case for a past season, not a fault: the
        table is filtered to teams in the current season, and a side promoted
        since has no row in the season before it came up. It is logged at debug
        because it is occasionally useful when reconciling team counts, and
        never actionable on its own.
        """
        LEAGUE_SIZE = 20
        covered = len(df)
        if covered < LEAGUE_SIZE:
            logging.debug(
                f"Season {season} covers {covered} of the {LEAGUE_SIZE} current "
                f"teams; the other {LEAGUE_SIZE - covered} were not in this "
                "division that season."
            )

    def _clean_final_dataframe(self, df: DataFrame) -> DataFrame:
        """
        Apply final cleaning and formatting to the combined standings DataFrame.

        Args:
            df: The raw combined standings DataFrame

        Returns:
            Cleaned and formatted DataFrame
        """
        # Fill missing values and convert to integers
        df = df.fillna(0).astype(int)

        # Set proper names for index and columns
        df.index.name = "team"
        df.columns.names = ("Season", None)

        # Sort by current season position (first season in the data)
        if not df.empty:
            current_season = df.columns.get_level_values(0)[0]
            if (current_season, "position") in df.columns:
                df = df.sort_values(by=(current_season, "position"))

        return df

    def _combine_season_standings(self, raw_data: RawData,
                                current_teams: list[str],
                                season: int,
                                num_seasons: int) -> DataFrame:
        """
        Combine standings data from multiple seasons into a single DataFrame.

        Args:
            raw_data: The complete JSON data structure
            current_teams: List of current season team names
            season: The current season year
            num_seasons: Number of seasons to include

        Returns:
            Combined standings DataFrame
        """
        combined_standings = pd.DataFrame()

        # Process seasons from current to oldest
        for i in range(num_seasons):
            season_year = season - i
            try:
                season_df = self._build_season_standings(raw_data, current_teams, season_year)
                self._log_season_coverage(season_df, season_year)
                combined_standings = pd.concat([combined_standings, season_df], axis=1)
            except ValueError as e:
                logging.warning(f"Skipping season {season_year}: {e}")
                continue

        return combined_standings

    @timed
    def build(
        self, raw_data: RawData, season: int, num_seasons: int = 3, display: bool = False
    ):
        """ Assigns self.df to a DataFrame containing all table standings for
            each season from current season to season [num_seasons] years ago.

            Rows: the 20 teams participating in the current season, ordered ascending
                by the team's position in the current season
            Columns (multi-index):
            -----------------------------------------------------------------
            |                         [SEASON YEAR]                         |
            |---------------------------------------------------------------|
            | position | played | won | draw | lost | gF | gA | gD | points |

            [SEASON YEAR]: 4-digit year values that a season began, from current
                season to season num_seasons ago
            position: unique integer from 1 to 20 depending on the table position
                the team holds in the season
            played: the number of games the team has played in the season.
            won: the number of games the team has won in the season.
            drawn: the number of games the team has drawn in the season.
            lost: the number of games the team has lost in the season.
            gF: goals for - the number of goals the team has scored in this season.
            gA: goals against - the number of games the team has lost in the season.
            gD: the number of games the team has lost in the season.
            points: the points acquired by the team.

        Args:
            raw_data dict: the json data storage used to build the DataFrame.
            season: the year of the current season.
            num_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        # Extract current season teams
        try:
            current_teams = self.extract_team_names(raw_data, season)
        except ValueError as e:
            raise ValueError(f"Cannot build standings: {e}") from e

        if not current_teams:
            raise ValueError(f"No teams found for current season {season}")

        # Combine standings from multiple seasons
        df = self._combine_season_standings(raw_data, current_teams, season, num_seasons)

        if df.empty:
            raise ValueError("No valid standings data found for any season")

        # Apply final cleaning and formatting
        df = self._clean_final_dataframe(df)

        if display:
            print(df)

        self.df = df

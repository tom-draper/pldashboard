import logging

import pandas as pd
from pandas import DataFrame
from typing import Any

from updater.fmt import clean_full_team_name
from timebudget import timebudget

from updater.data.dataframes.df import DF


class Standings(DF):
    """Class for managing and building football league standings across multiple seasons."""

    STANDINGS_COLUMNS = [
        "position",
        "played",
        "won",
        "drawn",
        "lost",
        "points",
        "gF",
        "gA",
        "gD",
    ]

    COLUMNS_TO_DROP = ["form", "team"]

    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "standings")

    @staticmethod
    def _extract_team_names(json_data: dict[str, Any], season: int) -> list[str]:
        try:
            standings_data = json_data["standings"][season]
            return [clean_full_team_name(row["team"]["name"]) for row in standings_data]
        except (KeyError, TypeError) as e:
            raise ValueError(f"Unable to extract team names for season {season}: {e}")

    def _build_season_standings(self, json_data: dict[str, Any], current_teams: list[str], season: int) -> DataFrame:
        try:
            standings_data = json_data["standings"][season]
        except KeyError:
            raise ValueError(f"Standings data not found for season {season}")

        df = pd.DataFrame.from_dict(standings_data)
        team_names = self._extract_team_names(json_data, season)
        df = df.drop(columns=self.COLUMNS_TO_DROP, errors='ignore')
        df.index = team_names
        df.columns = pd.MultiIndex.from_product([[season], self.STANDINGS_COLUMNS])
        df = df.loc[df.index.intersection(current_teams)]

        if len(df) < 20:
            logging.warning(f"Only {len(df)} teams found for season {season}, expected 20")

        return df

    def _clean_final_dataframe(self, df: DataFrame) -> DataFrame:
        df = df.fillna(0).astype(int)
        df.index.name = "team"
        df.columns.names = ("Season", None)
        if not df.empty:
            current_season = df.columns.get_level_values(0)[0]
            if (current_season, "position") in df.columns:
                df = df.sort_values(by=(current_season, "position"))
        return df

    def _combine_season_standings(self, json_data: dict[str, Any],
                                current_teams: list[str],
                                season: int,
                                num_seasons: int) -> DataFrame:
        combined_standings = pd.DataFrame()
        for i in range(num_seasons):
            season_year = season - i
            try:
                season_df = self._build_season_standings(json_data, current_teams, season_year)
                combined_standings = pd.concat([combined_standings, season_df], axis=1)
            except ValueError as e:
                logging.warning(f"Skipping season {season_year} - {e}")
                continue
        return combined_standings

    @timebudget
    def build(
        self, json_data: dict, season: int, num_seasons: int = 3, display: bool = False
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
            json_data dict: the json data storage used to build the DataFrame.
            season: the year of the current season.
            num_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        try:
            current_teams = self._extract_team_names(json_data, season)
        except ValueError as e:
            raise ValueError(f"Cannot build standings: {e}")

        if not current_teams:
            raise ValueError(f"No teams found for current season {season}")

        df = self._combine_season_standings(json_data, current_teams, season, num_seasons)

        if df.empty:
            raise ValueError("No valid standings data found for any season")

        df = self._clean_final_dataframe(df)

        if display:
            print(df)

        self.df = df

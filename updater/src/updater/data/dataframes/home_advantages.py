import logging
from collections import defaultdict
from typing import Any

import pandas as pd
from pandas import DataFrame
from updater.fmt import clean_full_team_name, get_full_time_goals
from timebudget import timebudget

from updater.data.dataframes.df import DF


class HomeAdvantages(DF):
    PANDEMIC_YEAR = 2020  # Exclude due to anomalous conditions (no fans)

    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "home_advantages")

    def _process_match_result(
        self, stats: defaultdict, match: dict[str, Any], season: int
    ) -> None:
        home_team = clean_full_team_name(match["homeTeam"]["name"])
        away_team = clean_full_team_name(match["awayTeam"]["name"])

        if match["score"]["winner"] is None:
            return

        home_goals, away_goals = get_full_time_goals(match["score"]["fullTime"])

        if home_goals > away_goals:
            stats[home_team][(season, "home", "wins")] += 1
            stats[away_team][(season, "away", "loses")] += 1
        elif home_goals < away_goals:
            stats[home_team][(season, "home", "loses")] += 1
            stats[away_team][(season, "away", "wins")] += 1
        else:
            stats[home_team][(season, "home", "draws")] += 1
            stats[away_team][(season, "away", "draws")] += 1

    def _calculate_season_metrics(self, df: DataFrame, season: int) -> None:
        home_played = (
            df[season]["home"]["wins"]
            + df[season]["home"]["draws"]
            + df[season]["home"]["loses"]
        )
        df[season, "home", "played"] = home_played

        home_win_ratio = df[season]["home"]["wins"] / home_played.replace(0, 1)
        df[season, "home", "winRatio"] = home_win_ratio

        total_played = (
            home_played
            + df[season]["away"]["wins"]
            + df[season]["away"]["draws"]
            + df[season]["away"]["loses"]
        )
        df[season, "overall", "played"] = total_played

        total_wins = df[season]["home"]["wins"] + df[season]["away"]["wins"]
        overall_win_ratio = total_wins / total_played.replace(0, 1)
        df[season, "overall", "winRatio"] = overall_win_ratio

        home_advantage = home_win_ratio - overall_win_ratio
        df[season, "homeAdvantage", ""] = home_advantage

    def _calculate_total_home_advantage(
        self, df: DataFrame, current_season: int, threshold: float
    ) -> DataFrame:
        home_advantage_cols = df.loc[
            :, df.columns.get_level_values(1) == "homeAdvantage"
        ]

        current_season_home_played = df[current_season]["home"]["played"]
        if (current_season_home_played <= threshold).all():
            logging.info(
                f"Home Advantages: Current season ({current_season}) excluded from calculation; "
                f"all teams have not played >= {threshold} home games."
            )
            if (current_season, "homeAdvantage", "") in home_advantage_cols.columns:
                home_advantage_cols = home_advantage_cols.drop(
                    (current_season, "homeAdvantage", ""), axis=1
                )

        pandemic_col = (self.PANDEMIC_YEAR, "homeAdvantage", "")
        if pandemic_col in home_advantage_cols.columns:
            home_advantage_cols = home_advantage_cols.drop(pandemic_col, axis=1)
            logging.info(
                f"Home Advantages: Excluded {self.PANDEMIC_YEAR} season due to pandemic conditions."
            )

        df["totalHomeAdvantage"] = home_advantage_cols.mean(axis=1).fillna(0)
        df = df.sort_values(by="totalHomeAdvantage", ascending=False)
        return df

    def _clean_dataframe(self, df: DataFrame, current_season_teams: list[str]) -> DataFrame:
        df = df.drop(columns=["wins", "loses", "draws"], level=2)
        df = df.loc[current_season_teams]
        df.columns.names = ("season", None, None)
        df.index.name = "team"
        if "totalHomeAdvantage" in df.columns:
            df = df.sort_values(by="totalHomeAdvantage", ascending=False)
        return df

    @staticmethod
    def _get_season_teams(season_fixtures: list[dict[str, Any]]) -> list[str]:
        teams: set[str] = set()
        for match in season_fixtures:
            teams.add(clean_full_team_name(match["homeTeam"]["name"]))
            teams.add(clean_full_team_name(match["awayTeam"]["name"]))
        return sorted(teams)

    @timebudget
    def build(
        self,
        json_data: dict,
        season: int,
        threshold: float,
        num_seasons: int = 3,
        display: bool = False,
    ):
        """Assigns self.df a DataFrame containing team's home advantage data
            for each season with a combined total home advantage value.

            Rows: the 20 teams participating in the current season, ordered descending
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------
            |                     [SEASON YEAR]                     | totalHomeAdvantage |
            |-------------------------------------------------------|--------------------|
            |       home        |      overall      | homeAdvantage |                    |
            |-------------------|-------------------|---------------|                    |
            | played | winRatio | played | winRatio |               |                    |

            [SEASON YEAR]: 4-digit year values that a season began, from current
                season to season no_seasons ago.
            played: the number of games played in the season.
            winRatio: the win ratio of all games played in the season.
            homeAdvantage: the difference between the ratio of games won at home
                and the ratio of games won in total for a given season year.
            totalHomeAdvantage: combined home advantages value from all seasons
               in the table: the average home wins ratio / wins ratio.

        Args:
            json_data dict: the json data storage used to build the DataFrame
            season int: the year of the current season
            threshold float: the minimum number of home games played to incorporate
                a season's home advantage calculation for all teams into the
                Total home Advantage value
            num_seasons (int, optional): number of seasons to include.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        stats: defaultdict = defaultdict(lambda: defaultdict(int))

        for i in range(num_seasons):
            season_year = season - i
            for match in json_data["fixtures"][season_year]:
                self._process_match_result(stats, match, season_year)

        df = pd.DataFrame.from_dict(stats, orient="index")
        df = df.fillna(0).astype(int)

        for i in range(num_seasons):
            self._calculate_season_metrics(df, season - i)

        df = self._calculate_total_home_advantage(df, season, threshold)

        current_season_teams = self._get_season_teams(json_data["fixtures"][season])
        df = self._clean_dataframe(df, current_season_teams)

        if display:
            print(df)

        self.df = df

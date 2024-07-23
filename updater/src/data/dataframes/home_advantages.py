import logging
from collections import defaultdict

import pandas as pd
from pandas import DataFrame
from src.format import clean_full_team_name
from timebudget import timebudget

from .df import DF


class HomeAdvantages(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "home_advantages")

    @staticmethod
    def _check_init_team_row(d: defaultdict, team: str, season: int):
        if team not in d:
            d[team] = {}

        if (season, "home", "wins") not in d[team]:
            d[team].update(
                {
                    (season, "home", "wins"): 0,
                    (season, "home", "draws"): 0,
                    (season, "home", "loses"): 0,
                    (season, "away", "wins"): 0,
                    (season, "away", "draws"): 0,
                    (season, "away", "loses"): 0,
                }
            )

    def _home_advantages_for_season(self, d: defaultdict, data: dict, season: int):
        for match in data:
            home_team = clean_full_team_name(match["homeTeam"]["name"])
            away_team = clean_full_team_name(match["awayTeam"]["name"])

            self._check_init_team_row(d, home_team, season)
            self._check_init_team_row(d, away_team, season)

            if match["score"]["winner"] is None:
                continue

            home_goals = match["score"]["fullTime"]["homeTeam"]
            away_goals = match["score"]["fullTime"]["awayTeam"]
            if home_goals > away_goals:
                # Home team wins
                d[home_team][(season, "home", "wins")] += 1
                d[away_team][(season, "away", "loses")] += 1
            elif home_goals < away_goals:
                # Away team wins
                d[home_team][(season, "home", "loses")] += 1
                d[away_team][(season, "away", "wins")] += 1
            else:
                # Draw
                d[home_team][(season, "home", "draws")] += 1
                d[away_team][(season, "away", "draws")] += 1

    @staticmethod
    def _create_season_home_advantage_col(home_advantages: DataFrame, season: int):
        played_at_home = (
            home_advantages[season]["home"]["wins"]
            + home_advantages[season]["home"]["draws"]
            + home_advantages[season]["home"]["loses"]
        )
        home_advantages[season, "home", "played"] = played_at_home

        # Percentage wins at home = total wins at home / total games played at home
        win_ratio_at_home = home_advantages[season]["home"]["wins"] / played_at_home
        home_advantages[season, "home", "winRatio"] = win_ratio_at_home

        played = (
            played_at_home
            + home_advantages[season]["away"]["wins"]
            + home_advantages[season]["away"]["draws"]
            + home_advantages[season]["away"]["loses"]
        )
        home_advantages[season, "overall", "played"] = played

        # Percentage wins = total wins / total games played
        win_ratio = (
            home_advantages[season]["home"]["wins"]
            + home_advantages[season]["away"]["wins"]
        ) / played
        home_advantages[season, "overall", "winRatio"] = win_ratio

        # home advantage = percentage wins at home - percentage wins
        home_advantage = win_ratio_at_home - win_ratio
        home_advantages[season, "homeAdvantage", ""] = home_advantage

    @staticmethod
    def _create_total_home_advantage_col(
        home_advantages: DataFrame, season: int, threshold: float
    ):
        home_advantages_cols = home_advantages.iloc[
            :, home_advantages.columns.get_level_values(1) == "homeAdvantage"
        ]
        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[season]["home"]["played"] <= threshold).all():
            logging.info(
                f"Home Advantages: Current season excluded from calculation; all teams have not played >= {threshold} home games."
            )
            # Drop this current seasons column (start from previous season)
            home_advantages_cols = home_advantages_cols.drop(season, level=0, axis=1)

        # Drop pandemic year (anomaly, no fans, data shows neutral home advantage)
        if (2020, "homeAdvantage", "") in list(home_advantages_cols.columns):
            home_advantages_cols = home_advantages_cols.drop(
                (2020, "homeAdvantage", ""), axis=1
            )

        home_advantages = home_advantages.sort_index(axis=1)
        home_advantages["totalHomeAdvantage"] = home_advantages_cols.mean(
            axis=1
        ).fillna(0)
        home_advantages = home_advantages.sort_values(
            by="totalHomeAdvantage", ascending=False
        )

        return home_advantages

    @staticmethod
    def _row_template(season: int, no_seasons: int):
        template: dict[tuple[int, str, str], int] = {}
        for i in range(no_seasons):
            template.update(
                {
                    (season - i, "home", "wins"): 0,
                    (season - i, "home", "draws"): 0,
                    (season - i, "home", "loses"): 0,
                    (season - i, "away", "wins"): 0,
                    (season - i, "away", "draws"): 0,
                    (season - i, "away", "loses"): 0,
                }
            )
        return template

    @staticmethod
    def _clean_dataframe(home_advantages: DataFrame, current_season_teams: list[str]):
        home_advantages = home_advantages.drop(
            columns=["wins", "loses", "draws"], level=2
        )
        home_advantages = home_advantages.loc[current_season_teams]
        home_advantages.columns.names = ("season", None, None)
        home_advantages.index.name = "team"
        return home_advantages

    @staticmethod
    def get_season_teams(season_fixtures_data: dict):
        current_season_teams: set[str] = set()
        for match in season_fixtures_data:
            home_team = clean_full_team_name(match["homeTeam"]["name"])
            away_team = clean_full_team_name(match["awayTeam"]["name"])
            current_season_teams.add(home_team)
            current_season_teams.add(away_team)
        return list(current_season_teams)

    @timebudget
    def build(
        self,
        json_data: dict,
        season: int,
        threshold: float,
        no_seasons: int = 3,
        display: bool = False,
    ):
        """ Assigns self.df a DataFrame containing team's home advantage data
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
            no_seasons (int, optional): number of seasons to include.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        d = defaultdict(lambda: self._row_template(season, no_seasons))
        for i in range(no_seasons):
            data = json_data["fixtures"][season - i]
            self._home_advantages_for_season(d, data, season - i)

        home_advantages = pd.DataFrame.from_dict(d, orient="index")
        home_advantages = home_advantages.fillna(0).astype(int)

        # Calculate home advantages for each season
        for i in range(no_seasons):
            self._create_season_home_advantage_col(home_advantages, season - i)

        # Create the final overall home advantage value for each team
        home_advantages = self._create_total_home_advantage_col(
            home_advantages, season, threshold
        )

        # Remove working columns
        current_season_teams = self.get_season_teams(json_data["fixtures"][season])
        home_advantages = self._clean_dataframe(home_advantages, current_season_teams)

        if display:
            print(home_advantages)

        self.df = home_advantages

import logging

import numpy as np
import pandas as pd
from pandas import DataFrame
from timebudget import timebudget

from .df import DF
from .standings import Standings


class TeamRatings(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "team_ratings")

    @staticmethod
    def _get_season_weightings(no_seasons: int):
        mult = 2.5  # Higher = recent seasons weighted more
        weights = np.array([mult ** i for i in range(no_seasons - 1, -1, -1)])
        return list(weights / weights.sum())

    def _calc_total_rating_col(
        self,
        team_ratings: DataFrame,
        no_seasons: int,
        include_current_season: bool,
    ):
        season_cols = [
            f"prevSeason{n}" for n in range(0 if include_current_season else 1, no_seasons)
        ]
        weights = np.array(self._get_season_weightings(len(season_cols)))
        team_ratings["total"] = team_ratings[season_cols].mul(weights).sum(axis=1)

    def _insert_rating_values(
        self,
        team_ratings: DataFrame,
        standings: Standings,
        current_season: int,
        num_seasons: int,
    ):
        for n in range(num_seasons):
            season_data = standings.df[current_season - n]
            team_ratings[f"prevSeason{n}"] = season_data["points"] + season_data["gD"]

    @staticmethod
    def _fill_nan(team_ratings: DataFrame):
        # Replace any NaN with the lowest rating in the same column
        team_ratings.fillna(team_ratings.min(), inplace=True)

    @staticmethod
    def _normalise_ratings(team_ratings: DataFrame, num_seasons: int):
        cols = [f"prevSeason{n}" for n in range(num_seasons)]
        col_min = team_ratings[cols].min()
        col_max = team_ratings[cols].max()
        team_ratings[cols] = (team_ratings[cols] - col_min) / (col_max - col_min)

    @staticmethod
    def _should_include_current_season(
        standings: Standings, current_season: int, games_threshold: float
    ):
        """Return True if all teams have played enough games for current season data to count."""
        if (standings.df[current_season]["played"] <= games_threshold).all():
            logging.info(
                f"Team Ratings: Current season excluded from calculation; all teams must have played {games_threshold} games."
            )
            return False
        return True

    @staticmethod
    def _clean_dataframe(team_ratings: DataFrame):
        team_ratings = team_ratings.sort_values(by="total", ascending=False)
        team_ratings = team_ratings.rename(columns={"prevSeason0": "current"})
        return team_ratings

    @timebudget
    def build(
        self,
        standings: Standings,
        season: int,
        games_threshold: int,
        num_seasons: int = 3,
        display: bool = False,
    ):
        """ Assigns self.df a DataFrame containing each team's calculated
            'team rating' based on the last [num_seasons] seasons results.

            Rows: the 20 teams participating in the current season, ordered
                descending by the team's rating
            Columns (multi-index):
            -----------------------------------
            | current | prevSeason[N] | total |

            current: a normalised value that represents the team's rating
                based on the state of the current season's standings table.
            prevSeason[N]: a normalised value that represents the team's rating
                based on the state of the standings table [N] seasons ago.
            total: a final normalised rating value incorporating the values
                from all normalised columns.

        Args:
            standings Standings: a completed DataFrame filled with standings data
                for the last num_seasons seasons
            season int: the year of the current season
            games_threshold: the minimum number of home games all teams must have
                played in any given season for the home advantage calculated for
                each team during that season to be incorporated into the total home
                advantage value
            num_seasons (int, optional): number of seasons to include. Defaults to 3.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)
        self._check_dependencies(standings)

        team_ratings = pd.DataFrame(index=standings.df.index)

        self._insert_rating_values(team_ratings, standings, season, num_seasons)
        self._fill_nan(team_ratings)
        self._normalise_ratings(team_ratings, num_seasons)
        include_cs = self._should_include_current_season(standings, season, games_threshold)
        self._calc_total_rating_col(team_ratings, num_seasons, include_cs)

        team_ratings = self._clean_dataframe(team_ratings)

        if display:
            print(team_ratings)

        self.df = team_ratings

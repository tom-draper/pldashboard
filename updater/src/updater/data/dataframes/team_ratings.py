import logging
from typing import Optional

import numpy as np
import pandas as pd
from pandas import DataFrame

from updater.data.dataframes.df import DF
from updater.data.dataframes.standings import Standings
from updater.timing import timed


class TeamRatings(DF):
    def __init__(self, d: Optional[DataFrame] = None):
        super().__init__(d, "team_ratings")
        self._total_ratings: Optional[dict[str, float]] = None

    def total_ratings(self):
        """Total rating per team as a plain dict.

        Form calculation looks these up tens of thousands of times; a dict
        avoids the per-call overhead of DataFrame scalar indexing. Rebuilt
        whenever `build` replaces the underlying DataFrame.
        """
        if self._total_ratings is None:
            self._total_ratings = self.df["total"].to_dict()
        return self._total_ratings

    @staticmethod
    def _calc_rating(points: int, gd: int):
        return points + gd

    @staticmethod
    def _get_season_weightings(no_seasons: int):
        mult = 2.5  # High = recent weighted more
        season_weights = [0.01 * (mult**3), 0.01 * (mult**2), 0.01 * mult, 0.01]
        weights = np.array(season_weights[:no_seasons])
        return list(weights / sum(weights))  # Normalise list

    def _calc_total_rating_col(
        self,
        team_ratings: dict,
        no_seasons: int,
        include_current_season: bool,
    ):
        # Calculate total rating column
        team_ratings["total"] = 0
        if include_current_season:
            start_n = 0  # Include current season when calculating total rating
            w = self._get_season_weightings(no_seasons)  # Column weights
        else:
            start_n = 1  # Exclude current season when calculating total rating
            w = self._get_season_weightings(no_seasons - 1)  # Column weights

        for n in range(start_n, no_seasons):
            team_ratings["total"] += (
                w[n - start_n] * team_ratings[f"prevSeason{n}"]
            )

    def insert_rating_values(
        self,
        team_ratings: DataFrame,
        standings: Standings,
        current_season: int,
        num_seasons: int,
    ):
        # Rating is points + goal difference. Computed a whole season's column
        # at a time from the standings frame, aligned on the shared team index,
        # rather than cell by cell.
        for n in range(num_seasons):
            season = current_season - n
            team_ratings[f"prevSeason{n}"] = self._calc_rating(
                standings.df[(season, "points")], standings.df[(season, "gD")]
            )

    @staticmethod
    def replace_nan(team_ratings: DataFrame):
        # Fill any NaN with the lowest rating in the same column. The per-column
        # minimum is applied in one pass; a column that is entirely NaN has no
        # minimum and is left untouched, as before.
        team_ratings[team_ratings.columns] = team_ratings.fillna(team_ratings.min())

    @staticmethod
    def normalise_ratings(team_ratings: DataFrame, num_seasons: int):
        # Min-max normalise every season's rating column at once; the per-column
        # min and max broadcast across the block.
        cols = [f"prevSeason{n}" for n in range(num_seasons)]
        block = team_ratings[cols]
        col_min = block.min()
        team_ratings[cols] = (block - col_min) / (block.max() - col_min)

    @staticmethod
    def include_current_season(
        standings: Standings, current_season: int, games_threshold: float
    ):
        """Check whether current season data should be included in each team's total rating
        If current season hasn't played enough games, don't include.
        """
        if (standings.df[current_season]["played"] <= games_threshold).all():
            logging.info(
                f"Team Ratings: Current season excluded from calculation; all teams must have played {games_threshold} games."
            )
            return False
        return True

    @staticmethod
    def clean_dataframe(team_ratings: DataFrame):
        team_ratings = team_ratings.sort_values(by="total", ascending=False)
        team_ratings = team_ratings.rename(columns={"prevSeason0": "current"})
        return team_ratings

    @timed
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

        # Add current season team names to the object team DataFrame
        team_ratings = pd.DataFrame(index=standings.df.index)

        self.insert_rating_values(team_ratings, standings, season, num_seasons)
        self.replace_nan(team_ratings)
        self.normalise_ratings(team_ratings, num_seasons)
        include_cs = self.include_current_season(standings, season, games_threshold)
        self._calc_total_rating_col(team_ratings, num_seasons, include_cs)

        team_ratings = self.clean_dataframe(team_ratings)

        if display:
            print(team_ratings)

        self.df = team_ratings
        self._total_ratings = None  # Invalidate cache for the new DataFrame

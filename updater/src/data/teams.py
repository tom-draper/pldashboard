import math
from typing import Any

import pandas as pd
from data.dataframes import (
    Fixtures,
    Form,
    HomeAdvantages,
    Standings,
    TeamRatings,
    Upcoming,
)
from predictions.scoreline import Scoreline


class TeamsData:
    def __init__(self):
        self.last_updated = None
        self.fixtures: Fixtures = Fixtures()
        self.standings: Standings = Standings()
        self.team_ratings: TeamRatings = TeamRatings()
        self.home_advantages: HomeAdvantages = HomeAdvantages()
        self.form: Form = Form()
        self.upcoming: Upcoming = Upcoming()

    def all_built(self):
        return (
            self.fixtures.df is not None
            and self.standings.df is not None
            and self.team_ratings.df is not None
            and self.home_advantages.df is not None
            and self.form.df is not None
            and self.upcoming.df is not None
        )

    def to_dataframe(self):
        return pd.concat(
            (
                self.fixtures.df,
                self.standings.df,
                self.team_ratings.df,
                self.home_advantages.df,
                self.form.df,
                self.upcoming.df,
            ),
            axis=1,
        )

    def _collapse_tuple_keys(self, d: dict | Any):
        if isinstance(d, float) and math.isnan(d):
            # Remove NaN values
            return None
        elif isinstance(d, Scoreline):
            # Unpack Scoreline object into a dict and continue recursing
            d = d.to_dict()
        elif isinstance(d, list):
            for i, v in enumerate(d):
                d[i] = self._collapse_tuple_keys(v)
            return d
        elif not isinstance(d, dict):
            # If hit bottom of tree, stop recursing
            return d

        new_d = {}
        for k, v in d.items():
            if isinstance(k, tuple):
                # Remove blank multi-index levels
                k = [x for x in k if x != ""]
                if len(k) == 1:
                    k = k[0]  # If only one level remains, take the single heading

            if isinstance(k, list):
                # Separate multi-index into a nested dict
                temp_d = new_d
                for i, _k in enumerate(k):
                    _k = str(_k)
                    if _k not in temp_d:
                        temp_d[_k] = {}
                    if i == len(k) - 1:
                        temp_d[_k] = self._collapse_tuple_keys(v)
                    else:
                        temp_d = temp_d[_k]
            elif isinstance(k, int):
                new_d[str(k)] = self._collapse_tuple_keys(v)
            else:
                new_d[k] = self._collapse_tuple_keys(v)

        return new_d

    def to_dict(self):
        if not self.all_built():
            raise ValueError(
                "Cannot convert TeamsData instance to dictionary: A DataFrame is empty."
            )

        # Build one dict containing all DataFrames
        d = {
            "lastUpdated": self.last_updated,
            "fixtures": self.fixtures.df.to_dict(orient="index"),
            "standings": self.standings.df.to_dict(orient="index"),
            "teamRatings": self.team_ratings.df.to_dict(orient="index"),
            "homeAdvantages": self.home_advantages.df.to_dict(orient="index"),
            "form": self.form.df.to_dict(orient="index"),
            "upcoming": self.upcoming.df.to_dict(orient="index"),
        }

        # Collapse tuple keys, convert int key to str and remove NaN values
        d = self._collapse_tuple_keys(d)
        return d

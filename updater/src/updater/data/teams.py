import pandas as pd
from updater.data.dataframes import (
    Fixtures,
    Form,
    HomeAdvantages,
    Standings,
    TeamRatings,
    Upcoming,
)
from updater.data.serialise import form_to_dict, to_nested_dict


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

    def to_dict(self):
        """Build the payload the dashboard consumes.

        The shape is defined by `updater.data.serialise`; see that module for
        the nesting and trimming rules.
        """
        if not self.all_built():
            raise ValueError(
                "Cannot convert TeamsData instance to dictionary: A DataFrame is empty."
            )

        return {
            "lastUpdated": self.last_updated,
            "fixtures": to_nested_dict(self.fixtures.df),
            "standings": to_nested_dict(self.standings.df),
            "teamRatings": to_nested_dict(self.team_ratings.df),
            "homeAdvantages": to_nested_dict(self.home_advantages.df),
            "form": form_to_dict(self.form.df),
            "upcoming": to_nested_dict(self.upcoming.df),
        }

from datetime import datetime
from typing import Optional

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
        self.last_updated: Optional[datetime] = None
        self.fixtures: Fixtures = Fixtures()
        self.standings: Standings = Standings()
        self.team_ratings: TeamRatings = TeamRatings()
        self.home_advantages: HomeAdvantages = HomeAdvantages()
        self.form: Form = Form()
        self.upcoming: Upcoming = Upcoming()

    def _frames(self):
        """The built DataFrames.

        Single source of truth so adding a frame does not mean updating
        `all_built` and `to_dict` in lockstep.
        """
        return (
            self.fixtures,
            self.standings,
            self.team_ratings,
            self.home_advantages,
            self.form,
            self.upcoming,
        )

    def all_built(self):
        return all(frame.df is not None for frame in self._frames())

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

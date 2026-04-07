from typing import Optional

from updater.fmt import convert_team_name_or_initials


class Scoreline:
    BLANK_TEAM = "___"

    def __init__(
        self,
        home_goals: int,
        away_goals: int,
        home_team: Optional[str] = None,
        away_team: Optional[str] = None,
    ):
        self.home_team = self.BLANK_TEAM if home_team is None else home_team
        self.away_team = self.BLANK_TEAM if away_team is None else away_team
        self.home_goals = home_goals
        self.away_goals = away_goals

    def reverse(self):
        self.home_team, self.away_team = self.away_team, self.home_team
        self.home_goals, self.away_goals = self.away_goals, self.home_goals

    def to_dict(self):
        return {
            "homeTeam": self.home_team,
            "awayTeam": self.away_team,
            "homeGoals": self.home_goals,
            "awayGoals": self.away_goals,
        }

    def __hash__(self):
        return hash((self.home_team, self.away_team, self.home_goals, self.away_goals))

    def __eq__(self, other):
        return (self.home_team, self.away_team, self.home_goals, self.away_goals) == (
            other.home_team, other.away_team, other.home_goals, other.away_goals
        )

    def __str__(self):
        home_initials = (
            self.home_team
            if self.home_team == self.BLANK_TEAM
            else convert_team_name_or_initials(self.home_team)
        )
        away_initials = (
            self.away_team
            if self.away_team == self.BLANK_TEAM
            else convert_team_name_or_initials(self.away_team)
        )
        return f"{home_initials} {self.home_goals} - {self.away_goals} {away_initials}"

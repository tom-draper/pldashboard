from src.fmt import convert_team_name_or_initials


class Scoreline:
    BLANK_TEAM = "___"

    def __init__(
        self,
        home_goals: int,
        away_goals: int,
        home_team: str = None,
        away_team: str = None,
        show_teams: bool = True,
    ):
        self.home_team = self.BLANK_TEAM if home_team is None else home_team
        self.away_team = self.BLANK_TEAM if away_team is None else away_team
        self.home_goals = home_goals
        self.away_goals = away_goals
        self.show_team = show_teams

    def reverse(self):
        self.home_team, self.away_team = self.away_team, self.home_team
        self.home_goals, self.away_goals = self.away_goals, self.home_goals

    def __hash__(self):
        if self.show_team:
            return hash(
                (self.home_team, self.away_team, self.home_goals, self.away_goals)
            )
        return hash((self.home_goals, self.away_goals))

    def __eq__(self, other):
        if self.show_team:
            return (
                self.home_team,
                self.away_team,
                self.home_goals,
                self.away_goals,
            ) == (other.home_team, other.away_team, other.home_goals, other.away_goals)
        return (self.home_goals, self.away_goals) == (
            other.home_goals,
            other.away_goals,
        )

    def __str__(self):
        if self.show_team:
            home_team_initials = (
                self.home_team
                if self.home_team == self.BLANK_TEAM
                else convert_team_name_or_initials(self.home_team)
            )
            away_team_initials = (
                self.away_team
                if self.away_team == self.BLANK_TEAM
                else convert_team_name_or_initials(self.away_team)
            )
            return f"{home_team_initials} {self.home_goals} - {self.away_goals} {away_team_initials}"
        return f"{self.home_goals} - {self.away_goals}"

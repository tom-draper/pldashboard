from datetime import datetime
from typing import Literal


class Odds:
    def __init__(
        self,
        home: float,
        draw: float,
        away: float,
        home_team: str = None,
        away_team: str = None,
        match_date: datetime = None,
    ):
        self.home = home
        self.draw = draw
        self.away = away

        self.home_team = home_team
        self.away_team = away_team
        self.match_date = match_date

        self.representation: Literal["odds", "probabilities"] = "odds"

    def __str__(self):
        return f"{self.home_team} vs {self.away_team} [{self.home}] [{self.draw}] [{self.away}]"

    def __repr__(self):
        return str(self)

    def _toggle_reciprocal(self):
        self.home = 1 / self.home
        self.draw = 1 / self.draw
        self.away = 1 / self.away

    def convert_to_probabilities(self):
        if self.representation == "odds":
            self._toggle_reciprocal()
            self.representation = "probabilities"

    def convert_to_odds(self):
        if self.representation == "probabilities":
            self._toggle_reciprocal()
            self.representation = "odds"


def scale_by_odds(freq: dict[str, int | float], odds: Odds):
    odds.convert_to_probabilities()
    for scoreline in freq:
        if scoreline.home_goals > scoreline.away_goals:
            freq[scoreline] *= odds.home
        elif scoreline.home_goals < scoreline.away_goals:
            freq[scoreline] *= odds.away
        elif scoreline.home_goals == scoreline.away_goals:
            freq[scoreline] *= odds.draw

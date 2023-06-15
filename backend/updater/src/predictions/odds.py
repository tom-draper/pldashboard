from typing import Literal
from src.fmt import extract_int_score_from_scoreline

class Odds:
    def __init__(self, home: float, draw: float, away: float):
        self.home = home
        self.draw = draw
        self.away = away
        self.representation: Literal['odds', 'probabilities'] = 'odds'

    def _toggle_reciprocal(self):
        self.home = 1 / self.home
        self.draw = 1 / self.draw
        self.away = 1 / self.away

    def convert_to_probabilities(self):
        if self.representation == 'odds':
            self._toggle_reciprocal()
            self.representation = 'probabilities'

    def convert_to_odds(self):
        if self.representation == 'probabilities':
            self._toggle_reciprocal()
            self.representation = 'odds'

@staticmethod
def scale_by_odds(freq: dict[str, int | float], odds: Odds):
    odds.convert_to_probabilities()
    for scoreline in freq:
        home, away = extract_int_score_from_scoreline(scoreline)
        if home > away:
            freq[scoreline] *= odds.home
        elif home < away:
            freq[scoreline] *= odds.away
        elif home == away:
            freq[scoreline] *= odds.draw
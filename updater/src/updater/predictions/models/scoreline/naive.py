"""Deliberately naive baselines, there to be beaten.

A model that beats the base-rate baseline has only proved it knows football is
not a coin flip. These two set a far more demanding floor, and each isolates a
specific claim the real engines make:

    * empirical-scoreline - the recency-weighted frequency of every scoreline in
      the training window, applied identically to every fixture. It knows nothing
      whatsoever about who is playing. Its modal prediction is simply the league's
      most common scoreline. Any exact-score accuracy the rated models post has
      to be measured against this: if Dixon-Coles cannot beat "always guess the
      usual scoreline", then its scoreline modelling is decoration.

    * goal-average - the classic pre-Dixon-Coles heuristic. Each team gets an
      attack and defence strength as a plain ratio to the league average, with no
      likelihood, no optimiser, no correlation term:

          lambda_home = league_home_avg * attack_home[home] * defence_away[away]

      It uses the same information as the fitted models and roughly the same
      functional form, so it isolates what maximum likelihood is buying over
      arithmetic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from updater.predictions.distributions import (
    MatchResult,
    ScorePrediction,
    match_dates,
    poisson_pmf,
    prediction_from_matrix,
    time_weights,
)

# Scorelines are tracked up to this many goals per side; anything beyond is
# folded into the smoothing floor, being rare enough not to matter.
MAX_STORED_GOALS = 10

# Laplace-style floor so an unobserved scoreline never gets probability 0, which
# would hand the model an infinite log-loss the first time one turned up. Kept
# tiny deliberately: the floor is spread uniformly over the whole grid, including
# absurd scorelines like 9-7, so a larger value would drag the distribution's
# mean goals upwards and quietly handicap the model.
SMOOTHING = 1e-3


@dataclass
class EmpiricalScorelineModel:
    """The league's scoreline frequencies, applied to every fixture alike."""

    counts: np.ndarray  # (MAX_STORED_GOALS + 1) ^ 2, recency-weighted and smoothed

    def _matrix(self, max_goals: int) -> np.ndarray:
        size = max_goals + 1
        stored = self.counts.shape[0]
        if size <= stored:
            return self.counts[:size, :size]
        # Asked for a bigger grid than we track: pad the tail with the floor.
        padded = np.full((size, size), SMOOTHING)
        padded[:stored, :stored] = self.counts
        return padded

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        matrix = self._matrix(MAX_STORED_GOALS)
        matrix = matrix / matrix.sum()
        goals = np.arange(matrix.shape[0])
        return (
            float(np.dot(goals, matrix.sum(axis=1))),
            float(np.dot(goals, matrix.sum(axis=0))),
        )

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        # Every fixture gets the same distribution; only the team labels differ.
        return prediction_from_matrix(
            home_team, away_team, self._matrix(max_goals).copy()
        )


def fit_empirical_scoreline(
    matches: Sequence[MatchResult], half_life_days: float = 365.0
) -> Optional[EmpiricalScorelineModel]:
    """Tally how often each scoreline occurred, down-weighting older matches."""
    if not matches:
        return None

    size = MAX_STORED_GOALS + 1
    counts = np.full((size, size), SMOOTHING)
    weights = time_weights(match_dates(list(matches)), half_life_days)

    for match, weight in zip(matches, weights):
        home = min(match.home_goals, MAX_STORED_GOALS)
        away = min(match.away_goals, MAX_STORED_GOALS)
        counts[home, away] += weight

    return EmpiricalScorelineModel(counts=counts)


@dataclass
class GoalAverageModel:
    """Attack / defence strengths as plain ratios to the league average.

    Strengths are kept separately for home and away matches, since the split is
    exactly what the league averages already encode. An unknown (promoted) team
    rates 1.0 across the board, i.e. perfectly average, which is generous. That
    generosity is part of what the model is here to expose.
    """

    attack_home: dict[str, float]
    defence_home: dict[str, float]
    attack_away: dict[str, float]
    defence_away: dict[str, float]
    league_home_goals: float
    league_away_goals: float

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        lambda_home = (
            self.league_home_goals
            * self.attack_home.get(home_team, 1.0)
            * self.defence_away.get(away_team, 1.0)
        )
        lambda_away = (
            self.league_away_goals
            * self.attack_away.get(away_team, 1.0)
            * self.defence_home.get(home_team, 1.0)
        )
        return max(lambda_home, 1e-3), max(lambda_away, 1e-3)

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.expected_goals(home_team, away_team)
        goals = np.arange(max_goals + 1)
        matrix = np.outer(
            poisson_pmf(goals, lambda_home), poisson_pmf(goals, lambda_away)
        )
        return prediction_from_matrix(
            home_team,
            away_team,
            matrix,
            expected_home_goals=lambda_home,
            expected_away_goals=lambda_away,
        )


def fit_goal_average(
    matches: Sequence[MatchResult], half_life_days: float = 365.0
) -> Optional[GoalAverageModel]:
    """Weighted goal averages per team, expressed as ratios to the league mean."""
    if not matches:
        return None

    weights = time_weights(match_dates(list(matches)), half_life_days)

    # Weighted goals scored / conceded, split by venue.
    scored: dict[tuple[str, str], float] = {}
    conceded: dict[tuple[str, str], float] = {}
    played: dict[tuple[str, str], float] = {}

    total_home_goals = total_away_goals = total_weight = 0.0

    for match, weight in zip(matches, weights):
        for venue, team, goals_for, goals_against in (
            ("home", match.home_team, match.home_goals, match.away_goals),
            ("away", match.away_team, match.away_goals, match.home_goals),
        ):
            key = (venue, team)
            scored[key] = scored.get(key, 0.0) + weight * goals_for
            conceded[key] = conceded.get(key, 0.0) + weight * goals_against
            played[key] = played.get(key, 0.0) + weight

        total_home_goals += weight * match.home_goals
        total_away_goals += weight * match.away_goals
        total_weight += weight

    if total_weight == 0:
        return None

    league_home_goals = total_home_goals / total_weight
    league_away_goals = total_away_goals / total_weight
    if league_home_goals <= 0 or league_away_goals <= 0:
        return None

    def ratios(venue: str, totals: dict, league_average: float) -> dict[str, float]:
        return {
            team: (totals[(v, team)] / played[(v, team)]) / league_average
            for (v, team) in played
            if v == venue and played[(v, team)] > 0
        }

    return GoalAverageModel(
        attack_home=ratios("home", scored, league_home_goals),
        # Conceded at home is measured against what away sides normally score.
        defence_home=ratios("home", conceded, league_away_goals),
        attack_away=ratios("away", scored, league_away_goals),
        defence_away=ratios("away", conceded, league_home_goals),
        league_home_goals=league_home_goals,
        league_away_goals=league_away_goals,
    )

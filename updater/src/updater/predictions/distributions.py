"""Shared types and helpers for goal-distribution models.

Every prediction engine ultimately produces the same thing: a home-goals x
away-goals probability matrix. This module holds the pieces they all share, so
each engine only has to define how its ratings are fit and how a fixture turns
into that matrix.

It lives apart from any single engine so that predict_v3 and the alternative
models in `predictions.models` can both use it without importing each other.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import log
from typing import NamedTuple, Optional

import numpy as np


class MatchResult(NamedTuple):
    """One completed match, home-team oriented.

    `home_xg` / `away_xg` are optional expected-goals values (true xG, or a
    shots-based proxy). When present and `xg_weight > 0`, a fit may blend them
    with the actual goals to denoise each team's rate estimates.
    """

    date: datetime
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None


@dataclass
class ScorePrediction:
    """A fixture's full predicted distribution.

    `home_goals_dist[k]` is the probability the home team scores exactly k;
    `away_goals_dist` likewise for the away team. `scoreline_matrix[h][a]` is the
    joint probability of the exact scoreline h-a. All three sum to ~1.
    """

    home_team: str
    away_team: str
    expected_home_goals: float
    expected_away_goals: float
    home_goals_dist: list[float]
    away_goals_dist: list[float]
    scoreline_matrix: list[list[float]]
    prob_home_win: float
    prob_draw: float
    prob_away_win: float
    predicted_home_goals: int
    predicted_away_goals: int

    def to_dict(self) -> dict:
        return {
            "homeTeam": self.home_team,
            "awayTeam": self.away_team,
            "expectedHomeGoals": self.expected_home_goals,
            "expectedAwayGoals": self.expected_away_goals,
            "homeGoalsDist": self.home_goals_dist,
            "awayGoalsDist": self.away_goals_dist,
            "scorelineMatrix": self.scoreline_matrix,
            "probHomeWin": self.prob_home_win,
            "probDraw": self.prob_draw,
            "probAwayWin": self.prob_away_win,
            "predictedHomeGoals": self.predicted_home_goals,
            "predictedAwayGoals": self.predicted_away_goals,
        }


def poisson_pmf(k: np.ndarray, lam: float | np.ndarray) -> np.ndarray:
    """Poisson probability mass, vectorised over goal counts 0..k for each lam."""
    from scipy.stats import poisson

    return poisson.pmf(k, lam)


def dc_low_score_correction(
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    lambda_home: np.ndarray,
    lambda_away: np.ndarray,
    rho: float,
) -> np.ndarray:
    """Dixon-Coles tau adjustment for the four low-score cells (1 elsewhere)."""
    tau = np.ones_like(lambda_home, dtype=float)

    zero_zero = (home_goals == 0) & (away_goals == 0)
    zero_one = (home_goals == 0) & (away_goals == 1)
    one_zero = (home_goals == 1) & (away_goals == 0)
    one_one = (home_goals == 1) & (away_goals == 1)

    tau[zero_zero] = 1 - lambda_home[zero_zero] * lambda_away[zero_zero] * rho
    tau[zero_one] = 1 + lambda_home[zero_one] * rho
    tau[one_zero] = 1 + lambda_away[one_zero] * rho
    tau[one_one] = 1 - rho
    return tau


def goal_grids(max_goals: int) -> tuple[np.ndarray, np.ndarray]:
    """Home-goals and away-goals index grids for a (max_goals+1)^2 matrix."""
    goals = np.arange(max_goals + 1)
    ones_row = np.ones((1, max_goals + 1))
    ones_col = np.ones((max_goals + 1, 1))
    return goals.reshape(-1, 1) * ones_row, ones_col * goals.reshape(1, -1)


def prediction_from_matrix(
    home_team: str,
    away_team: str,
    matrix: np.ndarray,
    expected_home_goals: Optional[float] = None,
    expected_away_goals: Optional[float] = None,
) -> ScorePrediction:
    """Assemble a ScorePrediction from a (possibly unnormalised) score matrix.

    Truncating the goal tail (and tweaks like the Dixon-Coles tau) leave the mass
    slightly off 1, so the matrix is renormalised here. When the caller does not
    supply expected goals, they are taken from the truncated distribution's mean.
    """
    total = matrix.sum()
    if total > 0:
        matrix = matrix / total

    home_goals_dist = matrix.sum(axis=1)
    away_goals_dist = matrix.sum(axis=0)

    if expected_home_goals is None:
        expected_home_goals = float(np.dot(np.arange(matrix.shape[0]), home_goals_dist))
    if expected_away_goals is None:
        expected_away_goals = float(np.dot(np.arange(matrix.shape[1]), away_goals_dist))

    best = np.unravel_index(int(np.argmax(matrix)), matrix.shape)

    return ScorePrediction(
        home_team=home_team,
        away_team=away_team,
        expected_home_goals=float(expected_home_goals),
        expected_away_goals=float(expected_away_goals),
        home_goals_dist=home_goals_dist.tolist(),
        away_goals_dist=away_goals_dist.tolist(),
        scoreline_matrix=matrix.tolist(),
        prob_home_win=float(np.tril(matrix, -1).sum()),
        prob_draw=float(np.trace(matrix)),
        prob_away_win=float(np.triu(matrix, 1).sum()),
        predicted_home_goals=int(best[0]),
        predicted_away_goals=int(best[1]),
    )


def match_dates(matches: list[MatchResult]) -> np.ndarray:
    """Kickoff times as np.datetime64, which has no tz support (inputs are UTC)."""
    return np.array(
        [
            np.datetime64(m.date.replace(tzinfo=None) if m.date.tzinfo else m.date)
            for m in matches
        ]
    )


def time_weights(dates: np.ndarray, half_life_days: float) -> np.ndarray:
    """Exponential recency weights: newest match ~1, halving every half_life_days."""
    reference = dates.max()
    days_ago = (reference - dates) / np.timedelta64(1, "D")
    decay = log(2) / half_life_days
    return np.exp(-decay * days_ago)

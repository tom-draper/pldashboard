"""Skellam regression: fit the goal *difference*, not the two goal counts.

The difference of two independent Poisson variables follows a Skellam
distribution, and the match outcome is a function of that difference alone. So
this model fits the rates by maximising the likelihood of the observed goal
difference and nothing else.

That is a deliberate trade. Throwing away the total-goals information costs
precision, but it also means a 4-3 and a 1-0 carry identical evidence about who
was better, which is arguably the truth: the model cannot be pulled around by
high-scoring games the way a full goals likelihood can. Since the outcome
metrics (RPS, log-loss) depend only on the difference, this fits exactly the
quantity being scored.

The scoreline matrix still needs the two individual rates, so predictions fall
back to the independent-Poisson joint implied by the fitted lambdas.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.special import ive

from updater.predictions.distributions import (
    ScorePrediction,
    poisson_pmf,
    prediction_from_matrix,
)
from updater.predictions.models.scoreline.common import TeamRatings

MIN_RATE = 1e-6


def skellam_log_pmf(
    difference: np.ndarray, lambda_home: np.ndarray, lambda_away: np.ndarray
) -> np.ndarray:
    """log P(X - Y = k) for independent X ~ Poisson(l1), Y ~ Poisson(l2).

        P(k) = exp(-(l1 + l2)) (l1 / l2) ^ (k / 2) * I_|k|(2 sqrt(l1 l2))

    `ive(v, z) = I_v(z) exp(-|z|)` is the exponentially scaled Bessel function,
    which is what keeps this from overflowing: I_v grows enormous in z, so the
    scaling is undone in log space by adding z back rather than ever forming
    I_v(z) itself.
    """
    l1 = np.maximum(lambda_home, MIN_RATE)
    l2 = np.maximum(lambda_away, MIN_RATE)
    root = 2.0 * np.sqrt(l1 * l2)
    return (
        -(l1 + l2)
        + (difference / 2.0) * (np.log(l1) - np.log(l2))
        + np.log(np.maximum(ive(np.abs(difference), root), 1e-300))
        + root
    )


@dataclass
class SkellamModel:
    """Ratings fit on goal difference; scorelines from the implied Poissons."""

    ratings: TeamRatings

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        return self.ratings.rates(home_team, away_team)

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.ratings.rates(home_team, away_team)
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

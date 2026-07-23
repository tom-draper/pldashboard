"""Poisson-family alternatives to Dixon-Coles.

Two different diagnoses of where the plain independent-Poisson model goes wrong,
each fixing it in a principled way rather than with Dixon-Coles' patch on four
low-score cells:

    * bivariate Poisson (Karlis & Ntzoufras 2003) - home and away goals share a
      common component, so the model has an explicit, estimated covariance
      instead of a correction applied after the fact. It can only represent
      *positive* correlation, which is a real limitation given football's
      observed dependence is mildly negative at low scores.

    * negative binomial - keeps independence but replaces each Poisson marginal
      with an overdispersed one. Real goal counts have variance above their mean
      (blowouts happen more often than Poisson allows), which fattens the tail.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.special import gammaln, logsumexp

from updater.predictions.distributions import (
    ScorePrediction,
    goal_grids,
    prediction_from_matrix,
)
from updater.predictions.models.scoreline.common import FittedRatings

# Rates below this are numerically awkward and physically meaningless (a team
# scoring 0.01 goals a game); clamp before taking logs.
MIN_RATE = 1e-6


def _bivariate_log_pmf(
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    lambda_home: np.ndarray,
    lambda_away: np.ndarray,
    lambda_shared: float,
) -> np.ndarray:
    """log P(X=x, Y=y) for the bivariate Poisson.

    X = W1 + W3 and Y = W2 + W3 with W1, W2, W3 independent Poisson, giving

        P(x, y) = exp(-(l1+l2+l3)) (l1^x/x!) (l2^y/y!)
                  * sum_{k=0}^{min(x,y)} C(x,k) C(y,k) k! (l3/(l1 l2))^k

    The sum is evaluated in log space over k, which stays stable when l3 is small
    (the near-independent case the optimiser tends to land in).
    """
    l1 = np.maximum(lambda_home, MIN_RATE)
    l2 = np.maximum(lambda_away, MIN_RATE)
    l3 = max(float(lambda_shared), 0.0)

    base = (
        -(l1 + l2 + l3)
        + home_goals * np.log(l1)
        - gammaln(home_goals + 1)
        + away_goals * np.log(l2)
        - gammaln(away_goals + 1)
    )

    if l3 <= 0:
        return base

    log_ratio = np.log(l3) - np.log(l1) - np.log(l2)
    k_max = int(np.minimum(home_goals, away_goals).max())
    terms = np.full((k_max + 1,) + np.broadcast(base, home_goals).shape, -np.inf)
    for k in range(k_max + 1):
        valid = (home_goals >= k) & (away_goals >= k)
        # C(x,k) C(y,k) k! in log space, with the k! from the numerator cancelling
        # one of the two 1/k! factors in the binomial coefficients.
        term = (
            gammaln(home_goals + 1)
            - gammaln(k + 1)
            - gammaln(np.maximum(home_goals - k, 0) + 1)
            + gammaln(away_goals + 1)
            - gammaln(k + 1)
            - gammaln(np.maximum(away_goals - k, 0) + 1)
            + gammaln(k + 1)
            + k * log_ratio
        )
        terms[k] = np.where(valid, term, -np.inf)

    return base + logsumexp(terms, axis=0)


@dataclass
class BivariatePoissonModel:
    """Fitted bivariate Poisson: ratings plus a shared goal-rate component."""

    ratings: FittedRatings
    lambda_shared: float

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        lambda_home, lambda_away = self.ratings.rates(home_team, away_team)
        # E[X] = l1 + l3, E[Y] = l2 + l3.
        return lambda_home + self.lambda_shared, lambda_away + self.lambda_shared

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.ratings.rates(home_team, away_team)
        hg, ag = goal_grids(max_goals)
        matrix = np.exp(
            _bivariate_log_pmf(
                hg,
                ag,
                np.full_like(hg, lambda_home),
                np.full_like(ag, lambda_away),
                self.lambda_shared,
            )
        )
        expected_home, expected_away = self.expected_goals(home_team, away_team)
        return prediction_from_matrix(
            home_team,
            away_team,
            matrix,
            expected_home_goals=expected_home,
            expected_away_goals=expected_away,
        )


def _negative_binomial_log_pmf(
    goals: np.ndarray, mean: np.ndarray, size: float
) -> np.ndarray:
    """log P(K=k) for a negative binomial with the given mean and size (r).

    Parameterised by mean rather than success probability so the rating structure
    carries over unchanged: p = r / (r + mu). As r grows the distribution tends
    to Poisson(mu), so the fit can always fall back to the simpler model.
    """
    mu = np.maximum(mean, MIN_RATE)
    return (
        gammaln(goals + size)
        - gammaln(size)
        - gammaln(goals + 1)
        + size * (np.log(size) - np.log(size + mu))
        + goals * (np.log(mu) - np.log(size + mu))
    )


@dataclass
class NegativeBinomialModel:
    """Fitted independent negative-binomial goals model."""

    ratings: FittedRatings
    size: float

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        return self.ratings.rates(home_team, away_team)

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.ratings.rates(home_team, away_team)
        goals = np.arange(max_goals + 1)
        home_pmf = np.exp(
            _negative_binomial_log_pmf(goals, np.full_like(goals, lambda_home, dtype=float), self.size)
        )
        away_pmf = np.exp(
            _negative_binomial_log_pmf(goals, np.full_like(goals, lambda_away, dtype=float), self.size)
        )
        return prediction_from_matrix(
            home_team,
            away_team,
            np.outer(home_pmf, away_pmf),
            expected_home_goals=lambda_home,
            expected_away_goals=lambda_away,
        )

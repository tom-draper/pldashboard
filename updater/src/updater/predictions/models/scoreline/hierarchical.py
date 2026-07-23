"""Hierarchical Dixon-Coles with empirical-Bayes shrinkage.

The plain fit treats every team's attack and defence as a free parameter pinned
only by a fixed, arbitrary L2 penalty (`regularisation=1e-3`, chosen to steady
the optimiser rather than to express a belief). That is a hidden assumption:
the penalty *is* a prior, and setting it by hand sets the prior by hand.

This model makes the prior explicit and estimates it from the data. Team ratings
are taken as draws from a shared distribution

    attack, defence ~ Normal(0, sigma ^ 2)

and sigma is learned rather than assumed. A Normal prior contributes
`sum(x ^ 2) / (2 sigma ^ 2)` to the negative log posterior, so the penalty weight
is exactly `1 / (2 sigma ^ 2)`. Fitting alternates:

    1. fit the ratings at the current penalty
    2. set sigma ^ 2 to the spread of the ratings that came back
    3. repeat until the penalty stops moving

This is the empirical-Bayes (MAP) approximation to Baio & Blangiardo's
hierarchical model: the same shrinkage without a sampler. Practically, a league
whose teams are genuinely close together gets shrunk hard, so noisy ratings from
short training windows are pulled toward the mean, while a league with real
spread is left alone. It is a principled answer to a question the other models
answer by guessing.

The promoted-team prior is deliberately left as-is (the weakest few sides, as
every other engine uses), so the backtest isolates the effect of shrinkage rather
than confounding it with a change to how unseen teams are handled.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional

import numpy as np

from updater.predictions.distributions import (
    MatchResult,
    dc_low_score_correction,
)
from updater.predictions.models.scoreline.common import fit_ratings
from updater.predictions.models.scoreline.dixon_coles import DixonColesModel

# Bounds on the learned prior width. The floor stops a degenerate fit (every
# team identical) from driving the penalty to infinity and freezing all ratings
# at zero; the ceiling keeps a wide-spread league from switching shrinkage off
# entirely and losing the optimiser stability the penalty also provides.
MIN_SIGMA = 0.05
MAX_SIGMA = 1.0

# The alternation converges quickly; more iterations mostly cost fit time.
DEFAULT_ITERATIONS = 5
CONVERGENCE_TOLERANCE = 1e-3


def _dixon_coles_log_likelihood(
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    lambda_home: np.ndarray,
    lambda_away: np.ndarray,
    extra: np.ndarray,
) -> np.ndarray:
    """Per-match Dixon-Coles log-likelihood, with extra[0] as rho."""
    rho = float(extra[0])
    log_poisson = (
        home_goals * np.log(lambda_home)
        - lambda_home
        + away_goals * np.log(lambda_away)
        - lambda_away
    )
    tau = dc_low_score_correction(
        home_goals, away_goals, lambda_home, lambda_away, rho
    )
    return np.log(np.clip(tau, 1e-10, None)) + log_poisson


def fit_hierarchical(
    matches: Sequence[MatchResult],
    half_life_days: float = 365.0,
    iterations: int = DEFAULT_ITERATIONS,
    max_iter: int = 200,
) -> Optional[DixonColesModel]:
    """Alternate between fitting ratings and re-estimating how far they spread."""
    if not matches:
        return None

    sigma = 0.3  # A plausible starting spread for league attack/defence ratings.
    ratings = None

    for _ in range(iterations):
        penalty = 1.0 / (2.0 * sigma**2)
        ratings = fit_ratings(
            matches,
            _dixon_coles_log_likelihood,
            extra_initial=[-0.05],
            extra_bounds=[(-0.2, 0.2)],
            half_life_days=half_life_days,
            regularisation=penalty,
            max_iter=max_iter,
        )
        if ratings is None:
            return None

        # The ratings are centred by construction (the penalty pins the shift
        # they are only identified up to), so the second moment is the variance.
        values = np.array(
            list(ratings.attack.values()) + list(ratings.defence.values())
        )
        updated = float(np.sqrt(np.mean(values**2)))
        updated = float(np.clip(updated, MIN_SIGMA, MAX_SIGMA))

        if abs(updated - sigma) < CONVERGENCE_TOLERANCE:
            sigma = updated
            break
        sigma = updated

    if ratings is None:
        return None

    return DixonColesModel(
        teams=ratings.teams,
        attack=ratings.attack,
        defence=ratings.defence,
        home_advantage=ratings.home_advantage,
        rho=float(ratings.extra[0]),
        default_attack=ratings.default_attack,
        default_defence=ratings.default_defence,
    )

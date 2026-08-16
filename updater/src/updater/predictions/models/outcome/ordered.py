"""Ordered logit / probit on fitted team strengths.

The flagship direct-outcome model, and the closest like-for-like comparison
against Dixon-Coles: same input (a window of finished matches), same recency
weighting, same L2 shrinkage, one rating per team instead of two, fit by
maximum likelihood. The single difference is what the likelihood is placed on.
Dixon-Coles maximises the probability of the observed *scoreline*; this maximises
the probability of the observed *result*.

That difference cuts both ways and neither direction is obviously right.
Dixon-Coles gets to learn from the margin, so a 4-0 tells it more than a 1-0,
information this model throws away by recording both as a home win. In exchange
this model spends none of its capacity distinguishing 4-0 from 3-0, a distinction
that is discarded anyway the moment the backtest scores home/draw/away, and its
draw band is fit rather than implied. Which effect wins is an empirical question,
which is the point of having both.

One rating per team, not two: with only three outcomes to predict there is very
little for separate attack and defence ratings to do, and the extra ~20
parameters cost more in variance than they earn.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from updater.predictions.distributions import (
    MatchResult,
    OutcomePrediction,
    match_dates,
    match_outcome,
    outcome_from_probs,
    time_weights,
)
from updater.predictions.models.outcome.common import (
    INITIAL_LOG_GAP,
    INITIAL_LOWER,
    OrderedCutpoints,
    default_strength,
    negative_log_likelihood,
    unpack_cutpoints,
)


@dataclass
class OrderedOutcomeModel:
    """Fitted team strengths plus the cutpoints that split them into results."""

    strength: dict[str, float]
    cutpoints: OrderedCutpoints
    unknown_strength: float = 0.0
    # Set so the registry and the backtest can report what a model produces
    # without having to try calling it and see what comes back.
    produces_scoreline: bool = field(default=False, init=False)

    def rating(self, team: str) -> float:
        return self.strength.get(team, self.unknown_strength)

    def eta(self, home_team: str, away_team: str) -> float:
        """Latent home supremacy. Home advantage sits in the cutpoints, not here."""
        return self.rating(home_team) - self.rating(away_team)

    def predict_outcome(self, home_team: str, away_team: str) -> OutcomePrediction:
        probs = self.cutpoints.probabilities(self.eta(home_team, away_team))
        return outcome_from_probs(home_team, away_team, probs)


def fit_ordered(
    matches: Sequence[MatchResult],
    link: str = "logit",
    half_life_days: float = 365.0,
    regularisation: float = 1e-2,
    max_iter: int = 300,
) -> Optional[OrderedOutcomeModel]:
    """Maximise the weighted outcome likelihood over strengths and cutpoints.

    `regularisation` is an order of magnitude heavier than the scoreline models
    use, deliberately. Three outcomes carry far less information per match than a
    scoreline does, so the strengths are estimated from much thinner evidence and
    need more shrinking to stay stable early in a season.
    """
    from scipy.optimize import minimize

    if not matches:
        return None

    ordered = list(matches)
    teams = sorted({m.home_team for m in ordered} | {m.away_team for m in ordered})
    index = {team: i for i, team in enumerate(teams)}
    n = len(teams)

    home_idx = np.array([index[m.home_team] for m in ordered])
    away_idx = np.array([index[m.away_team] for m in ordered])
    outcomes = np.array(
        [match_outcome(m.home_goals, m.away_goals) for m in ordered], dtype=int
    )
    weights = time_weights(match_dates(ordered), half_life_days)

    def objective(params: np.ndarray) -> float:
        strength = params[:n]
        lower, upper = unpack_cutpoints(float(params[n]), float(params[n + 1]))
        eta = strength[home_idx] - strength[away_idx]
        penalty = regularisation * float(np.sum(strength**2))
        return (
            negative_log_likelihood(eta, outcomes, weights, lower, upper, link)
            + penalty
        )

    initial = np.concatenate([np.zeros(n), [INITIAL_LOWER, INITIAL_LOG_GAP]])
    # Strengths are identified only up to a joint shift (eta is a difference);
    # the L2 penalty pins that direction, so they need no bounds of their own.
    bounds = [(None, None)] * n + [(None, None), (-6.0, 3.0)]

    result = minimize(
        objective,
        initial,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": max_iter},
    )

    strength_vector = result.x[:n]
    lower, upper = unpack_cutpoints(float(result.x[n]), float(result.x[n + 1]))
    strength = {team: float(strength_vector[i]) for team, i in index.items()}

    return OrderedOutcomeModel(
        strength=strength,
        cutpoints=OrderedCutpoints(lower=lower, upper=upper, link=link),
        unknown_strength=default_strength(strength, teams),
    )

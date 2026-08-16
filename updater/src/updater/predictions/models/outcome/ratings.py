"""Existing rating systems mapped straight to results, skipping goals entirely.

These are the cleanest measurement in the whole comparison, because they hold the
ratings *fixed* and change only what is done with them.

`models.scoreline.elo` has a candid admission in its docstring: "a rating
difference is not in goal units and there is no principled conversion". It deals
with that by regressing goal difference on the rating gap, splitting the fitted
supremacy around a league-average total to get two Poisson rates, building a
matrix from them, and finally summing that matrix back down to three numbers.
Pi-ratings takes the same detour. Every step of that round trip is an assumption
(that supremacy splits symmetrically, that the halves are Poisson, that a fixed
rho applies) bolted onto a quantity the rating system never claimed to estimate.

Here the same pre-match rating gap goes through an ordered link instead, fit
directly against the outcomes. Three parameters, no goal model, no invented
conversion. If `direct-elo` beats `elo`, the round trip through goals was
costing accuracy; if it does not, the detour is harmless and the goal models earn
their scoreline output for free. Either result is worth knowing.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
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
    OrderedCutpoints,
    fit_scalar_ordered,
)


@dataclass
class RatingOutcomeModel:
    """A supremacy function plus the ordered link that turns it into results."""

    supremacy: Callable[[str, str], float]
    slope: float
    cutpoints: OrderedCutpoints
    produces_scoreline: bool = field(default=False, init=False)

    def predict_outcome(self, home_team: str, away_team: str) -> OutcomePrediction:
        eta = self.slope * self.supremacy(home_team, away_team)
        return outcome_from_probs(
            home_team, away_team, self.cutpoints.probabilities(eta)
        )


def _fit_link(
    matches: Sequence[MatchResult],
    covariate: np.ndarray,
    half_life_days: float,
    link: str,
) -> Optional[tuple[float, OrderedCutpoints]]:
    """Fit the ordered link on pre-match covariates and observed outcomes."""
    outcomes = np.array(
        [match_outcome(m.home_goals, m.away_goals) for m in matches], dtype=int
    )
    weights = time_weights(match_dates(list(matches)), half_life_days)
    return fit_scalar_ordered(covariate, outcomes, weights, link=link)


def fit_direct_elo(
    matches: Sequence[MatchResult],
    half_life_days: float = 365.0,
    link: str = "logit",
    **elo_params,
) -> Optional[RatingOutcomeModel]:
    """Elo ratings, read as results through an ordered link rather than goals."""
    from updater.predictions.models.scoreline.elo import (
        DEFAULT_HOME_ADVANTAGE,
        DEFAULT_RATING,
        elo_rating_pass,
    )

    if not matches:
        return None

    sweep = elo_rating_pass(matches, **elo_params)
    fitted = _fit_link(sweep.matches, sweep.rating_gaps, half_life_days, link)
    if fitted is None:
        return None
    slope, cutpoints = fitted

    rating = sweep.rating
    home_advantage = elo_params.get("home_advantage", DEFAULT_HOME_ADVANTAGE)

    def supremacy(home_team: str, away_team: str) -> float:
        # The same quantity the link was fit on, home advantage included: it is a
        # constant across fixtures, so it shifts eta uniformly and the cutpoints
        # simply absorb it.
        return (
            rating.get(home_team, DEFAULT_RATING)
            + home_advantage
            - rating.get(away_team, DEFAULT_RATING)
        )

    return RatingOutcomeModel(
        supremacy=supremacy, slope=slope, cutpoints=cutpoints
    )


def fit_direct_pi_ratings(
    matches: Sequence[MatchResult],
    half_life_days: float = 365.0,
    link: str = "logit",
    **pi_params,
) -> Optional[RatingOutcomeModel]:
    """Pi-ratings, read as results through an ordered link rather than goals."""
    from updater.predictions.models.scoreline.pi_ratings import pi_rating_pass

    if not matches:
        return None

    sweep = pi_rating_pass(matches, **pi_params)
    fitted = _fit_link(sweep.matches, sweep.supremacies, half_life_days, link)
    if fitted is None:
        return None
    slope, cutpoints = fitted

    home_rating = sweep.home_rating
    away_rating = sweep.away_rating

    def supremacy(home_team: str, away_team: str) -> float:
        # Unknown (promoted) teams rate 0, the league average, matching the
        # scoreline engine's convention.
        return home_rating.get(home_team, 0.0) - away_rating.get(away_team, 0.0)

    return RatingOutcomeModel(
        supremacy=supremacy, slope=slope, cutpoints=cutpoints
    )

"""A stacked ensemble whose blend weights are learned, not assumed.

The plain ensemble averages its members equally, which is a guess: it assumes a
weak member deserves the same say as a strong one. Stacking replaces the guess
with an estimate. The training window is split in two, members are fit on the
earlier part and scored on the later part, and the weights that minimise RPS on
that held-out tail are carried forward.

The split is chronological, never random. Members are fit only on matches that
precede the ones they are scored on, so the weights are chosen on genuinely
out-of-sample predictions. Random splitting would leak: a model fit on April
would be judged on March, and the whole point of the backtest is that no model
ever sees the future.

Weights are constrained to be non-negative and to sum to one, which keeps the
blend a proper mixture (so the result is still a valid distribution) and stops
the optimiser "improving" the fit by subtracting one member from another, which
overfits a short holdout badly.

Members are then refit on the *full* window before use, since the final model
should exploit all available data; only the weights come from the split.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np
from scipy.optimize import minimize

from updater.predictions.distributions import MatchResult
from updater.predictions.models.scoreline.ensemble import (
    EnsembleModel,
    _reject_outcome_members,
)

DEFAULT_MEMBERS = ("dixon-coles", "pi-ratings", "skellam")

# Share of the training window held out to score members on. Too small and the
# weights are noise; too large and the members are fit on too little.
HOLDOUT_FRACTION = 0.25

# The holdout must be big enough for the weights to mean anything.
MIN_HOLDOUT_MATCHES = 60


def _outcome(home_goals: int, away_goals: int) -> int:
    if home_goals > away_goals:
        return 0
    return 1 if home_goals == away_goals else 2


def _rps(probabilities: np.ndarray, actual: np.ndarray) -> float:
    """Mean ranked probability score over matches, vectorised.

    `probabilities` is (matches, 3) in home/draw/away order; `actual` holds the
    index of each observed outcome.
    """
    cumulative = np.cumsum(probabilities, axis=1)[:, :2]
    observed = np.zeros_like(probabilities)
    observed[np.arange(len(actual)), actual] = 1.0
    cumulative_observed = np.cumsum(observed, axis=1)[:, :2]
    return float(np.mean(np.sum((cumulative - cumulative_observed) ** 2, axis=1) / 2.0))


def _member_outcome_probabilities(model, matches: Sequence[MatchResult]) -> np.ndarray:
    from updater.predictions.models import predict_fixture

    rows = []
    for match in matches:
        prediction = predict_fixture(
            model, match.home_team, match.away_team, match_date=match.date
        )
        rows.append(
            [prediction.prob_home_win, prediction.prob_draw, prediction.prob_away_win]
        )
    return np.array(rows)


def solve_weights(member_probabilities: np.ndarray, actual: np.ndarray) -> np.ndarray:
    """Find the non-negative, sum-to-one weights minimising blended RPS.

    `member_probabilities` is (members, matches, 3).
    """
    n_members = member_probabilities.shape[0]
    if n_members == 1:
        return np.ones(1)

    def objective(raw: np.ndarray) -> float:
        weights = raw / raw.sum()
        blended = np.tensordot(weights, member_probabilities, axes=(0, 0))
        return _rps(blended, actual)

    initial = np.full(n_members, 1.0 / n_members)
    result = minimize(
        objective,
        initial,
        method="SLSQP",
        bounds=[(1e-6, 1.0)] * n_members,
        constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1.0}],
        options={"maxiter": 200, "ftol": 1e-10},
    )

    weights = np.clip(result.x, 1e-6, None)
    return weights / weights.sum()


@dataclass
class StackedModel(EnsembleModel):
    """An ensemble carrying the weights that won on the holdout."""

    holdout_size: int = 0


def fit_stacked(
    matches: Sequence[MatchResult],
    member_names: Sequence[str] = DEFAULT_MEMBERS,
    half_life_days: float = 365.0,
) -> Optional[StackedModel]:
    """Learn blend weights on a chronological holdout, then refit on everything."""
    from updater.predictions import models as registry

    if not matches:
        return None
    if "stacked" in member_names or "ensemble" in member_names:
        raise ValueError("A stacked ensemble cannot contain an ensemble")
    _reject_outcome_members(member_names, registry)

    ordered = sorted(matches, key=lambda m: m.date)
    split = int(len(ordered) * (1.0 - HOLDOUT_FRACTION))
    train, holdout = ordered[:split], ordered[split:]

    def fit_all(subset: Sequence[MatchResult]) -> list:
        fitted = []
        for name in member_names:
            model = registry.build(name, half_life_days=half_life_days).fit(subset)
            fitted.append(model)
        return fitted

    final_members = [m for m in fit_all(ordered) if m is not None]
    if not final_members:
        return None

    # Not enough holdout to learn anything trustworthy: fall back to equal
    # weights rather than fitting three parameters to a handful of matches.
    if len(holdout) < MIN_HOLDOUT_MATCHES or not train:
        return StackedModel(
            members=final_members,
            # Normalised, so the stored weights are always a readable mixture
            # rather than raw counts that only mean something after division.
            weights=[1.0 / len(final_members)] * len(final_members),
            holdout_size=len(holdout),
        )

    holdout_models = fit_all(train)
    usable = [
        (name, model)
        for name, model in zip(member_names, holdout_models)
        if model is not None
    ]
    if len(usable) != len(final_members):
        # A member that fits on the full window but not the shorter one cannot be
        # weighted honestly, so fall back rather than guess.
        return StackedModel(
            members=final_members,
            # Normalised, so the stored weights are always a readable mixture
            # rather than raw counts that only mean something after division.
            weights=[1.0 / len(final_members)] * len(final_members),
            holdout_size=len(holdout),
        )

    probabilities = np.array(
        [_member_outcome_probabilities(model, holdout) for _, model in usable]
    )
    actual = np.array([_outcome(m.home_goals, m.away_goals) for m in holdout])

    weights = solve_weights(probabilities, actual)

    return StackedModel(
        members=final_members,
        weights=[float(w) for w in weights],
        holdout_size=len(holdout),
    )

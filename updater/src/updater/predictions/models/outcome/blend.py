"""A cross-family blend: a goal model and a result model pooled together.

This is the entrant that tests the interesting hypothesis. If the scoreline and
outcome families are just two roads to the same forecast, a blend of them lands
between the two and beats neither. If they carry genuinely different information,
because one learns from the margin of victory and the other fits the draw rate
directly, then the blend beats both members and the two families are worth
keeping side by side.

The weights are learned the same way `models.scoreline.stacked` learns its own,
on a chronological holdout rather than in sample, and that machinery is imported
rather than re-implemented. The difference is the currency: stacked pools full
scoreline matrices and can only mix members that produce them, whereas this pools
the three outcome probabilities, which every engine in either family can supply.
Pooling in outcome space is what makes a cross-family blend possible at all.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence

import numpy as np

from updater.predictions.distributions import (
    MatchResult,
    OutcomePrediction,
    match_outcome,
    outcome_from_probs,
)
from updater.predictions.models.scoreline.stacked import (
    HOLDOUT_FRACTION,
    MIN_HOLDOUT_MATCHES,
    solve_weights,
)

# One member from each family, the strongest of each at the time of writing.
DEFAULT_MEMBERS = ("dixon-coles", "ordered-logit")


@dataclass
class OutcomeBlendModel:
    """Member models and the weights their outcome probabilities are mixed with."""

    members: list
    weights: list[float]
    member_names: list[str] = field(default_factory=list)
    holdout_size: int = 0
    produces_scoreline: bool = field(default=False, init=False)

    def predict_outcome(self, home_team: str, away_team: str) -> OutcomePrediction:
        from updater.predictions.models import predict_outcome

        blended = np.zeros(3)
        for weight, member in zip(self.weights, self.members):
            prediction = predict_outcome(member, home_team, away_team)
            blended += weight * np.array(prediction.probs)
        return outcome_from_probs(home_team, away_team, blended)


def _member_probabilities(model, matches: Sequence[MatchResult]) -> np.ndarray:
    from updater.predictions.models import predict_outcome

    return np.array(
        [
            predict_outcome(
                model, match.home_team, match.away_team, match_date=match.date
            ).probs
            for match in matches
        ]
    )


def fit_outcome_blend(
    matches: Sequence[MatchResult],
    member_names: Sequence[str] = DEFAULT_MEMBERS,
    half_life_days: float = 365.0,
) -> Optional[OutcomeBlendModel]:
    """Learn mixing weights on a chronological holdout, then refit on everything."""
    from updater.predictions import models as registry

    if not matches:
        return None
    if any(name in ("outcome-blend", "stacked", "ensemble") for name in member_names):
        raise ValueError("A blend cannot contain another blend or ensemble")

    ordered = sorted(matches, key=lambda m: m.date)
    split = int(len(ordered) * (1.0 - HOLDOUT_FRACTION))
    train, holdout = ordered[:split], ordered[split:]

    def fit_all(subset: Sequence[MatchResult]) -> list:
        return [
            registry.build(name, half_life_days=half_life_days).fit(subset)
            for name in member_names
        ]

    final = [
        (name, model)
        for name, model in zip(member_names, fit_all(ordered))
        if model is not None
    ]
    if not final:
        return None

    def equal_weighted() -> OutcomeBlendModel:
        return OutcomeBlendModel(
            members=[model for _, model in final],
            weights=[1.0 / len(final)] * len(final),
            member_names=[name for name, _ in final],
            holdout_size=len(holdout),
        )

    # Too little holdout to learn a weight that means anything, so split evenly
    # rather than fit a mixture to a handful of matches.
    if len(holdout) < MIN_HOLDOUT_MATCHES or not train:
        return equal_weighted()

    holdout_models = [
        (name, model)
        for name, model in zip(member_names, fit_all(train))
        if model is not None
    ]
    # A member that fits the full window but not the shorter one cannot be
    # weighted honestly, so fall back rather than guess.
    if len(holdout_models) != len(final):
        return equal_weighted()

    probabilities = np.array(
        [_member_probabilities(model, holdout) for _, model in holdout_models]
    )
    actual = np.array([match_outcome(m.home_goals, m.away_goals) for m in holdout])

    weights = solve_weights(probabilities, actual)

    return OutcomeBlendModel(
        members=[model for _, model in final],
        weights=[float(w) for w in weights],
        member_names=[name for name, _ in final],
        holdout_size=len(holdout),
    )

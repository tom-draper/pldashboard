"""An ensemble that averages several engines' scoreline matrices.

Not a model of football at all, but usually one of the hardest things to beat.
Different engines make different mistakes, and averaging their distributions
cancels part of the disagreement while keeping what they agree on. It is the
cheapest way to find out whether the individual models are wrong in *different*
ways, which the leaderboard alone cannot tell you: if the ensemble beats every
member, their errors are partly independent and there is signal being wasted; if
it lands in the middle, they are all making the same mistake and the model class
really is the ceiling.

Averaging is done cell-wise on the joint matrices, which keeps the result a valid
distribution and keeps the marginals and outcome probabilities consistent with it
(a linear mixture of distributions is a distribution). Note this is the arithmetic
mean, deliberately: it is the more forgiving choice, since one member assigning a
near-zero probability cannot veto the others the way a geometric mean would.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np

from updater.predictions.distributions import (
    MatchResult,
    ScorePrediction,
    prediction_from_matrix,
)


@dataclass
class EnsembleModel:
    """Several fitted models, averaged with optional per-member weights."""

    members: list
    weights: list[float]

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        prediction = self.predict(home_team, away_team)
        return prediction.expected_home_goals, prediction.expected_away_goals

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        total_weight = sum(self.weights)
        combined: Optional[np.ndarray] = None

        for member, weight in zip(self.members, self.weights):
            matrix = np.array(
                member.predict(home_team, away_team, max_goals).scoreline_matrix
            )
            contribution = matrix * (weight / total_weight)
            combined = contribution if combined is None else combined + contribution

        assert combined is not None  # members is non-empty by construction
        return prediction_from_matrix(home_team, away_team, combined)


def fit_ensemble(
    matches: Sequence[MatchResult],
    member_names: Sequence[str] = ("dixon-coles", "pi-ratings", "skellam"),
    weights: Optional[Sequence[float]] = None,
    half_life_days: float = 365.0,
) -> Optional[EnsembleModel]:
    """Fit each member on the same matches; drop any that fail to fit.

    The default members are picked to disagree: a goals-likelihood fit, an online
    rating system, and a difference-only fit. Averaging near-identical models
    would be pointless, so the value comes from the spread.
    """
    from updater.predictions import models as registry

    if not matches:
        return None

    if "ensemble" in member_names:
        raise ValueError("An ensemble cannot contain itself")

    member_weights = list(weights) if weights else [1.0] * len(member_names)
    if len(member_weights) != len(member_names):
        raise ValueError("weights must match member_names in length")

    fitted = []
    kept_weights = []
    for name, weight in zip(member_names, member_weights):
        model = registry.build(name, half_life_days=half_life_days).fit(matches)
        if model is not None:
            fitted.append(model)
            kept_weights.append(weight)

    if not fitted:
        return None
    return EnsembleModel(members=fitted, weights=kept_weights)

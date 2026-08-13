"""Shared prediction protocols and family-neutral prediction helpers."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Optional, Protocol, runtime_checkable

from updater.predictions.distributions import (
    MatchResult,
    OutcomePrediction,
    ScorePrediction,
    outcome_of,
)


@runtime_checkable
class FittedModel(Protocol):
    """Anything that can turn a fixture into a scoreline distribution."""

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction: ...


@runtime_checkable
class FittedOutcomeModel(Protocol):
    """Anything that can turn a fixture into home/draw/away probabilities."""

    def predict_outcome(
        self, home_team: str, away_team: str
    ) -> OutcomePrediction: ...


def predict_fixture(
    model: FittedModel,
    home_team: str,
    away_team: str,
    match_date=None,
    max_goals: int = 10,
) -> ScorePrediction:
    """Predict a fixture, passing the kickoff date only to models that need it."""
    if getattr(model, "uses_match_date", False):
        return model.predict(
            home_team, away_team, max_goals=max_goals, match_date=match_date
        )
    return model.predict(home_team, away_team, max_goals)


def produces_scoreline(model) -> bool:
    """Whether a fitted model can produce a full goal matrix."""
    return getattr(model, "produces_scoreline", True)


def predict_outcome(
    model,
    home_team: str,
    away_team: str,
    match_date=None,
    max_goals: int = 10,
) -> OutcomePrediction:
    """Get home/draw/away probabilities from either prediction family."""
    direct = getattr(model, "predict_outcome", None)
    if direct is not None:
        if getattr(model, "uses_match_date", False):
            return direct(home_team, away_team, match_date=match_date)
        return direct(home_team, away_team)
    return outcome_of(
        predict_fixture(model, home_team, away_team, match_date, max_goals)
    )


class Predictor(Protocol):
    """An engine with its hyper-parameters already bound."""

    name: str

    def fit(self, matches: Sequence[MatchResult]) -> Optional[FittedModel]: ...

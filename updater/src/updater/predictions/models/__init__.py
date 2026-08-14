"""Public API for interchangeable prediction engines.

Engine construction lives in :mod:`.factories`, while this module exposes the
small, stable contract used by prediction and backtest callers. Keeping the
facade free of implementations means importing the registry does not pull in
the scipy-heavy model modules.
"""

from updater.predictions.models.contracts import (
    FittedModel as FittedModel,
    FittedOutcomeModel as FittedOutcomeModel,
    Predictor as Predictor,
    predict_fixture as predict_fixture,
    predict_outcome as predict_outcome,
    produces_scoreline as produces_scoreline,
)
from updater.predictions.models.registry import (
    DEFAULT_MODEL as DEFAULT_MODEL,
    FAMILIES as FAMILIES,
    NAIVE_MODELS as NAIVE_MODELS,
    OUTCOME as OUTCOME,
    SCORELINE as SCORELINE,
    available as available,
    build as build,
    family_of as family_of,
)

__all__ = [
    "DEFAULT_MODEL",
    "FAMILIES",
    "NAIVE_MODELS",
    "OUTCOME",
    "SCORELINE",
    "FittedModel",
    "FittedOutcomeModel",
    "Predictor",
    "available",
    "build",
    "family_of",
    "predict_fixture",
    "predict_outcome",
    "produces_scoreline",
]

"""Public API for interchangeable prediction engines.

Engine construction lives in :mod:`.factories`, while this module exposes the
small, stable contract used by prediction and backtest callers. Keeping the
facade free of implementations means importing the registry does not pull in
the scipy-heavy model modules.
"""

from updater.predictions.models.contracts import (
    FittedModel,
    FittedOutcomeModel,
    Predictor,
    predict_fixture,
    predict_outcome,
    produces_scoreline,
)
from updater.predictions.models.registry import (
    DEFAULT_MODEL,
    FAMILIES,
    NAIVE_MODELS,
    OUTCOME,
    SCORELINE,
    available,
    build,
    family_of,
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

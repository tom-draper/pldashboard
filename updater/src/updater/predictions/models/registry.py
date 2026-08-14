"""Public model registry, kept separate from the engine factory definitions.

The factories remain deliberately lazy in :mod:`updater.predictions.models` so
loading the registry never imports every scipy/DataFrame-heavy implementation.
Looking them up through ``import_module`` also keeps fitted model modules from
forming an import cycle back to the package initializer.
"""

from __future__ import annotations

from importlib import import_module
from typing import Optional

SCORELINE = "scoreline"
OUTCOME = "outcome"
FAMILIES = (SCORELINE, OUTCOME)

# Naive entrants kept as a floor to clear, not as production candidates.
NAIVE_MODELS = ("empirical-scoreline", "goal-average")

# The engine the updater ships with. It must stay a scoreline model because the
# dashboard stores a goal matrix.
DEFAULT_MODEL = "dixon-coles"


def _registries():
    factories = import_module("updater.predictions.models.factories")
    scoreline = {
        "dixon-coles": factories._dixon_coles,
        "poisson": factories._poisson,
        "bivariate-poisson": factories._bivariate_poisson,
        "negative-binomial": factories._negative_binomial,
        "skellam": factories._skellam,
        "hierarchical": factories._hierarchical,
        "extended-dc": factories._extended_dc,
        "dynamic": factories._dynamic,
        "pi-ratings": factories._pi_ratings,
        "elo": factories._elo,
        "ensemble": factories._ensemble,
        "stacked": factories._stacked,
        "empirical-scoreline": factories._empirical_scoreline,
        "goal-average": factories._goal_average,
    }
    outcome = {
        "ordered-logit": factories._ordered_logit,
        "ordered-probit": factories._ordered_probit,
        "multinomial": factories._multinomial,
        "direct-elo": factories._direct_elo,
        "direct-pi-ratings": factories._direct_pi_ratings,
        "outcome-blend": factories._outcome_blend,
    }
    return scoreline, outcome


def family_of(name: str) -> str:
    """Which family a registry name belongs to."""
    scoreline, outcome = _registries()
    if name in scoreline:
        return SCORELINE
    if name in outcome:
        return OUTCOME
    raise ValueError(f"Unknown model {name!r}. Available: {', '.join(available())}")


def available(family: Optional[str] = None) -> list[str]:
    """Registry names, optionally restricted to one family."""
    scoreline, outcome = _registries()
    if family is None:
        return [*scoreline, *outcome]
    if family == SCORELINE:
        return list(scoreline)
    if family == OUTCOME:
        return list(outcome)
    raise ValueError(f"Unknown family {family!r}. Available: {', '.join(FAMILIES)}")


def build(name: str, **params):
    """Construct an engine by registry name with its hyper-parameters bound."""
    scoreline, outcome = _registries()
    try:
        factory = scoreline.get(name) or outcome[name]
    except KeyError:
        raise ValueError(
            f"Unknown model {name!r}. Available: {', '.join(available())}"
        ) from None
    return factory(**params)

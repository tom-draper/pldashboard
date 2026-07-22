"""A registry of interchangeable prediction engines, in two families.

Every engine answers the same first question: given a list of finished matches,
produce a fitted model. They differ in what they then forecast, and the registry
holds both kinds in one namespace:

    * **scoreline** (`models.scoreline`) - a full home-goals x away-goals
      matrix. Home/draw/away falls out of summing it. This is what the dashboard
      stores, so only these are eligible for production.
    * **outcome** (`models.outcome`) - home/draw/away directly, with no goal
      model underneath. Benchmarking entrants only; they cannot fill a scoreline
      heatmap and `build_v3` rejects them.

Both answer `predict_outcome`, which is what the backtest scores, so the two
families compete on exactly the same footing on exactly the same fixtures.

Engines are constructed through `build(name, **params)` and listed by
`available()`, optionally filtered to one family. Imports are deferred into the
factories so that pulling in the registry does not drag scipy-heavy modules (or
predict_v2's DataFrame chain) into every caller.
"""

from __future__ import annotations

from typing import Callable, Optional, Protocol, Sequence, runtime_checkable

from updater.predictions.distributions import (
    MatchResult,
    OutcomePrediction,
    ScorePrediction,
    outcome_of,
)

SCORELINE = "scoreline"
OUTCOME = "outcome"


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
    """Predict a fixture, passing the kickoff date only to models that want it.

    Most engines depend on nothing but the two team names. A few (rest and
    fixture congestion) need to know *when* the match is played. Rather than
    widen every engine's signature for the sake of two, a model opts in by
    setting `uses_match_date = True` and accepting a `match_date` keyword.
    """
    if getattr(model, "uses_match_date", False):
        return model.predict(
            home_team, away_team, max_goals=max_goals, match_date=match_date
        )
    return model.predict(home_team, away_team, max_goals)


def produces_scoreline(model) -> bool:
    """Whether a fitted model can produce a full goal matrix.

    Outcome-family models set `produces_scoreline = False` on the class. Anything
    that does not say otherwise is a scoreline model, which keeps every existing
    engine working without having to annotate it.
    """
    return getattr(model, "produces_scoreline", True)


def predict_outcome(
    model,
    home_team: str,
    away_team: str,
    match_date=None,
    max_goals: int = 10,
) -> OutcomePrediction:
    """Home/draw/away for a fixture, from either family of engine.

    This is the common currency the backtest scores on. An outcome model answers
    directly; a scoreline model is asked for its matrix and collapsed. Going
    through one function means a caller never has to know which family it holds.
    """
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


class _Engine:
    """Binds a fit function and its parameters behind the Predictor protocol."""

    def __init__(self, name: str, fit_fn: Callable[..., Optional[FittedModel]], **params):
        self.name = name
        self._fit_fn = fit_fn
        self._params = params

    def fit(self, matches: Sequence[MatchResult]) -> Optional[FittedModel]:
        return self._fit_fn(list(matches), **self._params)

    def __repr__(self) -> str:
        return f"<{self.name} {self._params}>"


def _dixon_coles(half_life_days: float = 365.0, xg_weight: float = 0.0, **_) -> Predictor:
    from updater.predictions.models.scoreline.dixon_coles import fit_dixon_coles

    return _Engine(
        "dixon-coles",
        fit_dixon_coles,
        half_life_days=half_life_days,
        xg_weight=xg_weight,
    )


def _poisson(half_life_days: float = 365.0, **_) -> Predictor:
    """Dixon-Coles with rho pinned at 0: the independent-Poisson ablation."""
    from updater.predictions.models.scoreline.dixon_coles import fit_dixon_coles

    return _Engine(
        "poisson",
        fit_dixon_coles,
        half_life_days=half_life_days,
        fit_rho=False,
    )


def _bivariate_poisson(half_life_days: float = 365.0, **_) -> Predictor:
    import numpy as np

    from updater.predictions.models.scoreline.common import fit_ratings
    from updater.predictions.models.scoreline.poisson_family import (
        BivariatePoissonModel,
        _bivariate_log_pmf,
    )

    def log_likelihood(home_goals, away_goals, lambda_home, lambda_away, extra):
        return _bivariate_log_pmf(
            home_goals, away_goals, lambda_home, lambda_away, float(np.exp(extra[0]))
        )

    def fit(matches, **kwargs):
        # extra[0] is log(lambda_shared), bounded well below the typical goal
        # rate: the shared component is a correlation term, not a third team.
        ratings = fit_ratings(
            matches,
            log_likelihood,
            extra_initial=[np.log(0.05)],
            extra_bounds=[(np.log(1e-4), np.log(0.6))],
            **kwargs,
        )
        if ratings is None:
            return None
        return BivariatePoissonModel(
            ratings=ratings, lambda_shared=float(np.exp(ratings.extra[0]))
        )

    return _Engine("bivariate-poisson", fit, half_life_days=half_life_days)


def _negative_binomial(half_life_days: float = 365.0, **_) -> Predictor:
    import numpy as np

    from updater.predictions.models.scoreline.common import fit_ratings
    from updater.predictions.models.scoreline.poisson_family import (
        NegativeBinomialModel,
        _negative_binomial_log_pmf,
    )

    def log_likelihood(home_goals, away_goals, lambda_home, lambda_away, extra):
        size = float(np.exp(extra[0]))
        return _negative_binomial_log_pmf(
            home_goals, lambda_home, size
        ) + _negative_binomial_log_pmf(away_goals, lambda_away, size)

    def fit(matches, **kwargs):
        # extra[0] is log(size). Large size means little overdispersion, so the
        # upper bound is where the model is Poisson to within rounding.
        ratings = fit_ratings(
            matches,
            log_likelihood,
            extra_initial=[np.log(8.0)],
            extra_bounds=[(np.log(0.5), np.log(500.0))],
            **kwargs,
        )
        if ratings is None:
            return None
        return NegativeBinomialModel(
            ratings=ratings, size=float(np.exp(ratings.extra[0]))
        )

    return _Engine("negative-binomial", fit, half_life_days=half_life_days)


def _skellam(half_life_days: float = 365.0, **_) -> Predictor:
    """Rates fit to the goal difference alone, via the Skellam likelihood."""
    from updater.predictions.models.scoreline.common import fit_ratings
    from updater.predictions.models.scoreline.skellam import SkellamModel, skellam_log_pmf

    def log_likelihood(home_goals, away_goals, lambda_home, lambda_away, _extra):
        return skellam_log_pmf(home_goals - away_goals, lambda_home, lambda_away)

    def fit(matches, **kwargs):
        ratings = fit_ratings(matches, log_likelihood, **kwargs)
        return None if ratings is None else SkellamModel(ratings=ratings)

    return _Engine("skellam", fit, half_life_days=half_life_days)


def _hierarchical(half_life_days: float = 365.0, **_) -> Predictor:
    """Dixon-Coles whose shrinkage strength is learned, not assumed."""
    from updater.predictions.models.scoreline.hierarchical import fit_hierarchical

    return _Engine("hierarchical", fit_hierarchical, half_life_days=half_life_days)


def _elo(half_life_days: float = 365.0, **_) -> Predictor:
    from updater.predictions.models.scoreline.elo import fit_elo

    return _Engine("elo", fit_elo, half_life_days=half_life_days)


def _ensemble(half_life_days: float = 365.0, members=None, **_) -> Predictor:
    from updater.predictions.models.scoreline.ensemble import fit_ensemble

    params = {"half_life_days": half_life_days}
    if members is not None:
        params["member_names"] = tuple(members)
    return _Engine("ensemble", fit_ensemble, **params)


def _extended_dc(half_life_days: float = 365.0, **_) -> Predictor:
    """Dixon-Coles plus rest days and a per-team home advantage."""
    from updater.predictions.models.scoreline.extended_dc import fit_extended_dixon_coles

    return _Engine(
        "extended-dc", fit_extended_dixon_coles, half_life_days=half_life_days
    )


def _dynamic(half_life_days: float = 365.0, **_) -> Predictor:
    """Ratings that follow a random walk, filtered match by match."""
    from updater.predictions.models.scoreline.dynamic import fit_dynamic

    return _Engine("dynamic", fit_dynamic, half_life_days=half_life_days)


def _stacked(half_life_days: float = 365.0, members=None, **_) -> Predictor:
    from updater.predictions.models.scoreline.stacked import fit_stacked

    params = {"half_life_days": half_life_days}
    if members is not None:
        params["member_names"] = tuple(members)
    return _Engine("stacked", fit_stacked, **params)


def _empirical_scoreline(half_life_days: float = 365.0, **_) -> Predictor:
    """Team-blind league scoreline frequencies: the floor for exact accuracy."""
    from updater.predictions.models.scoreline.naive import fit_empirical_scoreline

    return _Engine(
        "empirical-scoreline", fit_empirical_scoreline, half_life_days=half_life_days
    )


def _goal_average(half_life_days: float = 365.0, **_) -> Predictor:
    """Attack / defence strengths as ratios, with no likelihood or optimiser."""
    from updater.predictions.models.scoreline.naive import fit_goal_average

    return _Engine("goal-average", fit_goal_average, half_life_days=half_life_days)


def _pi_ratings(half_life_days: float = 365.0, **_) -> Predictor:
    from updater.predictions.models.scoreline.pi_ratings import fit_pi_ratings

    return _Engine("pi-ratings", fit_pi_ratings, half_life_days=half_life_days)


def _ordered_logit(half_life_days: float = 365.0, **_) -> Predictor:
    """Ordered logit on team strengths: the flagship direct-outcome engine."""
    from updater.predictions.models.outcome.ordered import fit_ordered

    return _Engine(
        "ordered-logit", fit_ordered, link="logit", half_life_days=half_life_days
    )


def _ordered_probit(half_life_days: float = 365.0, **_) -> Predictor:
    """The same model under a normal latent noise assumption instead of logistic."""
    from updater.predictions.models.outcome.ordered import fit_ordered

    return _Engine(
        "ordered-probit", fit_ordered, link="probit", half_life_days=half_life_days
    )


def _multinomial(half_life_days: float = 365.0, **_) -> Predictor:
    """Softmax over the three results, dropping the ordinality assumption."""
    from updater.predictions.models.outcome.multinomial import fit_multinomial

    return _Engine("multinomial", fit_multinomial, half_life_days=half_life_days)


def _direct_elo(half_life_days: float = 365.0, **_) -> Predictor:
    """Elo ratings read through an ordered link rather than converted to goals."""
    from updater.predictions.models.outcome.ratings import fit_direct_elo

    return _Engine("direct-elo", fit_direct_elo, half_life_days=half_life_days)


def _direct_pi_ratings(half_life_days: float = 365.0, **_) -> Predictor:
    """Pi-ratings read through an ordered link rather than converted to goals."""
    from updater.predictions.models.outcome.ratings import fit_direct_pi_ratings

    return _Engine(
        "direct-pi-ratings", fit_direct_pi_ratings, half_life_days=half_life_days
    )


def _outcome_blend(half_life_days: float = 365.0, members=None, **_) -> Predictor:
    """A goal model and a result model pooled on a chronological holdout."""
    from updater.predictions.models.outcome.blend import fit_outcome_blend

    params = {"half_life_days": half_life_days}
    if members is not None:
        params["member_names"] = tuple(members)
    return _Engine("outcome-blend", fit_outcome_blend, **params)


SCORELINE_REGISTRY: dict[str, Callable[..., Predictor]] = {
    "dixon-coles": _dixon_coles,
    "poisson": _poisson,
    "bivariate-poisson": _bivariate_poisson,
    "negative-binomial": _negative_binomial,
    "skellam": _skellam,
    "hierarchical": _hierarchical,
    "extended-dc": _extended_dc,
    "dynamic": _dynamic,
    "pi-ratings": _pi_ratings,
    "elo": _elo,
    "ensemble": _ensemble,
    "stacked": _stacked,
    "empirical-scoreline": _empirical_scoreline,
    "goal-average": _goal_average,
}

OUTCOME_REGISTRY: dict[str, Callable[..., Predictor]] = {
    "ordered-logit": _ordered_logit,
    "ordered-probit": _ordered_probit,
    "multinomial": _multinomial,
    "direct-elo": _direct_elo,
    "direct-pi-ratings": _direct_pi_ratings,
    "outcome-blend": _outcome_blend,
}

REGISTRY: dict[str, Callable[..., Predictor]] = {
    **SCORELINE_REGISTRY,
    **OUTCOME_REGISTRY,
}

FAMILIES = (SCORELINE, OUTCOME)

# Naive entrants kept as a floor to clear, not as production candidates.
NAIVE_MODELS = ("empirical-scoreline", "goal-average")

# The engine the updater ships with, and the one the backtest compares against.
# It must stay a scoreline model: the dashboard stores a goal matrix.
DEFAULT_MODEL = "dixon-coles"


def family_of(name: str) -> str:
    """Which family a registry name belongs to."""
    return SCORELINE if name in SCORELINE_REGISTRY else OUTCOME


def available(family: Optional[str] = None) -> list[str]:
    """Registry names, optionally restricted to one family."""
    if family is None:
        return list(REGISTRY)
    if family == SCORELINE:
        return list(SCORELINE_REGISTRY)
    if family == OUTCOME:
        return list(OUTCOME_REGISTRY)
    raise ValueError(f"Unknown family {family!r}. Available: {', '.join(FAMILIES)}")


def build(name: str, **params) -> Predictor:
    """Construct an engine by registry name with its hyper-parameters bound."""
    try:
        factory = REGISTRY[name]
    except KeyError:
        raise ValueError(
            f"Unknown model {name!r}. Available: {', '.join(available())}"
        ) from None
    return factory(**params)

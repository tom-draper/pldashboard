"""Lazy constructors for the prediction-engine registry.

Every engine answers the same first question: given a list of finished matches,
produce a fitted model. They differ in what they then forecast, and the registry
holds both kinds in one namespace:

    * **scoreline** (`models.scoreline`) - a full home-goals x away-goals
      matrix. Home/draw/away falls out of summing it. This is what the dashboard
      stores, so only these are eligible for production.
    * **outcome** (`models.outcome`) - home/draw/away directly, with no goal
      model underneath. Benchmarking entrants only; they cannot fill a scoreline
      heatmap and `model_predictions` rejects them.

Implementations are imported inside each factory so inspecting the public
registry does not eagerly load scipy-heavy models or the DataFrame chain.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Optional

from updater.predictions.distributions import MatchResult
from updater.predictions.models.contracts import FittedModel


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
    from updater.predictions.models.scoreline.skellam import (
        SkellamModel,
        skellam_log_pmf,
    )

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
    from updater.predictions.models.scoreline.extended_dc import (
        fit_extended_dixon_coles,
    )

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

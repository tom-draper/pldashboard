"""Shared fitting machinery for attack/defence rating models.

Dixon-Coles, bivariate Poisson and negative binomial all share the same skeleton:
each team gets an attack and a defence rating, a shared home-advantage term lifts
the home side, and the two scoring rates for a fixture are

    lambda_home = exp(attack[home] - defence[away] + home_advantage)
    lambda_away = exp(attack[away] - defence[home])

They differ only in the *likelihood* placed on the observed goals given those two
rates, plus a handful of model-specific parameters (the DC rho, the bivariate
covariance, the negative-binomial dispersion). `fit_ratings` owns the shared part
and takes the rest as a callback, so a new model is a likelihood function rather
than another copy of the optimiser setup.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from scipy.optimize import minimize

from updater.predictions.distributions import (
    MatchResult,
    match_dates,
    time_weights,
)

# (home_goals, away_goals, lambda_home, lambda_away, extra) -> per-match log-lik.
# `extra` holds the model-specific parameters, in the order given to fit_ratings.
LogLikelihood = Callable[
    [np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray], np.ndarray
]


@dataclass
class FittedRatings:
    """Fitted attack / defence ratings plus home advantage and model extras."""

    teams: list[str]
    attack: dict[str, float]
    defence: dict[str, float]
    home_advantage: float
    # Ratings for a team the model has never seen (typically newly promoted),
    # taken from the weakest sides in the training window.
    default_attack: float = 0.0
    default_defence: float = 0.0
    extra: np.ndarray = field(default_factory=lambda: np.zeros(0))

    def rating(self, team: str) -> tuple[float, float]:
        return (
            self.attack.get(team, self.default_attack),
            self.defence.get(team, self.default_defence),
        )

    def rates(self, home_team: str, away_team: str) -> tuple[float, float]:
        """The (home, away) Poisson rates for a fixture."""
        home_attack, home_defence = self.rating(home_team)
        away_attack, away_defence = self.rating(away_team)
        return (
            float(np.exp(home_attack - away_defence + self.home_advantage)),
            float(np.exp(away_attack - home_defence)),
        )


def fit_ratings(
    matches: Sequence[MatchResult],
    log_likelihood: LogLikelihood,
    extra_initial: Sequence[float] = (),
    extra_bounds: Sequence[tuple[Optional[float], Optional[float]]] = (),
    half_life_days: float = 365.0,
    regularisation: float = 1e-3,
    max_iter: int = 200,
) -> Optional[FittedRatings]:
    """Maximise a weighted likelihood over team ratings plus model extras.

    Returns None when there is nothing to fit. Older matches are exponentially
    down-weighted (`half_life_days`). The rating vectors are identified only up
    to a joint shift of all attacks and defences, which leaves every prediction
    unchanged; a light L2 penalty pins that direction and steadies the optimiser
    on short samples.
    """
    if not matches:
        return None

    teams = sorted({m.home_team for m in matches} | {m.away_team for m in matches})
    index = {team: i for i, team in enumerate(teams)}
    n = len(teams)

    home_idx = np.array([index[m.home_team] for m in matches])
    away_idx = np.array([index[m.away_team] for m in matches])
    home_goals = np.array([float(m.home_goals) for m in matches])
    away_goals = np.array([float(m.away_goals) for m in matches])
    weights = time_weights(match_dates(list(matches)), half_life_days)

    n_extra = len(extra_initial)

    def unpack(params: np.ndarray):
        return (
            params[:n],
            params[n : 2 * n],
            params[2 * n],
            params[2 * n + 1 :],
        )

    def negative_log_likelihood(params: np.ndarray) -> float:
        attack, defence, home_advantage, extra = unpack(params)

        lambda_home = np.exp(attack[home_idx] - defence[away_idx] + home_advantage)
        lambda_away = np.exp(attack[away_idx] - defence[home_idx])

        per_match = log_likelihood(
            home_goals, away_goals, lambda_home, lambda_away, extra
        )
        total = np.sum(weights * per_match)
        penalty = regularisation * (np.sum(attack**2) + np.sum(defence**2))
        return -total + penalty

    initial = np.concatenate([np.zeros(n), np.zeros(n), [0.3], list(extra_initial)])
    bounds = (
        [(None, None)] * (2 * n) + [(-1.0, 2.0)] + list(extra_bounds)
    )
    assert len(bounds) == 2 * n + 1 + n_extra

    result = minimize(
        negative_log_likelihood,
        initial,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": max_iter},
    )

    attack_vec, defence_vec, home_advantage, extra = unpack(result.x)
    attack = {team: float(attack_vec[i]) for team, i in index.items()}
    defence = {team: float(defence_vec[i]) for team, i in index.items()}

    # Prior for unseen (promoted) teams: the mean rating of the weakest few
    # sides, ranked by overall strength (attack + defence).
    weakest = sorted(teams, key=lambda t: attack[t] + defence[t])[: min(3, n)]

    return FittedRatings(
        teams=teams,
        attack=attack,
        defence=defence,
        home_advantage=float(home_advantage),
        default_attack=float(np.mean([attack[t] for t in weakest])),
        default_defence=float(np.mean([defence[t] for t in weakest])),
        extra=np.asarray(extra, dtype=float),
    )

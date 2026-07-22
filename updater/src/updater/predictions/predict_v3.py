"""Dixon-Coles scoreline model (predictions v3).

A statistical goals model, in contrast to v2's empirical scoreline pooling. Each
team gets an attack and a defence rating; a shared home-advantage term lifts the
home side. For a fixture these give two expected-goal rates::

    lambda_home = exp(attack[home] - defence[away] + home_adv)
    lambda_away = exp(attack[away] - defence[home])

Goals are then close to independent Poisson draws, with the Dixon-Coles low-score
correction (rho) fixing the well-known dependence in 0-0 / 1-0 / 0-1 / 1-1 games.
Ratings are fit by maximum likelihood over recent matches, exponentially
down-weighting older games (a configurable half-life) so current form dominates.

From the fitted model a fixture yields a full home-goals x away-goals probability
matrix, and everything the dashboard needs falls out of it:

    * marginal home-goals and away-goals distributions (row / column sums)
    * home / draw / away outcome probabilities
    * the most likely scoreline (matrix argmax)

The engine is deliberately self-contained: it takes a flat list of past matches
and returns predictions, with no dependency on the DataFrame build. That keeps it
unit-testable and lets xG- or odds-based variants reuse the same core later.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
from scipy.optimize import minimize

from updater.predictions.distributions import (
    MatchResult,
    ScorePrediction,
    dc_low_score_correction as _dc_low_score_correction,
    goal_grids,
    match_dates,
    poisson_pmf as _poisson_pmf,
    prediction_from_matrix,
    time_weights as _time_weights,
)

__all__ = [
    "DixonColesModel",
    "MatchResult",
    "ScorePrediction",
    "fit_dixon_coles",
]


class DixonColesModel:
    """A fitted set of attack / defence ratings plus home advantage and rho."""

    def __init__(
        self,
        teams: list[str],
        attack: dict[str, float],
        defence: dict[str, float],
        home_advantage: float,
        rho: float,
        default_attack: float = 0.0,
        default_defence: float = 0.0,
    ):
        self.teams = teams
        self.attack = attack
        self.defence = defence
        self.home_advantage = home_advantage
        self.rho = rho
        # Ratings for a team the model has never seen (typically newly promoted),
        # taken from the weakest sides in the training window.
        self.default_attack = default_attack
        self.default_defence = default_defence

    def _rating(self, team: str) -> tuple[float, float]:
        return (
            self.attack.get(team, self.default_attack),
            self.defence.get(team, self.default_defence),
        )

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        home_attack, home_defence = self._rating(home_team)
        away_attack, away_defence = self._rating(away_team)
        lambda_home = np.exp(home_attack - away_defence + self.home_advantage)
        lambda_away = np.exp(away_attack - home_defence)
        return float(lambda_home), float(lambda_away)

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.expected_goals(home_team, away_team)

        goals = np.arange(max_goals + 1)
        home_pmf = _poisson_pmf(goals, lambda_home)
        away_pmf = _poisson_pmf(goals, lambda_away)

        # Independent-Poisson joint, then apply the low-score correction cell-wise.
        matrix = np.outer(home_pmf, away_pmf)
        hg, ag = goal_grids(max_goals)
        tau = _dc_low_score_correction(
            hg,
            ag,
            np.full_like(matrix, lambda_home),
            np.full_like(matrix, lambda_away),
            self.rho,
        )
        matrix = matrix * tau

        return prediction_from_matrix(
            home_team,
            away_team,
            matrix,
            expected_home_goals=lambda_home,
            expected_away_goals=lambda_away,
        )


def fit_dixon_coles(
    matches: list[MatchResult],
    half_life_days: float = 365.0,
    regularisation: float = 1e-3,
    max_iter: int = 200,
    xg_weight: float = 0.0,
    fit_rho: bool = True,
) -> Optional[DixonColesModel]:
    """Fit attack/defence/home-advantage/rho by weighted maximum likelihood.

    Returns None when there is nothing to fit. The rating vectors are identified
    only up to a joint shift of all attacks and defences, which leaves every
    prediction unchanged; a light L2 penalty pins that direction and steadies
    the optimiser on short samples.

    `xg_weight` in [0, 1] blends expected goals into each match's target when
    available: 0 fits pure goals (the tau low-score correction then applies as
    usual); higher values lean on the less noisy xG signal.

    `fit_rho=False` pins rho at 0, collapsing the model to independent Poisson.
    That is the ablation the backtest uses to check the low-score correction is
    earning its place.
    """
    if not matches:
        return None

    teams = sorted({m.home_team for m in matches} | {m.away_team for m in matches})
    index = {team: i for i, team in enumerate(teams)}
    n = len(teams)

    def target(goals: int, xg: Optional[float]) -> float:
        if xg_weight > 0 and xg is not None:
            return (1 - xg_weight) * goals + xg_weight * xg
        return float(goals)

    home_idx = np.array([index[m.home_team] for m in matches])
    away_idx = np.array([index[m.away_team] for m in matches])
    home_goals = np.array([target(m.home_goals, m.home_xg) for m in matches])
    away_goals = np.array([target(m.away_goals, m.away_xg) for m in matches])
    weights = _time_weights(match_dates(matches), half_life_days)

    def unpack(params: np.ndarray):
        attack = params[:n]
        defence = params[n : 2 * n]
        home_advantage = params[2 * n]
        rho = params[2 * n + 1]
        return attack, defence, home_advantage, rho

    def negative_log_likelihood(params: np.ndarray) -> float:
        attack, defence, home_advantage, rho = unpack(params)

        lambda_home = np.exp(attack[home_idx] - defence[away_idx] + home_advantage)
        lambda_away = np.exp(attack[away_idx] - defence[home_idx])

        log_poisson = (
            home_goals * np.log(lambda_home)
            - lambda_home
            + away_goals * np.log(lambda_away)
            - lambda_away
        )
        tau = _dc_low_score_correction(
            home_goals, away_goals, lambda_home, lambda_away, rho
        )
        tau = np.clip(tau, 1e-10, None)

        log_likelihood = np.sum(weights * (np.log(tau) + log_poisson))
        penalty = regularisation * (np.sum(attack**2) + np.sum(defence**2))
        return -log_likelihood + penalty

    rho_initial = -0.05 if fit_rho else 0.0
    initial = np.concatenate([np.zeros(n), np.zeros(n), [0.3], [rho_initial]])
    # rho must stay small enough to keep every tau positive; home advantage and
    # ratings are effectively unbounded but the penalty keeps them tame.
    rho_bounds = (-0.2, 0.2) if fit_rho else (0.0, 0.0)
    bounds = [(None, None)] * (2 * n) + [(-1.0, 2.0), rho_bounds]

    result = minimize(
        negative_log_likelihood,
        initial,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": max_iter},
    )

    attack_vec, defence_vec, home_advantage, rho = unpack(result.x)
    attack = {team: float(attack_vec[i]) for team, i in index.items()}
    defence = {team: float(defence_vec[i]) for team, i in index.items()}

    # Prior for unseen (promoted) teams: the mean rating of the weakest few
    # sides, ranked by overall strength (attack + defence).
    weakest = sorted(teams, key=lambda t: attack[t] + defence[t])[: min(3, n)]
    default_attack = float(np.mean([attack[t] for t in weakest]))
    default_defence = float(np.mean([defence[t] for t in weakest]))

    return DixonColesModel(
        teams=teams,
        attack=attack,
        defence=defence,
        home_advantage=float(home_advantage),
        rho=float(rho),
        default_attack=default_attack,
        default_defence=default_defence,
    )

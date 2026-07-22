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

from dataclasses import dataclass
from datetime import datetime
from math import log
from typing import NamedTuple, Optional

import numpy as np
from scipy.optimize import minimize


class MatchResult(NamedTuple):
    """One completed match, home-team oriented.

    `home_xg` / `away_xg` are optional expected-goals values (true xG, or a
    shots-based proxy). When present and `xg_weight > 0`, the fit blends them
    with the actual goals to denoise each team's rate estimates.
    """

    date: datetime
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None


@dataclass
class ScorePrediction:
    """A fixture's full predicted distribution.

    `home_goals_dist[k]` is the probability the home team scores exactly k;
    `away_goals_dist` likewise for the away team. `scoreline_matrix[h][a]` is the
    joint probability of the exact scoreline h-a. All three sum to ~1.
    """

    home_team: str
    away_team: str
    expected_home_goals: float
    expected_away_goals: float
    home_goals_dist: list[float]
    away_goals_dist: list[float]
    scoreline_matrix: list[list[float]]
    prob_home_win: float
    prob_draw: float
    prob_away_win: float
    predicted_home_goals: int
    predicted_away_goals: int

    def to_dict(self) -> dict:
        return {
            "homeTeam": self.home_team,
            "awayTeam": self.away_team,
            "expectedHomeGoals": self.expected_home_goals,
            "expectedAwayGoals": self.expected_away_goals,
            "homeGoalsDist": self.home_goals_dist,
            "awayGoalsDist": self.away_goals_dist,
            "scorelineMatrix": self.scoreline_matrix,
            "probHomeWin": self.prob_home_win,
            "probDraw": self.prob_draw,
            "probAwayWin": self.prob_away_win,
            "predictedHomeGoals": self.predicted_home_goals,
            "predictedAwayGoals": self.predicted_away_goals,
        }


def _poisson_pmf(k: np.ndarray, lam: float | np.ndarray) -> np.ndarray:
    """Poisson probability mass, vectorised over goal counts 0..k for each lam."""
    from scipy.stats import poisson

    return poisson.pmf(k, lam)


def _dc_low_score_correction(
    home_goals: np.ndarray,
    away_goals: np.ndarray,
    lambda_home: np.ndarray,
    lambda_away: np.ndarray,
    rho: float,
) -> np.ndarray:
    """Dixon-Coles tau adjustment for the four low-score cells (1 elsewhere)."""
    tau = np.ones_like(lambda_home, dtype=float)

    zero_zero = (home_goals == 0) & (away_goals == 0)
    zero_one = (home_goals == 0) & (away_goals == 1)
    one_zero = (home_goals == 1) & (away_goals == 0)
    one_one = (home_goals == 1) & (away_goals == 1)

    tau[zero_zero] = 1 - lambda_home[zero_zero] * lambda_away[zero_zero] * rho
    tau[zero_one] = 1 + lambda_home[zero_one] * rho
    tau[one_zero] = 1 + lambda_away[one_zero] * rho
    tau[one_one] = 1 - rho
    return tau


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
        hg = goals.reshape(-1, 1) * np.ones((1, max_goals + 1))
        ag = np.ones((max_goals + 1, 1)) * goals.reshape(1, -1)
        tau = _dc_low_score_correction(
            hg,
            ag,
            np.full_like(matrix, lambda_home),
            np.full_like(matrix, lambda_away),
            self.rho,
        )
        matrix = matrix * tau

        # Truncating the tail and the tau tweak leave the mass slightly off 1.
        total = matrix.sum()
        if total > 0:
            matrix = matrix / total

        home_goals_dist = matrix.sum(axis=1)
        away_goals_dist = matrix.sum(axis=0)

        prob_home_win = float(np.tril(matrix, -1).sum())
        prob_away_win = float(np.triu(matrix, 1).sum())
        prob_draw = float(np.trace(matrix))

        best = np.unravel_index(int(np.argmax(matrix)), matrix.shape)

        return ScorePrediction(
            home_team=home_team,
            away_team=away_team,
            expected_home_goals=lambda_home,
            expected_away_goals=lambda_away,
            home_goals_dist=home_goals_dist.tolist(),
            away_goals_dist=away_goals_dist.tolist(),
            scoreline_matrix=matrix.tolist(),
            prob_home_win=prob_home_win,
            prob_draw=prob_draw,
            prob_away_win=prob_away_win,
            predicted_home_goals=int(best[0]),
            predicted_away_goals=int(best[1]),
        )


def _time_weights(dates: np.ndarray, half_life_days: float) -> np.ndarray:
    """Exponential recency weights: newest match ~1, halving every half_life_days."""
    reference = dates.max()
    days_ago = (reference - dates) / np.timedelta64(1, "D")
    decay = log(2) / half_life_days
    return np.exp(-decay * days_ago)


def fit_dixon_coles(
    matches: list[MatchResult],
    half_life_days: float = 365.0,
    regularisation: float = 1e-3,
    max_iter: int = 200,
    xg_weight: float = 0.0,
) -> Optional[DixonColesModel]:
    """Fit attack/defence/home-advantage/rho by weighted maximum likelihood.

    Returns None when there is nothing to fit. The rating vectors are identified
    only up to a joint shift of all attacks and defences, which leaves every
    prediction unchanged; a light L2 penalty pins that direction and steadies
    the optimiser on short samples.

    `xg_weight` in [0, 1] blends expected goals into each match's target when
    available: 0 fits pure goals (the tau low-score correction then applies as
    usual); higher values lean on the less noisy xG signal.
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
    # np.datetime64 has no tz support; drop the offset (all inputs are UTC).
    dates = np.array(
        [
            np.datetime64(m.date.replace(tzinfo=None) if m.date.tzinfo else m.date)
            for m in matches
        ]
    )
    weights = _time_weights(dates, half_life_days)

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

    initial = np.concatenate([np.zeros(n), np.zeros(n), [0.3], [-0.05]])
    # rho must stay small enough to keep every tau positive; home advantage and
    # ratings are effectively unbounded but the penalty keeps them tame.
    bounds = [(None, None)] * (2 * n) + [(-1.0, 2.0), (-0.2, 0.2)]

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

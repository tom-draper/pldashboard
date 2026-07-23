"""Dixon-Coles extended with rest days and team-specific home advantage.

Every other engine in the registry reads the same three things out of a match:
who played, where, and how many goals. This one adds the only genuinely unused
information the fixture list already contains, for free:

    * **Rest days.** How long each side had since its last match. A team playing
      its third game in eight days is not the same team that had a fortnight off,
      and the schedule knows this in advance. Nothing else in the collection uses
      it, so it is the one lever available that adds *information* rather than
      rearranging the information already present.

    * **Team-specific home advantage.** The shared home term assumes Old Trafford
      and a half-empty ground are worth the same. Freeing it per team costs one
      parameter each, shrunk toward the league mean so a small sample cannot
      invent a huge home effect from noise.

Both are cheap, and both are testable: if the backtest says they do nothing, that
is a real finding about football rather than about the optimiser. Rest days in
particular are widely believed to matter and just as widely found to be marginal
once team strength is accounted for.

The rest effect is estimated as a single shared coefficient rather than per team,
since there is nowhere near enough data to identify a fatigue susceptibility for
each side.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Optional

import numpy as np
from scipy.optimize import minimize

from updater.predictions.distributions import (
    MatchResult,
    ScorePrediction,
    dc_low_score_correction,
    goal_grids,
    match_dates,
    poisson_pmf,
    prediction_from_matrix,
    time_weights,
)

# A normal turnaround. Rest is measured relative to this, so the coefficient
# reads as "the effect of a week more or less than usual".
TYPICAL_REST_DAYS = 7.0

# Beyond a fortnight, extra rest stops meaning anything (it is an international
# break or a winter gap, not freshness), and unbounded values would let a single
# post-summer fixture dominate the coefficient.
MAX_REST_DAYS = 14.0


def _rest_covariate(rest_days: float) -> float:
    """Rest relative to a normal week, in weeks, clipped at a fortnight."""
    return (min(rest_days, MAX_REST_DAYS) - TYPICAL_REST_DAYS) / 7.0


def _rest_days_per_match(
    matches: Sequence[MatchResult],
) -> tuple[np.ndarray, np.ndarray, dict[str, datetime]]:
    """Days since each side's previous match, plus each team's last match date.

    The first appearance of a team has no previous match, so it is assigned the
    typical turnaround rather than dropped: a missing value is not evidence of a
    long rest.
    """
    ordered = sorted(range(len(matches)), key=lambda i: matches[i].date)
    last_seen: dict[str, datetime] = {}

    home_rest = np.full(len(matches), TYPICAL_REST_DAYS)
    away_rest = np.full(len(matches), TYPICAL_REST_DAYS)

    for i in ordered:
        match = matches[i]
        for team, target in ((match.home_team, home_rest), (match.away_team, away_rest)):
            previous = last_seen.get(team)
            if previous is not None:
                target[i] = (match.date - previous).total_seconds() / 86400.0
        last_seen[match.home_team] = match.date
        last_seen[match.away_team] = match.date

    return home_rest, away_rest, last_seen


class ExtendedDixonColesModel:
    """Dixon-Coles with a per-team home term and a shared rest coefficient."""

    # Opts this model into receiving the fixture's kickoff date, which it needs
    # to work out how long each side has had off.
    uses_match_date = True

    def __init__(
        self,
        teams: list[str],
        attack: dict[str, float],
        defence: dict[str, float],
        home_advantage: dict[str, float],
        mean_home_advantage: float,
        rest_coefficient: float,
        rho: float,
        last_match_date: dict[str, datetime],
        default_attack: float = 0.0,
        default_defence: float = 0.0,
    ):
        self.teams = teams
        self.attack = attack
        self.defence = defence
        self.home_advantage = home_advantage
        self.mean_home_advantage = mean_home_advantage
        self.rest_coefficient = rest_coefficient
        self.rho = rho
        self.last_match_date = last_match_date
        self.default_attack = default_attack
        self.default_defence = default_defence

    def _rest(self, team: str, match_date: Optional[datetime]) -> float:
        """Days off before `match_date`, defaulting to a normal week."""
        previous = self.last_match_date.get(team)
        if match_date is None or previous is None:
            return TYPICAL_REST_DAYS
        if previous.tzinfo is None and match_date.tzinfo is not None:
            match_date = match_date.replace(tzinfo=None)
        elif previous.tzinfo is not None and match_date.tzinfo is None:
            previous = previous.replace(tzinfo=None)
        days = (match_date - previous).total_seconds() / 86400.0
        return max(days, 0.0) if days > 0 else TYPICAL_REST_DAYS

    def expected_goals(
        self, home_team: str, away_team: str, match_date: Optional[datetime] = None
    ) -> tuple[float, float]:
        home_attack = self.attack.get(home_team, self.default_attack)
        home_defence = self.defence.get(home_team, self.default_defence)
        away_attack = self.attack.get(away_team, self.default_attack)
        away_defence = self.defence.get(away_team, self.default_defence)
        home_term = self.home_advantage.get(home_team, self.mean_home_advantage)

        home_rest = _rest_covariate(self._rest(home_team, match_date))
        away_rest = _rest_covariate(self._rest(away_team, match_date))

        lambda_home = np.exp(
            home_attack - away_defence + home_term + self.rest_coefficient * home_rest
        )
        lambda_away = np.exp(
            away_attack - home_defence + self.rest_coefficient * away_rest
        )
        return float(lambda_home), float(lambda_away)

    def predict(
        self,
        home_team: str,
        away_team: str,
        max_goals: int = 10,
        match_date: Optional[datetime] = None,
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.expected_goals(home_team, away_team, match_date)

        goals = np.arange(max_goals + 1)
        matrix = np.outer(
            poisson_pmf(goals, lambda_home), poisson_pmf(goals, lambda_away)
        )
        hg, ag = goal_grids(max_goals)
        matrix = matrix * dc_low_score_correction(
            hg,
            ag,
            np.full_like(matrix, lambda_home),
            np.full_like(matrix, lambda_away),
            self.rho,
        )
        return prediction_from_matrix(
            home_team,
            away_team,
            matrix,
            expected_home_goals=lambda_home,
            expected_away_goals=lambda_away,
        )


def fit_extended_dixon_coles(
    matches: Sequence[MatchResult],
    half_life_days: float = 365.0,
    regularisation: float = 1e-3,
    # Per-team home advantage is shrunk far harder than attack/defence: it is a
    # weak effect estimated from half as many matches, so left free it would
    # mostly fit noise.
    home_regularisation: float = 0.5,
    max_iter: int = 300,
) -> Optional[ExtendedDixonColesModel]:
    """Fit ratings, per-team home advantage, rho and the rest coefficient."""
    if not matches:
        return None

    matches = list(matches)
    teams = sorted({m.home_team for m in matches} | {m.away_team for m in matches})
    index = {team: i for i, team in enumerate(teams)}
    n = len(teams)

    home_idx = np.array([index[m.home_team] for m in matches])
    away_idx = np.array([index[m.away_team] for m in matches])
    home_goals = np.array([float(m.home_goals) for m in matches])
    away_goals = np.array([float(m.away_goals) for m in matches])
    weights = time_weights(match_dates(matches), half_life_days)

    raw_home_rest, raw_away_rest, last_match_date = _rest_days_per_match(matches)
    home_rest = np.array([_rest_covariate(r) for r in raw_home_rest])
    away_rest = np.array([_rest_covariate(r) for r in raw_away_rest])

    def unpack(params: np.ndarray):
        return (
            params[:n],  # attack
            params[n : 2 * n],  # defence
            params[2 * n],  # shared home advantage
            params[2 * n + 1 : 3 * n + 1],  # per-team home deviation
            params[3 * n + 1],  # rho
            params[3 * n + 2],  # rest coefficient
        )

    def negative_log_likelihood(params: np.ndarray) -> float:
        attack, defence, shared_home, home_deviation, rho, rest = unpack(params)

        lambda_home = np.exp(
            attack[home_idx]
            - defence[away_idx]
            + shared_home
            + home_deviation[home_idx]
            + rest * home_rest
        )
        lambda_away = np.exp(
            attack[away_idx] - defence[home_idx] + rest * away_rest
        )

        log_poisson = (
            home_goals * np.log(lambda_home)
            - lambda_home
            + away_goals * np.log(lambda_away)
            - lambda_away
        )
        tau = np.clip(
            dc_low_score_correction(
                home_goals, away_goals, lambda_home, lambda_away, rho
            ),
            1e-10,
            None,
        )

        log_likelihood = np.sum(weights * (np.log(tau) + log_poisson))
        penalty = regularisation * (
            np.sum(attack**2) + np.sum(defence**2)
        ) + home_regularisation * np.sum(home_deviation**2)
        return -log_likelihood + penalty

    initial = np.concatenate(
        [np.zeros(n), np.zeros(n), [0.3], np.zeros(n), [-0.05], [0.0]]
    )
    bounds = (
        [(None, None)] * (2 * n)
        + [(-1.0, 2.0)]
        + [(-0.5, 0.5)] * n
        + [(-0.2, 0.2), (-0.5, 0.5)]
    )

    result = minimize(
        negative_log_likelihood,
        initial,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": max_iter},
    )

    attack_vec, defence_vec, shared_home, home_deviation, rho, rest = unpack(result.x)
    attack = {team: float(attack_vec[i]) for team, i in index.items()}
    defence = {team: float(defence_vec[i]) for team, i in index.items()}
    home_advantage = {
        team: float(shared_home + home_deviation[i]) for team, i in index.items()
    }

    weakest = sorted(teams, key=lambda t: attack[t] + defence[t])[: min(3, n)]

    return ExtendedDixonColesModel(
        teams=teams,
        attack=attack,
        defence=defence,
        home_advantage=home_advantage,
        mean_home_advantage=float(shared_home),
        rest_coefficient=float(rest),
        rho=float(rho),
        last_match_date=last_match_date,
        default_attack=float(np.mean([attack[t] for t in weakest])),
        default_defence=float(np.mean([defence[t] for t in weakest])),
    )

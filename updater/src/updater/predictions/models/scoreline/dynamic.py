"""Time-varying ratings via an extended Kalman filter (Rue & Salvesen, 2000).

Every other fitted model here handles the passage of time the same crude way:
weight old matches less. That treats a rating as a fixed number estimated from
fuzzy data, when the truth is the opposite. Team strength genuinely *changes* -
managers are sacked, squads turn over, injuries land - and exponential decay can
only express "trust old data less", never "the team is different now".

This model states the change directly. Each team's attack and defence follow a
random walk:

    attack[t] = attack[t - 1] + noise,   noise ~ Normal(0, process_variance * days)

and each match is an observation that updates the ratings through a Kalman filter.
Because the observation is Poisson rather than Gaussian, the update is the
*extended* form: a local linearisation, where for a rate lambda and observed goals
g the score is (g - lambda) and the Fisher information is lambda, giving

    rating += P * (g - lambda) / (1 + P * lambda)

with P the rating's current variance. That denominator is what makes the filter
self-pacing, and it is the real advantage over decay: a team the model is unsure
about (newly promoted, or just returned from a long break) has a large P and
moves fast, while a team with a long settled history has a small P and barely
budges on one surprising result. Exponential decay applies one global rate to
everyone regardless of how much is known about them.

Uncertainty grows with elapsed time between matches, so a summer break naturally
widens every rating and lets the new season re-learn quickly, which decay only
approximates by discounting everything before it.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from math import log
from typing import Optional

import numpy as np

from updater.predictions.distributions import (
    MatchResult,
    ScorePrediction,
    dc_low_score_correction,
    goal_grids,
    poisson_pmf,
    prediction_from_matrix,
)

# Starting uncertainty for a team's rating. Deliberately wide: an unseen team
# should move a long way on its first few matches.
INITIAL_VARIANCE = 0.25

# Random-walk step per day. Sets how fast strength is allowed to drift, and is
# this model's analogue of the half-life.
DEFAULT_PROCESS_VARIANCE = 1e-4

# Ceiling on rating variance, so a team absent for years does not come back with
# an effectively infinite learning rate and swing wildly on one result.
MAX_VARIANCE = 1.0


@dataclass
class _Rating:
    value: float = 0.0
    variance: float = INITIAL_VARIANCE


@dataclass
class DynamicRatingsModel:
    """Filtered attack / defence ratings at the end of the training data."""

    attack: dict[str, float]
    defence: dict[str, float]
    home_advantage: float
    rho: float = -0.05
    default_attack: float = 0.0
    default_defence: float = 0.0
    # Kept for inspection: how uncertain the filter still is about each team.
    attack_variance: dict[str, float] = field(default_factory=dict)

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        home_attack = self.attack.get(home_team, self.default_attack)
        home_defence = self.defence.get(home_team, self.default_defence)
        away_attack = self.attack.get(away_team, self.default_attack)
        away_defence = self.defence.get(away_team, self.default_defence)
        return (
            float(np.exp(home_attack - away_defence + self.home_advantage)),
            float(np.exp(away_attack - home_defence)),
        )

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.expected_goals(home_team, away_team)
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


def fit_dynamic(
    matches: Sequence[MatchResult],
    process_variance: Optional[float] = None,
    half_life_days: float = 365.0,
    rho: float = -0.05,
    learning_cap: float = 0.5,
) -> Optional[DynamicRatingsModel]:
    """Filter the matches in order, updating ratings after each result.

    When `process_variance` is not given it is derived from `half_life_days`, so
    the model responds to the backtest's existing knob: a shorter half-life means
    a belief that strength changes faster, which is a larger random-walk step.
    """
    if not matches:
        return None

    if process_variance is None:
        # Calibrated so the default 365-day half-life maps to the default step,
        # with the drift rate scaling inversely to the half-life.
        process_variance = DEFAULT_PROCESS_VARIANCE * (365.0 / max(half_life_days, 1.0))

    ordered = sorted(matches, key=lambda m: m.date)

    # A single shared home advantage, taken from the data rather than filtered:
    # it is stable across a league and does not need tracking over time.
    total_home = sum(m.home_goals for m in ordered)
    total_away = sum(m.away_goals for m in ordered)
    if total_home <= 0 or total_away <= 0:
        home_advantage = 0.0
    else:
        home_advantage = log(total_home / total_away)

    attack: dict[str, _Rating] = {}
    defence: dict[str, _Rating] = {}
    last_seen: dict[str, object] = {}

    def ensure(team: str) -> None:
        if team not in attack:
            attack[team] = _Rating()
            defence[team] = _Rating()

    def drift(team: str, date) -> None:
        """Random-walk step: uncertainty grows with time since the last match."""
        previous = last_seen.get(team)
        if previous is not None:
            days = max((date - previous).total_seconds() / 86400.0, 0.0)
            growth = process_variance * days
            attack[team].variance = min(attack[team].variance + growth, MAX_VARIANCE)
            defence[team].variance = min(defence[team].variance + growth, MAX_VARIANCE)
        last_seen[team] = date

    def update(rating: _Rating, goals: float, rate: float, sign: float) -> None:
        """One extended-Kalman step for a Poisson observation.

        `sign` is +1 for the attack rating (more goals means stronger attack) and
        -1 for the defence rating of the side conceding them.
        """
        innovation = goals - rate
        gain = rating.variance / (1.0 + rating.variance * rate)
        step = float(np.clip(gain * innovation * sign, -learning_cap, learning_cap))
        rating.value += step
        # Posterior variance shrinks as evidence accumulates.
        rating.variance = max(rating.variance * (1.0 - gain * rate), 1e-6)

    for match in ordered:
        home, away = match.home_team, match.away_team
        ensure(home)
        ensure(away)
        drift(home, match.date)
        drift(away, match.date)

        lambda_home = float(
            np.exp(attack[home].value - defence[away].value + home_advantage)
        )
        lambda_away = float(np.exp(attack[away].value - defence[home].value))
        # Guard the linearisation: an extreme rate makes the local approximation
        # meaningless and the gain unstable.
        lambda_home = float(np.clip(lambda_home, 1e-3, 15.0))
        lambda_away = float(np.clip(lambda_away, 1e-3, 15.0))

        # Both ratings behind each rate are updated from the same observation.
        update(attack[home], match.home_goals, lambda_home, +1.0)
        update(defence[away], match.home_goals, lambda_home, -1.0)
        update(attack[away], match.away_goals, lambda_away, +1.0)
        update(defence[home], match.away_goals, lambda_away, -1.0)

    attack_values = {team: rating.value for team, rating in attack.items()}
    defence_values = {team: rating.value for team, rating in defence.items()}

    teams = sorted(attack_values)
    weakest = sorted(
        teams, key=lambda t: attack_values[t] + defence_values[t]
    )[: min(3, len(teams))]

    return DynamicRatingsModel(
        attack=attack_values,
        defence=defence_values,
        home_advantage=home_advantage,
        rho=rho,
        default_attack=float(np.mean([attack_values[t] for t in weakest])),
        default_defence=float(np.mean([defence_values[t] for t in weakest])),
        attack_variance={team: rating.variance for team, rating in attack.items()},
    )

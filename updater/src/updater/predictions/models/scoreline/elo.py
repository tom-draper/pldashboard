"""Elo ratings, with the rating-to-goals mapping learned from the data.

Elo is the oldest idea here and the one with the least football in it: a single
number per team, updated after each match by the gap between the result and what
the rating expected. Unlike pi-ratings it works on *outcomes* (win / draw / loss)
rather than goal difference, with the margin entering only through a multiplier
on the update size.

The awkward part of using Elo for scorelines is that a rating difference is not
in goal units and there is no principled conversion. Rather than hard-code the
usual folklore constant, the mapping is fit: every match's pre-match rating gap
is recorded alongside the goal difference that followed, and a least-squares line
through those pairs gives

    supremacy = intercept + slope * rating_difference

That line is estimated out of the same pass that builds the ratings, so it costs
nothing extra and adapts to whatever scale the K-factor happens to produce.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Optional

import numpy as np

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

DEFAULT_RATING = 1500.0
DEFAULT_K = 20.0
# Elo points of home advantage, the long-standing chess/football convention.
DEFAULT_HOME_ADVANTAGE = 60.0
# Rating points for a 10x change in expected score: the constant that defines
# the Elo scale itself.
SCALE = 400.0

MIN_RATE = 0.15


def _margin_multiplier(goal_difference: int) -> float:
    """World Football Elo's margin-of-victory scaling, damped for blowouts."""
    margin = abs(goal_difference)
    if margin <= 1:
        return 1.0
    if margin == 2:
        return 1.5
    return (11.0 + margin) / 8.0


@dataclass
class EloModel:
    """Fitted Elo ratings plus the learned rating-to-supremacy line."""

    rating: dict[str, float]
    intercept: float
    slope: float
    mean_total_goals: float
    home_advantage: float = DEFAULT_HOME_ADVANTAGE
    rho: float = -0.05

    def supremacy(self, home_team: str, away_team: str) -> float:
        difference = (
            self.rating.get(home_team, DEFAULT_RATING)
            + self.home_advantage
            - self.rating.get(away_team, DEFAULT_RATING)
        )
        return self.intercept + self.slope * difference

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        supremacy = self.supremacy(home_team, away_team)
        return (
            max((self.mean_total_goals + supremacy) / 2.0, MIN_RATE),
            max((self.mean_total_goals - supremacy) / 2.0, MIN_RATE),
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


@dataclass
class EloPass:
    """One chronological sweep: the final ratings and what they saw on the way.

    `rating_gaps[i]` is the rating difference *before* match i was played, so it
    is a genuine out-of-sample record of what that gap went on to produce. It is
    kept because more than one model is built on this sweep: `fit_elo` below
    regresses goal difference on the gaps, while `models.outcome.ratings` fits an
    ordered link straight to the outcomes instead.
    """

    rating: dict[str, float]
    matches: list[MatchResult]
    rating_gaps: np.ndarray
    goal_differences: np.ndarray


def elo_rating_pass(
    matches: Sequence[MatchResult],
    k_factor: float = DEFAULT_K,
    home_advantage: float = DEFAULT_HOME_ADVANTAGE,
) -> EloPass:
    """Run the Elo updates in date order, recording each pre-match rating gap."""
    ordered = sorted(matches, key=lambda m: m.date)
    rating: dict[str, float] = {}

    rating_gaps: list[float] = []
    goal_differences: list[float] = []

    for match in ordered:
        home, away = match.home_team, match.away_team
        rating.setdefault(home, DEFAULT_RATING)
        rating.setdefault(away, DEFAULT_RATING)

        difference = rating[home] + home_advantage - rating[away]
        rating_gaps.append(difference)
        goal_differences.append(float(match.home_goals - match.away_goals))

        expected_home = 1.0 / (1.0 + 10.0 ** (-difference / SCALE))
        if match.home_goals > match.away_goals:
            actual_home = 1.0
        elif match.home_goals == match.away_goals:
            actual_home = 0.5
        else:
            actual_home = 0.0

        change = (
            k_factor
            * _margin_multiplier(match.home_goals - match.away_goals)
            * (actual_home - expected_home)
        )
        rating[home] += change
        rating[away] -= change

    return EloPass(
        rating=rating,
        matches=ordered,
        rating_gaps=np.array(rating_gaps),
        goal_differences=np.array(goal_differences),
    )


def fit_elo(
    matches: Sequence[MatchResult],
    k_factor: float = DEFAULT_K,
    home_advantage: float = DEFAULT_HOME_ADVANTAGE,
    half_life_days: float = 365.0,
    rho: float = -0.05,
) -> Optional[EloModel]:
    """One chronological pass: update ratings, and record the goals mapping.

    `half_life_days` affects only the league average total goals; Elo's own
    recency comes from the K-factor. It is accepted so every engine takes the
    same knob and the backtest can sweep them alike.
    """
    if not matches:
        return None

    sweep = elo_rating_pass(matches, k_factor=k_factor, home_advantage=home_advantage)
    ordered = sweep.matches
    rating = sweep.rating

    # Least-squares line from rating gap to goal difference.
    gaps = sweep.rating_gaps
    differences = sweep.goal_differences
    if gaps.size < 2 or np.allclose(gaps, gaps[0]):
        slope, intercept = 0.0, float(differences.mean())
    else:
        slope, intercept = np.polyfit(gaps, differences, 1)

    weights = time_weights(match_dates(ordered), half_life_days)
    totals = np.array([m.home_goals + m.away_goals for m in ordered], dtype=float)

    return EloModel(
        rating=rating,
        intercept=float(intercept),
        slope=float(slope),
        mean_total_goals=float(np.sum(weights * totals) / np.sum(weights)),
        home_advantage=home_advantage,
        rho=rho,
    )

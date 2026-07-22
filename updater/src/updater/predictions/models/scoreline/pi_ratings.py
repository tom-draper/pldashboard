"""Pi-ratings (Constantinou & Fenton, 2013).

A different paradigm to the maximum-likelihood goal models: rather than refitting
a whole league from scratch on a rolling window, each team carries a rating that
is nudged after every match by how far the result fell from expectation. Recency
is handled by the learning rate rather than an exponential decay, so there is no
training window to tune, and a fit is a single linear pass over the matches.

Each team holds *two* ratings, one for home matches and one for away, since home
and away strength are only partly the same thing. A result updates the rating for
the ground the team played on, and drags the other rating along by a factor
gamma. Errors enter through a log-scaled function, so a 7-0 does not swing a
rating seven times as far as a 1-0: the model deliberately discounts thrashings.

The ratings predict a goal *difference*. To get the scoreline distribution the
dashboard needs, that supremacy is split around a recency-weighted league average
total, giving two Poisson rates, then the Dixon-Coles low-score correction is
applied with a fixed rho (there is no likelihood here to estimate one from).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

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

# Paper defaults: lambda (learning rate), gamma (cross-ground carry-over), and
# the error scale c in psi(e) = c * log10(1 + e).
DEFAULT_LEARNING_RATE = 0.035
DEFAULT_CARRY_OVER = 0.7
DEFAULT_ERROR_SCALE = 3.0

# A team can never be expected to score less than this, however lopsided the
# fixture; without a floor a big supremacy drives one rate negative.
MIN_RATE = 0.15


@dataclass
class PiRatingsModel:
    """Fitted home/away ratings plus the league scoring level they sit in."""

    home_rating: dict[str, float]
    away_rating: dict[str, float]
    mean_total_goals: float
    rho: float = -0.05

    def supremacy(self, home_team: str, away_team: str) -> float:
        """Expected home-goals minus away-goals. Unknown teams rate 0 (average)."""
        return self.home_rating.get(home_team, 0.0) - self.away_rating.get(
            away_team, 0.0
        )

    def expected_goals(self, home_team: str, away_team: str) -> tuple[float, float]:
        supremacy = self.supremacy(home_team, away_team)
        lambda_home = (self.mean_total_goals + supremacy) / 2.0
        lambda_away = (self.mean_total_goals - supremacy) / 2.0
        return max(lambda_home, MIN_RATE), max(lambda_away, MIN_RATE)

    def predict(
        self, home_team: str, away_team: str, max_goals: int = 10
    ) -> ScorePrediction:
        lambda_home, lambda_away = self.expected_goals(home_team, away_team)
        goals = np.arange(max_goals + 1)
        matrix = np.outer(poisson_pmf(goals, lambda_home), poisson_pmf(goals, lambda_away))

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
class PiRatingsPass:
    """One chronological sweep: final ratings plus each pre-match supremacy.

    `supremacies[i]` is the expected goal difference the ratings implied *before*
    match i, so it is an honest out-of-sample record. `models.outcome.ratings`
    fits an ordered link to those, taking the ratings as given and learning only
    how a supremacy maps to result probabilities.
    """

    home_rating: dict[str, float]
    away_rating: dict[str, float]
    matches: list[MatchResult]
    supremacies: np.ndarray


def pi_rating_pass(
    matches: Sequence[MatchResult],
    learning_rate: float = DEFAULT_LEARNING_RATE,
    carry_over: float = DEFAULT_CARRY_OVER,
    error_scale: float = DEFAULT_ERROR_SCALE,
) -> PiRatingsPass:
    """Run the pi-ratings updates in date order, recording expectations first."""
    ordered = sorted(matches, key=lambda m: m.date)

    home_rating: dict[str, float] = {}
    away_rating: dict[str, float] = {}
    supremacies: list[float] = []

    for match in ordered:
        home, away = match.home_team, match.away_team
        home_rating.setdefault(home, 0.0)
        away_rating.setdefault(home, 0.0)
        home_rating.setdefault(away, 0.0)
        away_rating.setdefault(away, 0.0)

        expected = home_rating[home] - away_rating[away]
        supremacies.append(expected)

        observed = match.home_goals - match.away_goals
        error = abs(observed - expected)
        # Log-scaled error: diminishing returns on the size of a surprise.
        step = error_scale * np.log10(1.0 + error)
        direction = 1.0 if observed > expected else -1.0
        delta = learning_rate * step * direction

        # Each team's rating for the ground it played on moves by delta; its
        # rating for the other ground follows at a discount.
        home_rating[home] += delta
        away_rating[home] += delta * carry_over
        away_rating[away] -= delta
        home_rating[away] -= delta * carry_over

    return PiRatingsPass(
        home_rating=home_rating,
        away_rating=away_rating,
        matches=ordered,
        supremacies=np.array(supremacies),
    )


def fit_pi_ratings(
    matches: Sequence[MatchResult],
    learning_rate: float = DEFAULT_LEARNING_RATE,
    carry_over: float = DEFAULT_CARRY_OVER,
    error_scale: float = DEFAULT_ERROR_SCALE,
    half_life_days: float = 365.0,
    rho: float = -0.05,
) -> Optional[PiRatingsModel]:
    """Run the pi-ratings update over the matches in chronological order.

    `half_life_days` affects only the league average total goals, not the ratings
    themselves, whose recency comes from the learning rate. It is accepted so
    every engine takes the same knob and the backtest can sweep them alike.
    """
    if not matches:
        return None

    sweep = pi_rating_pass(
        matches,
        learning_rate=learning_rate,
        carry_over=carry_over,
        error_scale=error_scale,
    )
    ordered = sweep.matches
    home_rating = sweep.home_rating
    away_rating = sweep.away_rating

    weights = time_weights(match_dates(ordered), half_life_days)
    totals = np.array([m.home_goals + m.away_goals for m in ordered], dtype=float)
    mean_total_goals = float(np.sum(weights * totals) / np.sum(weights))

    return PiRatingsModel(
        home_rating=home_rating,
        away_rating=away_rating,
        mean_total_goals=mean_total_goals,
        rho=rho,
    )

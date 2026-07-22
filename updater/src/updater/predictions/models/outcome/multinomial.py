"""Multinomial logistic regression on team indicators.

The ordered models assume the three results lie on one axis: whatever makes a
home win more likely must make an away win less likely, by a linked amount. That
is a strong assumption and probably close to true, but it is an assumption, and
this model exists to price it.

Here each outcome gets its own coefficient vector. A team can raise the
probability of a draw without that being forced to trade off against home and
away wins in the ordered model's fixed ratio. Defensive sides that grind out 0-0s
are the obvious case the ordered link cannot represent and this one can.

The cost is parameters: two free vectors of length (teams + 1) rather than one
strength per team plus two cutpoints, so roughly twice the count on the same
data. If the ordinality assumption is close to true, that extra freedom is spent
fitting noise and this model should lose. Comparing the two is therefore a direct
test of whether football results are as one-dimensional as everyone assumes.

The away-win class is the reference (coefficients pinned at zero), since only
differences between class scores affect a softmax.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence

import numpy as np

from updater.predictions.distributions import (
    AWAY_WIN,
    DRAW,
    HOME_WIN,
    MatchResult,
    OutcomePrediction,
    match_dates,
    match_outcome,
    outcome_from_probs,
    time_weights,
)

# Classes carrying free coefficients: away win is the pinned reference.
FREE_CLASSES = (HOME_WIN, DRAW)


def _softmax(scores: np.ndarray) -> np.ndarray:
    """Row-wise softmax, shifted by the row max for numerical stability."""
    from scipy.special import logsumexp

    return np.exp(scores - logsumexp(scores, axis=-1, keepdims=True))


@dataclass
class MultinomialOutcomeModel:
    """Per-outcome coefficient vectors over team indicators."""

    teams: list[str]
    # coefficients[c] holds [per-team weights..., intercept] for free class c.
    coefficients: dict[int, np.ndarray]
    index: dict[str, int]
    produces_scoreline: bool = field(default=False, init=False)

    def _features(self, home_team: str, away_team: str) -> np.ndarray:
        """Separate home-team and away-team indicator blocks, plus an intercept.

        Encoding the fixture as a *difference* of indicators would be half the
        parameters, but it makes each class score a single unbounded linear
        function of one axis, and the draw class then runs away to absurd
        probabilities at the extremes of it. Giving each team its own home and
        away coefficient per class costs parameters and buys the thing this
        model exists to test: a side that draws unusually often can be described
        as such, rather than only as a point on the strength axis.
        """
        count = len(self.teams)
        features = np.zeros(2 * count + 1)
        home_position = self.index.get(home_team)
        away_position = self.index.get(away_team)
        # An unseen (promoted) team contributes nothing, leaving the fixture to
        # be decided by its opponent's coefficients and the intercept.
        if home_position is not None:
            features[home_position] = 1.0
        if away_position is not None:
            features[count + away_position] = 1.0
        features[-1] = 1.0
        return features

    def predict_outcome(self, home_team: str, away_team: str) -> OutcomePrediction:
        features = self._features(home_team, away_team)
        scores = np.zeros(3)
        for outcome, weights in self.coefficients.items():
            scores[outcome] = float(np.dot(weights, features))
        scores[AWAY_WIN] = 0.0
        return outcome_from_probs(home_team, away_team, _softmax(scores))


def fit_multinomial(
    matches: Sequence[MatchResult],
    half_life_days: float = 365.0,
    regularisation: float = 4e-1,
    max_iter: int = 300,
) -> Optional[MultinomialOutcomeModel]:
    """Fit the coefficients by weighted maximum likelihood with an L2 penalty.

    The penalty is an order of magnitude heavier than the ordered model's, and
    it has to be: this fit carries roughly four coefficients per team against
    the same three-way outcome, so left loose it happily fits each side's draw
    quirks and predicts draws at rates football never produces. The default was
    chosen on out-of-sample RPS, which is flat between about 0.2 and 0.4 and
    degrades on either side of that.
    """
    from scipy.optimize import minimize

    if not matches:
        return None

    ordered = list(matches)
    teams = sorted({m.home_team for m in ordered} | {m.away_team for m in ordered})
    index = {team: i for i, team in enumerate(teams)}
    count = len(teams)
    width = 2 * count + 1

    design = np.zeros((len(ordered), width))
    for row, match in enumerate(ordered):
        design[row, index[match.home_team]] = 1.0
        design[row, count + index[match.away_team]] = 1.0
        design[row, -1] = 1.0

    outcomes = np.array(
        [match_outcome(m.home_goals, m.away_goals) for m in ordered], dtype=int
    )
    weights = time_weights(match_dates(ordered), half_life_days)

    def objective(params: np.ndarray) -> float:
        blocks = params.reshape(len(FREE_CLASSES), width)
        scores = np.zeros((len(ordered), 3))
        for position, outcome in enumerate(FREE_CLASSES):
            scores[:, outcome] = design @ blocks[position]
        probs = _softmax(scores)
        chosen = np.clip(probs[np.arange(len(outcomes)), outcomes], 1e-12, None)
        # The intercepts are the league's base rates and must not be shrunk
        # towards zero, so the penalty covers the team columns only.
        penalty = regularisation * float(np.sum(blocks[:, :-1] ** 2))
        return float(-np.sum(weights * np.log(chosen))) + penalty

    result = minimize(
        objective,
        np.zeros(len(FREE_CLASSES) * width),
        method="L-BFGS-B",
        options={"maxiter": max_iter},
    )

    blocks = result.x.reshape(len(FREE_CLASSES), width)
    return MultinomialOutcomeModel(
        teams=teams,
        coefficients={
            outcome: blocks[position].copy()
            for position, outcome in enumerate(FREE_CLASSES)
        },
        index=index,
    )

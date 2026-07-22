"""Dixon-Coles engine (predictions v3).

These lock in the model's core guarantees: it fits without error, the emitted
distributions are valid probabilities, the correct favourite emerges from
lopsided data, home advantage lifts the home rate, and the predicted scoreline
is the matrix mode.
"""

from datetime import datetime, timedelta

import numpy as np

from updater.predictions.predict_v3 import (
    DixonColesModel,
    MatchResult,
    fit_dixon_coles,
)


def _match(day: int, home: str, away: str, hg: int, ag: int) -> MatchResult:
    return MatchResult(datetime(2024, 1, 1) + timedelta(days=day), home, away, hg, ag)


def _fit(matches: list[MatchResult]) -> DixonColesModel:
    """Fit and assert a model came back, narrowing the Optional for the tests."""
    model = fit_dixon_coles(matches)
    assert model is not None
    return model


def _round_robin(strong: str, weak: str, repeats: int = 12) -> list[MatchResult]:
    """`strong` reliably beats `weak`, alternating venues."""
    matches = []
    for r in range(repeats):
        if r % 2 == 0:
            matches.append(_match(r * 7, strong, weak, 3, 0))
        else:
            matches.append(_match(r * 7, weak, strong, 0, 2))
    return matches


class TestFit:
    def test_returns_none_without_matches(self):
        assert fit_dixon_coles([]) is None

    def test_fits_a_model(self):
        model = _fit(_round_robin("A", "B"))
        assert isinstance(model, DixonColesModel)
        assert set(model.teams) == {"A", "B"}

    def test_stronger_team_has_higher_attack_rating(self):
        model = _fit(_round_robin("A", "B"))
        assert model.attack["A"] > model.attack["B"]


class TestPredictionDistributions:
    def test_marginals_and_matrix_sum_to_one(self):
        model = _fit(_round_robin("A", "B"))
        pred = model.predict("A", "B")

        assert abs(sum(pred.home_goals_dist) - 1.0) < 1e-9
        assert abs(sum(pred.away_goals_dist) - 1.0) < 1e-9
        matrix_total = sum(sum(row) for row in pred.scoreline_matrix)
        assert abs(matrix_total - 1.0) < 1e-9

    def test_outcome_probabilities_sum_to_one(self):
        model = _fit(_round_robin("A", "B"))
        pred = model.predict("A", "B")
        total = pred.prob_home_win + pred.prob_draw + pred.prob_away_win
        assert abs(total - 1.0) < 1e-9

    def test_all_probabilities_are_non_negative(self):
        model = _fit(_round_robin("A", "B"))
        pred = model.predict("A", "B")
        assert min(pred.home_goals_dist) >= 0
        assert min(pred.away_goals_dist) >= 0
        assert pred.prob_home_win >= 0 and pred.prob_away_win >= 0

    def test_favourite_at_home_is_most_likely_to_win(self):
        model = _fit(_round_robin("A", "B"))
        pred = model.predict("A", "B")
        assert pred.prob_home_win > pred.prob_away_win
        assert pred.expected_home_goals > pred.expected_away_goals


class TestHomeAdvantage:
    def test_home_advantage_lifts_the_home_rate_for_equal_teams(self):
        # A and B trade identical 1-1 draws, so only venue distinguishes them.
        matches = [
            _match(day, "A" if day % 14 == 0 else "B", "B" if day % 14 == 0 else "A", 1, 1)
            for day in range(0, 140, 7)
        ]
        model = _fit(matches)
        home_lambda, away_lambda = model.expected_goals("A", "B")
        assert model.home_advantage > 0
        assert home_lambda > away_lambda


class TestXgBlend:
    def test_xg_weight_shifts_ratings_toward_expected_goals(self):
        # A scores few actual goals but racks up high xG; the xG blend should
        # rate its attack higher than a pure-goals fit does.
        matches = []
        for r in range(12):
            home, away = ("A", "B") if r % 2 == 0 else ("B", "A")
            # A (whoever is playing) draws 0-0 on the scoreboard but with high xG.
            hxg, axg = (2.5, 0.5) if home == "A" else (0.5, 2.5)
            matches.append(_match(r * 7, home, away, 0, 0)._replace(home_xg=hxg, away_xg=axg))

        goals_only = fit_dixon_coles(matches, xg_weight=0.0)
        with_xg = fit_dixon_coles(matches, xg_weight=0.7)
        assert goals_only is not None and with_xg is not None
        assert with_xg.attack["A"] > goals_only.attack["A"]

        pred = with_xg.predict("A", "B")
        assert abs(sum(pred.home_goals_dist) - 1.0) < 1e-9


class TestUnknownTeam:
    def test_unseen_team_falls_back_to_the_weakest_prior(self):
        # A dominates B, so B anchors the weak prior. An unseen team C should be
        # treated no better than that, i.e. the strong side is favoured at home.
        model = _fit(_round_robin("A", "B"))
        pred = model.predict("A", "C")
        assert abs(sum(pred.home_goals_dist) - 1.0) < 1e-9
        assert pred.prob_home_win > pred.prob_away_win


class TestPredictedScoreline:
    def test_predicted_score_is_the_matrix_mode(self):
        model = _fit(_round_robin("A", "B"))
        pred = model.predict("A", "B")
        matrix = np.array(pred.scoreline_matrix)
        expected = np.unravel_index(int(np.argmax(matrix)), matrix.shape)
        assert (pred.predicted_home_goals, pred.predicted_away_goals) == expected

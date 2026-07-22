"""The direct home/draw/away engines and the shared outcome types.

The registry contract these must satisfy alongside the scoreline models lives in
test_prediction_models.py. What is checked here is the behaviour specific to
forecasting a result without a goal model: that the ordered link is a proper
ordered link, that the draw band is actually estimated rather than implied, and
that nothing in this family can leak into production.
"""

from datetime import datetime, timedelta

import numpy as np
import pytest

from updater.predictions import models
from updater.predictions.distributions import (
    AWAY_WIN,
    DRAW,
    HOME_WIN,
    MatchResult,
    OutcomePrediction,
    match_outcome,
    outcome_from_probs,
    outcome_of,
)
from updater.predictions.models.outcome.common import (
    OrderedCutpoints,
    ordered_probabilities,
    unpack_cutpoints,
)
from updater.predictions.models.outcome.ordered import fit_ordered


def _match(day: int, home: str, away: str, hg: int, ag: int) -> MatchResult:
    return MatchResult(datetime(2024, 1, 1) + timedelta(days=day), home, away, hg, ag)


def _league(repeats: int = 10) -> list[MatchResult]:
    """A four-team league with a clear strength order: A > B > C > D."""
    strength = {"A": 3, "B": 2, "C": 1, "D": 0}
    teams = list(strength)
    matches: list[MatchResult] = []
    day = 0
    for r in range(repeats):
        for i, home in enumerate(teams):
            for away in teams[i + 1 :]:
                gap = strength[home] - strength[away]
                if r % 2 == 0:
                    matches.append(_match(day, home, away, max(gap, 0) + 1, 1))
                else:
                    matches.append(_match(day, away, home, 1, max(gap, 0) + 1))
                day += 3
    return matches


@pytest.fixture(scope="module")
def league() -> list[MatchResult]:
    return _league()


# --- the shared outcome types -------------------------------------------------


def test_match_outcome_encodes_the_three_results() -> None:
    assert match_outcome(2, 1) == HOME_WIN
    assert match_outcome(1, 1) == DRAW
    assert match_outcome(0, 3) == AWAY_WIN


def test_outcome_from_probs_renormalises() -> None:
    pred = outcome_from_probs("A", "B", [2.0, 1.0, 1.0])
    assert sum(pred.probs) == pytest.approx(1.0)
    assert pred.prob_home_win == pytest.approx(0.5)


def test_outcome_from_probs_clips_negatives_away() -> None:
    """Pooling and link arithmetic can drift a hair below zero; a log would blow up."""
    pred = outcome_from_probs("A", "B", [0.6, 0.4, -1e-17])
    assert pred.prob_away_win > 0.0
    assert sum(pred.probs) == pytest.approx(1.0)


def test_outcome_from_probs_accepts_an_array() -> None:
    pred = outcome_from_probs("A", "B", np.array([0.5, 0.25, 0.25]))
    assert pred.probs == pytest.approx((0.5, 0.25, 0.25))


def test_outcome_of_collapses_a_scoreline_prediction(league) -> None:
    model = models.build("dixon-coles").fit(league)
    assert model is not None
    scoreline = model.predict("A", "D")
    collapsed = outcome_of(scoreline)

    assert isinstance(collapsed, OutcomePrediction)
    assert collapsed.probs == pytest.approx(
        (scoreline.prob_home_win, scoreline.prob_draw, scoreline.prob_away_win)
    )
    assert (collapsed.home_team, collapsed.away_team) == ("A", "D")


# --- the ordered link ---------------------------------------------------------


def test_ordered_probabilities_sum_to_one() -> None:
    for eta in (-3.0, -0.5, 0.0, 0.5, 3.0):
        assert sum(ordered_probabilities(eta, -0.6, 0.1)) == pytest.approx(1.0)


def test_home_win_probability_rises_with_eta() -> None:
    """The ordinality assumption itself: a better home side never gets less likely."""
    etas = np.linspace(-3.0, 3.0, 25)
    probs = ordered_probabilities(etas, -0.6, 0.1)
    assert np.all(np.diff(probs[:, HOME_WIN]) > 0)
    assert np.all(np.diff(probs[:, AWAY_WIN]) < 0)


def test_draw_is_likeliest_for_evenly_matched_sides() -> None:
    """The draw band peaks between the cutpoints, not at the extremes."""
    lower, upper = -0.6, 0.1
    etas = np.linspace(-4.0, 4.0, 81)
    probs = ordered_probabilities(etas, lower, upper)
    peak = etas[int(np.argmax(probs[:, DRAW]))]
    assert lower <= peak <= upper
    assert probs[:, DRAW].max() > probs[0, DRAW]
    assert probs[:, DRAW].max() > probs[-1, DRAW]


def test_a_wider_draw_band_predicts_more_draws() -> None:
    narrow = ordered_probabilities(0.0, -0.1, 0.1)
    wide = ordered_probabilities(0.0, -1.0, 1.0)
    assert wide[DRAW] > narrow[DRAW]


def test_unpack_cutpoints_always_orders_them() -> None:
    """However the optimiser wanders, c2 > c1, so no draw probability goes negative."""
    for lower_raw, gap_raw in [(0.0, -5.0), (-2.0, 2.0), (3.5, 0.0)]:
        lower, upper = unpack_cutpoints(lower_raw, gap_raw)
        assert upper > lower


def test_cutpoints_report_the_home_advantage_they_encode() -> None:
    """Home advantage is unidentified as its own term, so it lives here instead."""
    symmetric = OrderedCutpoints(lower=-0.5, upper=0.5)
    assert symmetric.home_advantage == pytest.approx(0.0)
    assert symmetric.draw_width == pytest.approx(1.0)

    # Cutpoints shifted down mean a level fixture already leans home.
    shifted = OrderedCutpoints(lower=-0.8, upper=0.2)
    assert shifted.home_advantage == pytest.approx(0.3)
    assert shifted.probabilities(0.0)[HOME_WIN] > shifted.probabilities(0.0)[AWAY_WIN]


def test_unknown_link_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unknown link"):
        ordered_probabilities(0.0, -0.5, 0.5, link="cauchy")


# --- the fitted engines -------------------------------------------------------


@pytest.mark.parametrize("link", ["logit", "probit"])
def test_ordered_fit_recovers_the_strength_order(league, link: str) -> None:
    model = fit_ordered(league, link=link)
    assert model is not None
    assert model.rating("A") > model.rating("B") > model.rating("C") > model.rating("D")


def test_ordered_fit_finds_a_positive_draw_band(league) -> None:
    model = fit_ordered(league)
    assert model is not None
    assert model.cutpoints.draw_width > 0


def test_ordered_fit_prices_a_promoted_side_as_weak(league) -> None:
    """The unseen-team prior is the weakest few, matching the scoreline models."""
    model = fit_ordered(league)
    assert model is not None
    assert model.rating("Newly Promoted FC") < model.rating("A")


def test_ordered_eta_is_antisymmetric(league) -> None:
    """Swapping the sides flips the latent supremacy; the venue effect is elsewhere."""
    model = fit_ordered(league)
    assert model is not None
    assert model.eta("A", "D") == pytest.approx(-model.eta("D", "A"))


@pytest.mark.parametrize("name", models.available(models.OUTCOME))
def test_outcome_models_track_the_league_base_rates(name: str) -> None:
    """Averaged over the fixtures it trained on, a model should match reality.

    A model can be wrong about any single match, but if its mean predicted draw
    rate is far from the observed one it is misspecified, not just imprecise.
    """
    matches = _league(repeats=12)
    model = models.build(name).fit(matches)
    assert model is not None

    predicted = np.array(
        [models.predict_outcome(model, m.home_team, m.away_team).probs for m in matches]
    )
    observed = np.array([match_outcome(m.home_goals, m.away_goals) for m in matches])

    for index in (HOME_WIN, DRAW, AWAY_WIN):
        assert predicted[:, index].mean() == pytest.approx(
            float((observed == index).mean()), abs=0.12
        )


@pytest.mark.parametrize("name", ["direct-elo", "direct-pi-ratings"])
def test_direct_rating_models_beat_no_information(name: str, league) -> None:
    """The ordered link must actually be reading the ratings, not ignoring them."""
    model = models.build(name).fit(league)
    assert model is not None

    strong = models.predict_outcome(model, "A", "D")
    weak = models.predict_outcome(model, "D", "A")
    assert strong.prob_home_win > weak.prob_home_win


def test_blend_weights_are_a_mixture(league) -> None:
    model = models.build("outcome-blend").fit(league)
    assert model is not None
    assert sum(model.weights) == pytest.approx(1.0)
    assert all(w >= 0 for w in model.weights)
    assert len(model.weights) == len(model.members)


def test_blend_falls_back_to_equal_weights_on_a_short_window(league) -> None:
    """Too little holdout to learn a weight, so it must not invent one."""
    model = models.build("outcome-blend").fit(league[:40])
    assert model is not None
    assert model.holdout_size < 60
    assert model.weights == pytest.approx([0.5, 0.5])


def test_blend_mixes_across_the_two_families(league) -> None:
    model = models.build("outcome-blend").fit(league)
    assert model is not None
    families = {models.family_of(name) for name in model.member_names}
    assert families == {models.SCORELINE, models.OUTCOME}


def test_blend_rejects_a_nested_ensemble() -> None:
    from updater.predictions.models.outcome.blend import fit_outcome_blend

    with pytest.raises(ValueError, match="cannot contain"):
        fit_outcome_blend(_league(), member_names=("dixon-coles", "stacked"))


def test_blend_prediction_lies_between_its_members(league) -> None:
    """A weighted mean cannot escape the range of the things it averages."""
    model = models.build("outcome-blend").fit(league)
    assert model is not None

    blended = models.predict_outcome(model, "A", "D").prob_home_win
    member_probs = [
        models.predict_outcome(member, "A", "D").prob_home_win
        for member in model.members
    ]
    assert min(member_probs) - 1e-9 <= blended <= max(member_probs) + 1e-9


# --- keeping the family out of production ------------------------------------


@pytest.mark.parametrize("name", models.available(models.OUTCOME))
def test_build_v3_refuses_outcome_models(name: str) -> None:
    """The dashboard stores a goal matrix, so these must never reach the pipeline."""
    from updater.predictions.build_v3 import build_v3_predictions

    with pytest.raises(ValueError, match="outcome-only"):
        build_v3_predictions(raw_data=None, current_season=2025, model_name=name)


def test_default_production_model_is_a_scoreline_model() -> None:
    assert models.family_of(models.DEFAULT_MODEL) == models.SCORELINE


@pytest.mark.parametrize("engine", ["ensemble", "stacked"])
def test_scoreline_ensembles_reject_outcome_members(engine: str, league) -> None:
    """Those average matrices, so an outcome member has nothing to contribute."""
    with pytest.raises(ValueError, match="outcome-only"):
        models.build(engine, members=("dixon-coles", "ordered-logit")).fit(league)

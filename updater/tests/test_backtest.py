"""Backtest scoring metrics.

The harness exists to rank engines against each other, so the metrics have to be
right or the ranking is worse than useless. These check RPS against hand-computed
values, that the paired comparison cancels shared fixture difficulty, and that
calibration error behaves on constructed cases.
"""

import pytest

from updater.predictions.backtest import (
    Metrics,
    outcome,
    paired_rps_difference,
    ranked_probability_score,
)

HOME, DRAW, AWAY = 0, 1, 2


def test_outcome_classification() -> None:
    assert outcome(2, 1) == HOME
    assert outcome(1, 1) == DRAW
    assert outcome(0, 3) == AWAY


def test_rps_is_zero_for_a_confident_correct_forecast() -> None:
    assert ranked_probability_score((1.0, 0.0, 0.0), HOME) == pytest.approx(0.0)


def test_rps_is_one_for_a_confident_wrong_forecast() -> None:
    """The worst case is certainty on the outcome at the far end of the order."""
    assert ranked_probability_score((1.0, 0.0, 0.0), AWAY) == pytest.approx(1.0)


def test_rps_penalises_the_ordering_not_just_the_miss() -> None:
    """Predicting a draw when the away side wins beats predicting a home win."""
    near = ranked_probability_score((0.0, 1.0, 0.0), AWAY)
    far = ranked_probability_score((1.0, 0.0, 0.0), AWAY)
    assert near < far


def test_rps_hand_computed_case() -> None:
    # cumulative pred = [0.5, 0.8], cumulative obs for a draw = [0, 1]
    # ((0.5 - 0) ^ 2 + (0.8 - 1) ^ 2) / 2 = (0.25 + 0.04) / 2
    assert ranked_probability_score((0.5, 0.3, 0.2), DRAW) == pytest.approx(0.145)


def _metrics(label: str, forecasts, actuals) -> Metrics:
    metrics = Metrics(label=label)
    for probs, actual in zip(forecasts, actuals):
        metrics.add(probs, actual)
    return metrics


def test_metrics_aggregate_over_matches() -> None:
    metrics = _metrics(
        "m",
        [(0.6, 0.3, 0.1), (0.2, 0.3, 0.5), (0.4, 0.4, 0.2)],
        [HOME, AWAY, DRAW],
    )
    assert metrics.n == 3
    # Two of three modal outcomes were right; the third ties on 0.4 and argmax
    # takes the first, a home win, against an actual draw.
    assert metrics.outcome_accuracy == pytest.approx(2 / 3)
    assert metrics.rps > 0
    assert metrics.log_loss > 0


def test_paired_difference_is_zero_against_itself() -> None:
    metrics = _metrics("m", [(0.6, 0.3, 0.1)] * 5, [HOME] * 5)
    comparison = paired_rps_difference(metrics, metrics)
    assert comparison.mean_difference == 0.0
    assert comparison.standard_error == 0.0


def test_paired_difference_detects_a_consistent_edge() -> None:
    """A model that is better on every single match must clear the interval."""
    actuals = [HOME, AWAY, DRAW, HOME, AWAY, DRAW] * 10
    sharp = _metrics("sharp", [(0.34, 0.33, 0.33)] * 60, actuals)
    sharper = _metrics(
        "sharper",
        [
            {HOME: (0.6, 0.25, 0.15), DRAW: (0.25, 0.5, 0.25), AWAY: (0.15, 0.25, 0.6)}[
                a
            ]
            for a in actuals
        ],
        actuals,
    )
    comparison = paired_rps_difference(sharp, sharper)
    assert comparison.mean_difference > 0  # the flat model is worse
    assert abs(comparison.t_statistic) > 2
    assert str(comparison).endswith("*")


def test_paired_difference_reports_a_tie_as_insignificant() -> None:
    """Near-identical models must not be declared separable."""
    actuals = [HOME, DRAW, AWAY] * 20
    a = _metrics("a", [(0.45, 0.30, 0.25)] * 60, actuals)
    b = _metrics("b", [(0.451, 0.299, 0.25)] * 60, actuals)
    comparison = paired_rps_difference(a, b)
    assert abs(comparison.t_statistic) < 2
    assert not str(comparison).endswith("*")


def test_paired_difference_ignores_mismatched_lengths() -> None:
    """A model that skipped fixtures cannot be paired, and must not pretend to."""
    a = _metrics("a", [(0.5, 0.3, 0.2)] * 5, [HOME] * 5)
    b = _metrics("b", [(0.5, 0.3, 0.2)] * 3, [HOME] * 3)
    assert paired_rps_difference(a, b).standard_error == 0.0


def test_calibration_error_is_zero_for_a_perfectly_calibrated_forecast() -> None:
    """Quote 1/3 on everything in a league that is exactly 1/3 each way."""
    actuals = [HOME, DRAW, AWAY] * 30
    metrics = _metrics("m", [(1 / 3, 1 / 3, 1 / 3)] * 90, actuals)
    assert metrics.calibration_error == pytest.approx(0.0, abs=1e-9)


def test_calibration_error_catches_overconfidence() -> None:
    """Claim 90% home wins when they land half the time."""
    actuals = [HOME, AWAY] * 30
    metrics = _metrics("m", [(0.9, 0.05, 0.05)] * 60, actuals)
    assert metrics.calibration_error > 0.2


def _metrics_from(label: str, forecasts, actuals):
    from updater.predictions.backtest import Metrics

    metrics = Metrics(label=label)
    for probs, actual in zip(forecasts, actuals):
        metrics.add(probs, actual)
    return metrics


def test_identical_models_never_disagree() -> None:
    from updater.predictions.backtest import disagreement

    forecasts = [(0.5, 0.3, 0.2), (0.2, 0.3, 0.5), (0.4, 0.4, 0.2)]
    actuals = [0, 2, 1]
    first = _metrics_from("a", forecasts, actuals)
    second = _metrics_from("b", forecasts, actuals)

    report = disagreement(first, second)
    assert report.differing_picks == 0
    assert report.differing_share == 0.0
    assert report.mean_total_variation == pytest.approx(0.0)


def test_disagreement_counts_differing_picks() -> None:
    from updater.predictions.backtest import disagreement

    actuals = [0, 0]
    # Same pick on the first fixture, opposite picks on the second.
    first = _metrics_from("a", [(0.6, 0.3, 0.1), (0.6, 0.3, 0.1)], actuals)
    second = _metrics_from("b", [(0.5, 0.3, 0.2), (0.1, 0.3, 0.6)], actuals)

    report = disagreement(first, second)
    assert report.n == 2
    assert report.differing_picks == 1
    assert report.differing_share == pytest.approx(0.5)
    # Only the second fixture counts towards the split RPS, and the home team
    # won it, so the model that favoured home must score better there.
    assert report.first_rps_when_differing < report.second_rps_when_differing


def test_total_variation_is_zero_to_one() -> None:
    from updater.predictions.backtest import disagreement

    first = _metrics_from("a", [(1.0, 0.0, 0.0)], [0])
    second = _metrics_from("b", [(0.0, 0.0, 1.0)], [0])

    report = disagreement(first, second)
    assert report.mean_total_variation == pytest.approx(1.0)
    assert report.max_total_variation == pytest.approx(1.0)


def test_disagreement_rejects_mismatched_fixtures() -> None:
    from updater.predictions.backtest import disagreement

    first = _metrics_from("a", [(0.5, 0.3, 0.2)], [0])
    second = _metrics_from("b", [(0.5, 0.3, 0.2), (0.5, 0.3, 0.2)], [0, 1])

    with pytest.raises(ValueError, match="different fixtures"):
        disagreement(first, second)

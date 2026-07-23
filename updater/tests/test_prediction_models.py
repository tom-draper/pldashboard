"""The prediction-engine registry and its alternative models.

These hold every registered engine to the same contract, since the whole point
of the registry is that the backtest and the updater can treat them alike: fit
without error, emit a valid probability distribution, rate the stronger side
higher, and fall back gracefully for a team never seen in training. Model-specific
behaviour (the bivariate shared component, the negative-binomial dispersion, the
pi-ratings update) is then checked individually.
"""

from datetime import datetime, timedelta

import numpy as np
import pytest

from updater.predictions import models
from updater.predictions.distributions import MatchResult
from updater.predictions.models.scoreline.pi_ratings import fit_pi_ratings

ALL_MODELS = models.available()
SCORELINE_MODELS = models.available(models.SCORELINE)
OUTCOME_MODELS = models.available(models.OUTCOME)

# empirical-scoreline is deliberately team-blind: it quotes the league's usual
# scoreline whoever is playing, so it is exempt from the tests that assert a
# fixture's teams change the forecast.
RATED_MODELS = [name for name in ALL_MODELS if name != "empirical-scoreline"]
RATED_SCORELINE_MODELS = [n for n in SCORELINE_MODELS if n != "empirical-scoreline"]


def _match(day: int, home: str, away: str, hg: int, ag: int) -> MatchResult:
    return MatchResult(datetime(2024, 1, 1) + timedelta(days=day), home, away, hg, ag)


def _league(repeats: int = 8) -> list[MatchResult]:
    """A four-team league with a clear strength order: A > B > C > D."""
    strength = {"A": 3, "B": 2, "C": 1, "D": 0}
    teams = list(strength)
    matches: list[MatchResult] = []
    day = 0
    for r in range(repeats):
        for i, home in enumerate(teams):
            for away in teams[i + 1 :]:
                # Goals track the strength gap, with the venues alternating.
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


@pytest.mark.parametrize("name", ALL_MODELS)
def test_registry_builds_every_model(name: str) -> None:
    predictor = models.build(name, half_life_days=365.0)
    assert predictor.name


def test_build_rejects_unknown_model() -> None:
    with pytest.raises(ValueError, match="Unknown model"):
        models.build("no-such-model")


@pytest.mark.parametrize("name", ALL_MODELS)
def test_fit_returns_none_for_no_matches(name: str) -> None:
    assert models.build(name).fit([]) is None


@pytest.mark.parametrize("name", ALL_MODELS)
def test_outcome_prediction_is_a_valid_distribution(name: str, league) -> None:
    """The one contract both families share, and what the backtest scores."""
    model = models.build(name).fit(league)
    assert model is not None

    pred = models.predict_outcome(model, "A", "D")
    for probability in pred.probs:
        assert 0.0 <= probability <= 1.0
    assert sum(pred.probs) == pytest.approx(1.0, abs=1e-9)


@pytest.mark.parametrize("name", RATED_MODELS)
def test_stronger_team_is_favoured_on_outcome(name: str, league) -> None:
    """Holds for both families, since neither needs a scoreline to say who wins."""
    model = models.build(name).fit(league)
    assert model is not None

    strong_at_home = models.predict_outcome(model, "A", "D")
    weak_at_home = models.predict_outcome(model, "D", "A")

    assert strong_at_home.prob_home_win > strong_at_home.prob_away_win
    assert weak_at_home.prob_away_win > weak_at_home.prob_home_win


@pytest.mark.parametrize("name", ALL_MODELS)
def test_unknown_team_is_priced_by_every_family(name: str, league) -> None:
    """Promoted sides have no history; every engine must still price the fixture."""
    model = models.build(name).fit(league)
    assert model is not None

    pred = models.predict_outcome(model, "A", "Newly Promoted FC")
    assert sum(pred.probs) == pytest.approx(1.0, abs=1e-9)


@pytest.mark.parametrize("name", OUTCOME_MODELS)
def test_outcome_models_declare_they_have_no_scoreline(name: str, league) -> None:
    """The flag the backtest and model_predictions both branch on, so it must be right."""
    model = models.build(name).fit(league)
    assert model is not None
    assert models.produces_scoreline(model) is False
    assert not hasattr(model, "predict")


@pytest.mark.parametrize("name", SCORELINE_MODELS)
def test_scoreline_models_are_reported_as_such(name: str, league) -> None:
    model = models.build(name).fit(league)
    assert model is not None
    assert models.produces_scoreline(model) is True


def test_families_partition_the_registry() -> None:
    assert set(SCORELINE_MODELS) | set(OUTCOME_MODELS) == set(ALL_MODELS)
    assert not set(SCORELINE_MODELS) & set(OUTCOME_MODELS)
    assert all(models.family_of(n) == models.SCORELINE for n in SCORELINE_MODELS)
    assert all(models.family_of(n) == models.OUTCOME for n in OUTCOME_MODELS)


def test_available_rejects_an_unknown_family() -> None:
    with pytest.raises(ValueError, match="Unknown family"):
        models.available("nonsense")


@pytest.mark.parametrize("name", SCORELINE_MODELS)
def test_prediction_is_a_valid_distribution(name: str, league) -> None:
    model = models.build(name).fit(league)
    assert model is not None
    pred = model.predict("A", "D")

    matrix = np.array(pred.scoreline_matrix)
    assert matrix.min() >= 0
    assert matrix.sum() == pytest.approx(1.0, abs=1e-9)
    assert np.array(pred.home_goals_dist).sum() == pytest.approx(1.0, abs=1e-9)
    assert np.array(pred.away_goals_dist).sum() == pytest.approx(1.0, abs=1e-9)

    outcomes = pred.prob_home_win + pred.prob_draw + pred.prob_away_win
    assert outcomes == pytest.approx(1.0, abs=1e-9)


@pytest.mark.parametrize("name", RATED_SCORELINE_MODELS)
def test_stronger_team_is_favoured(name: str, league) -> None:
    model = models.build(name).fit(league)
    assert model is not None

    strong_at_home = model.predict("A", "D")
    weak_at_home = model.predict("D", "A")

    assert strong_at_home.prob_home_win > strong_at_home.prob_away_win
    assert weak_at_home.prob_away_win > weak_at_home.prob_home_win
    assert strong_at_home.expected_home_goals > strong_at_home.expected_away_goals


@pytest.mark.parametrize("name", SCORELINE_MODELS)
def test_unknown_team_falls_back_without_error(name: str, league) -> None:
    """Promoted sides have no history; every engine must still price the fixture."""
    model = models.build(name).fit(league)
    assert model is not None

    pred = model.predict("A", "Newly Promoted FC")
    assert np.array(pred.scoreline_matrix).sum() == pytest.approx(1.0, abs=1e-9)
    assert 0.0 <= pred.prob_home_win <= 1.0


@pytest.mark.parametrize("name", SCORELINE_MODELS)
def test_predicted_scoreline_is_the_matrix_mode(name: str, league) -> None:
    model = models.build(name).fit(league)
    assert model is not None
    pred = model.predict("A", "C")

    matrix = np.array(pred.scoreline_matrix)
    peak = np.unravel_index(int(np.argmax(matrix)), matrix.shape)
    assert (pred.predicted_home_goals, pred.predicted_away_goals) == (
        int(peak[0]),
        int(peak[1]),
    )


def test_poisson_ablation_pins_rho_at_zero(league) -> None:
    """The `poisson` entry exists to isolate the Dixon-Coles correction."""
    model = models.build("poisson").fit(league)
    assert model is not None
    assert model.rho == 0.0


def test_bivariate_shared_component_is_non_negative(league) -> None:
    model = models.build("bivariate-poisson").fit(league)
    assert model is not None
    assert model.lambda_shared >= 0.0


def test_bivariate_matches_poisson_when_shared_component_vanishes() -> None:
    """With lambda_shared -> 0 the joint must collapse to independent Poisson."""
    from updater.predictions.models.scoreline.poisson_family import _bivariate_log_pmf

    goals = np.arange(6, dtype=float)
    hg, ag = np.meshgrid(goals, goals, indexing="ij")
    lam_h, lam_a = 1.6, 1.1

    joint = np.exp(
        _bivariate_log_pmf(hg, ag, np.full_like(hg, lam_h), np.full_like(ag, lam_a), 0.0)
    )
    from scipy.stats import poisson

    independent = np.outer(poisson.pmf(goals, lam_h), poisson.pmf(goals, lam_a))
    assert joint == pytest.approx(independent, abs=1e-12)


def test_bivariate_shared_component_induces_positive_correlation() -> None:
    """The shared term is what buys correlation; without it there is none."""
    from updater.predictions.models.scoreline.poisson_family import _bivariate_log_pmf

    goals = np.arange(11, dtype=float)
    hg, ag = np.meshgrid(goals, goals, indexing="ij")

    def correlation(shared: float) -> float:
        joint = np.exp(
            _bivariate_log_pmf(
                hg, ag, np.full_like(hg, 1.4), np.full_like(ag, 1.1), shared
            )
        )
        joint = joint / joint.sum()
        mean_h = (hg * joint).sum()
        mean_a = (ag * joint).sum()
        return float((hg * ag * joint).sum() - mean_h * mean_a)

    assert correlation(0.0) == pytest.approx(0.0, abs=1e-9)
    assert correlation(0.3) > 0.05


def test_negative_binomial_tends_to_poisson_for_large_size() -> None:
    from updater.predictions.models.scoreline.poisson_family import _negative_binomial_log_pmf
    from scipy.stats import poisson

    goals = np.arange(8, dtype=float)
    mean = np.full_like(goals, 1.5)
    nb = np.exp(_negative_binomial_log_pmf(goals, mean, 1e6))
    assert nb == pytest.approx(poisson.pmf(goals, 1.5), abs=1e-5)


def test_negative_binomial_small_size_fattens_the_tail() -> None:
    from updater.predictions.models.scoreline.poisson_family import _negative_binomial_log_pmf
    from scipy.stats import poisson

    goals = np.arange(12, dtype=float)
    mean = np.full_like(goals, 1.5)
    overdispersed = np.exp(_negative_binomial_log_pmf(goals, mean, 2.0))
    # Same mean, more mass on 0 and on the high scores, less in the middle.
    assert overdispersed[0] > poisson.pmf(0, 1.5)
    assert overdispersed[6:].sum() > poisson.pmf(goals, 1.5)[6:].sum()


def test_pi_ratings_reward_the_winner_and_penalise_the_loser() -> None:
    """A one-sided history must separate the two teams' ratings."""
    matches = [
        _match(day * 7, "A" if day % 2 == 0 else "B", "B" if day % 2 == 0 else "A", 3, 0)
        if day % 2 == 0
        else _match(day * 7, "B", "A", 0, 3)
        for day in range(12)
    ]
    model = fit_pi_ratings(matches)
    assert model is not None
    assert model.home_rating["A"] > model.home_rating["B"]
    assert model.away_rating["A"] > model.away_rating["B"]


def test_pi_ratings_error_scaling_discounts_thrashings() -> None:
    """A 7-0 must not move a rating seven times as far as a 1-0."""
    narrow = [_match(d * 7, "A", "B", 1, 0) for d in range(6)]
    thrashing = [_match(d * 7, "A", "B", 7, 0) for d in range(6)]

    narrow_model = fit_pi_ratings(narrow)
    thrashing_model = fit_pi_ratings(thrashing)
    assert narrow_model is not None and thrashing_model is not None

    narrow_gap = narrow_model.home_rating["A"] - narrow_model.away_rating["B"]
    thrashing_gap = thrashing_model.home_rating["A"] - thrashing_model.away_rating["B"]
    assert thrashing_gap > narrow_gap
    assert thrashing_gap < 7 * narrow_gap


def test_pi_ratings_expected_goals_stay_positive() -> None:
    """Even an extreme supremacy must not drive a rate negative."""
    model = fit_pi_ratings([_match(d * 7, "A", "B", 9, 0) for d in range(40)])
    assert model is not None
    home, away = model.expected_goals("A", "B")
    assert home > 0 and away > 0


def test_empirical_scoreline_ignores_the_teams(league) -> None:
    """The whole point of the baseline: the fixture does not affect the forecast."""
    model = models.build("empirical-scoreline").fit(league)
    assert model is not None

    strong_at_home = model.predict("A", "D")
    weak_at_home = model.predict("D", "A")
    assert strong_at_home.scoreline_matrix == weak_at_home.scoreline_matrix
    assert strong_at_home.prob_home_win == weak_at_home.prob_home_win


def test_empirical_scoreline_predicts_the_most_common_scoreline() -> None:
    """It must return the modal result of its training data, and nothing cleverer."""
    matches = (
        [_match(d, "A", "B", 2, 1) for d in range(20)]
        + [_match(20 + d, "C", "D", 0, 0) for d in range(5)]
        + [_match(40 + d, "A", "C", 1, 3) for d in range(3)]
    )
    model = models.build("empirical-scoreline").fit(matches)
    assert model is not None

    pred = model.predict("X", "Y")
    assert (pred.predicted_home_goals, pred.predicted_away_goals) == (2, 1)


def test_empirical_scoreline_reflects_observed_frequencies() -> None:
    """Half the matches 1-0 and half 0-1 must come back as an even split."""
    matches = [_match(d * 2, "A", "B", 1, 0) for d in range(25)] + [
        _match(d * 2 + 1, "A", "B", 0, 1) for d in range(25)
    ]
    model = models.build("empirical-scoreline").fit(matches)
    assert model is not None

    pred = model.predict("X", "Y")
    matrix = np.array(pred.scoreline_matrix)
    assert matrix[1][0] == pytest.approx(matrix[0][1], rel=0.05)
    assert matrix[1][0] + matrix[0][1] == pytest.approx(1.0, abs=0.02)


def test_empirical_scoreline_never_assigns_zero_probability() -> None:
    """Smoothing must keep log-loss finite when a novel scoreline turns up."""
    model = models.build("empirical-scoreline").fit(
        [_match(d, "A", "B", 1, 0) for d in range(10)]
    )
    assert model is not None
    assert np.array(model.predict("X", "Y").scoreline_matrix).min() > 0


def test_empirical_scoreline_mean_goals_track_the_data() -> None:
    """The smoothing floor must not inflate the distribution's mean."""
    model = models.build("empirical-scoreline").fit(
        [_match(d, "A", "B", 2, 1) for d in range(60)]
    )
    assert model is not None
    home, away = model.expected_goals("X", "Y")
    assert home == pytest.approx(2.0, abs=0.05)
    assert away == pytest.approx(1.0, abs=0.05)


def test_goal_average_strengths_are_ratios_to_the_league(league) -> None:
    """An average team rates 1.0, so it should predict close to the league mean."""
    model = models.build("goal-average").fit(league)
    assert model is not None

    home, away = model.expected_goals("Unknown FC", "Also Unknown FC")
    assert home == pytest.approx(model.league_home_goals)
    assert away == pytest.approx(model.league_away_goals)


def test_skellam_pmf_matches_a_poisson_difference() -> None:
    """Check the Skellam density against the difference it is meant to describe."""
    from updater.predictions.models.scoreline.skellam import skellam_log_pmf
    from scipy.stats import poisson

    lam_h, lam_a = 1.7, 1.2
    goals = np.arange(30)
    home = poisson.pmf(goals, lam_h)
    away = poisson.pmf(goals, lam_a)

    for k in (-3, -1, 0, 1, 2, 5):
        # Convolve the two marginals to get P(X - Y = k) directly.
        brute = sum(
            home[h] * away[h - k] for h in range(len(goals)) if 0 <= h - k < len(goals)
        )
        analytic = float(
            np.exp(skellam_log_pmf(np.array([k]), np.array([lam_h]), np.array([lam_a])))[0]
        )
        assert analytic == pytest.approx(brute, rel=1e-6)


def test_skellam_pmf_is_a_normalised_distribution() -> None:
    from updater.predictions.models.scoreline.skellam import skellam_log_pmf

    differences = np.arange(-25, 26)
    total = np.exp(
        skellam_log_pmf(
            differences, np.full_like(differences, 1.5, dtype=float),
            np.full_like(differences, 1.2, dtype=float),
        )
    ).sum()
    assert total == pytest.approx(1.0, abs=1e-8)


def test_skellam_pmf_is_stable_for_large_rates() -> None:
    """The scaled Bessel call exists to stop this overflowing."""
    from updater.predictions.models.scoreline.skellam import skellam_log_pmf

    value = skellam_log_pmf(np.array([2]), np.array([80.0]), np.array([75.0]))
    assert np.isfinite(value).all()


def test_hierarchical_shrinks_ratings_relative_to_plain_fit(league) -> None:
    """Learned shrinkage should pull ratings in, not push them out."""
    plain = models.build("dixon-coles").fit(league)
    shrunk = models.build("hierarchical").fit(league)
    assert plain is not None and shrunk is not None

    def spread(model) -> float:
        values = np.array(list(model.attack.values()) + list(model.defence.values()))
        return float(values.std())

    assert spread(shrunk) <= spread(plain)


def test_hierarchical_still_orders_the_teams_correctly(league) -> None:
    """Shrinkage must pull ratings together without scrambling their order."""
    model = models.build("hierarchical").fit(league)
    assert model is not None
    assert model.attack["A"] > model.attack["D"]


def test_elo_rewards_winning_and_is_zero_sum() -> None:
    matches = [_match(d * 7, "A", "B", 2, 0) for d in range(10)]
    model = models.build("elo").fit(matches)
    assert model is not None
    assert model.rating["A"] > model.rating["B"]
    # Every update moves the two ratings by equal and opposite amounts.
    assert sum(model.rating.values()) == pytest.approx(2 * 1500.0)


def test_elo_margin_multiplier_damps_blowouts() -> None:
    from updater.predictions.models.scoreline.elo import _margin_multiplier

    assert _margin_multiplier(1) == 1.0
    assert _margin_multiplier(-1) == 1.0  # symmetric in sign
    assert _margin_multiplier(2) > _margin_multiplier(1)
    # A 6-0 must count for less than six times a 1-0.
    assert _margin_multiplier(6) < 6 * _margin_multiplier(1)


def test_elo_learns_a_positive_goals_mapping(league) -> None:
    """A higher rating gap must map to a larger expected goal difference."""
    model = models.build("elo").fit(league)
    assert model is not None
    assert model.slope > 0
    assert model.supremacy("A", "D") > model.supremacy("D", "A")


def test_ensemble_averages_its_members(league) -> None:
    """The combined matrix must be the mean of the members', cell by cell."""
    from updater.predictions.models.scoreline.ensemble import fit_ensemble

    names = ["dixon-coles", "pi-ratings"]
    ensemble = fit_ensemble(league, member_names=names)
    assert ensemble is not None

    members = [models.build(name).fit(league) for name in names]
    expected = np.mean(
        [np.array(m.predict("A", "C").scoreline_matrix) for m in members], axis=0
    )
    combined = np.array(ensemble.predict("A", "C").scoreline_matrix)
    assert combined == pytest.approx(expected, abs=1e-9)


def test_ensemble_prediction_lies_between_its_members(league) -> None:
    """Averaging cannot produce a forecast more extreme than every member."""
    from updater.predictions.models.scoreline.ensemble import fit_ensemble

    names = ["dixon-coles", "pi-ratings"]
    ensemble = fit_ensemble(league, member_names=names)
    assert ensemble is not None

    member_probs = [
        models.build(name).fit(league).predict("A", "D").prob_home_win for name in names
    ]
    combined = ensemble.predict("A", "D").prob_home_win
    assert min(member_probs) <= combined <= max(member_probs)


def test_ensemble_rejects_itself_as_a_member(league) -> None:
    from updater.predictions.models.scoreline.ensemble import fit_ensemble

    with pytest.raises(ValueError, match="cannot contain itself"):
        fit_ensemble(league, member_names=["dixon-coles", "ensemble"])


def test_ensemble_rejects_mismatched_weights(league) -> None:
    from updater.predictions.models.scoreline.ensemble import fit_ensemble

    with pytest.raises(ValueError, match="weights must match"):
        fit_ensemble(league, member_names=["dixon-coles", "elo"], weights=[1.0])


def test_ensemble_weights_shift_the_result(league) -> None:
    """A heavily weighted member should dominate the average."""
    from updater.predictions.models.scoreline.ensemble import fit_ensemble

    names = ["dixon-coles", "pi-ratings"]
    lopsided = fit_ensemble(league, member_names=names, weights=[99.0, 1.0])
    solo = models.build("dixon-coles").fit(league)
    assert lopsided is not None and solo is not None

    assert lopsided.predict("A", "D").prob_home_win == pytest.approx(
        solo.predict("A", "D").prob_home_win, abs=0.02
    )


def test_extended_dc_opts_into_the_match_date(league) -> None:
    """The opt-in flag is what routes the kickoff date to the models that use it."""
    model = models.build("extended-dc").fit(league)
    assert model is not None
    assert getattr(model, "uses_match_date", False) is True


def test_predict_fixture_passes_dates_only_to_models_that_want_them(league) -> None:
    """Engines with the old two-argument signature must be unaffected."""
    plain = models.build("dixon-coles").fit(league)
    assert plain is not None

    without = models.predict_fixture(plain, "A", "D")
    with_date = models.predict_fixture(
        plain, "A", "D", match_date=datetime(2024, 6, 1)
    )
    assert without.scoreline_matrix == with_date.scoreline_matrix


def test_extended_dc_rest_days_change_the_forecast(league) -> None:
    """A congested fixture and a rested one must not produce the same numbers."""
    model = models.build("extended-dc").fit(league)
    assert model is not None
    # Force a non-zero rest effect so the test checks the plumbing, not the fit.
    model.rest_coefficient = 0.2

    last = max(model.last_match_date.values())
    congested = model.predict("A", "D", match_date=last + timedelta(days=2))
    rested = model.predict("A", "D", match_date=last + timedelta(days=12))
    assert congested.expected_home_goals != rested.expected_home_goals


def test_extended_dc_falls_back_without_a_date(league) -> None:
    """No date means assume a normal week, not a crash or a zero rate."""
    model = models.build("extended-dc").fit(league)
    assert model is not None
    pred = model.predict("A", "D", match_date=None)
    assert pred.expected_home_goals > 0


def test_extended_dc_home_advantage_is_shrunk_toward_the_league(league) -> None:
    """Per-team home terms must stay near the shared one on a small sample."""
    model = models.build("extended-dc").fit(league)
    assert model is not None

    deviations = [
        abs(value - model.mean_home_advantage)
        for value in model.home_advantage.values()
    ]
    assert max(deviations) < 0.5  # the bound the fit imposes


def test_rest_covariate_is_centred_and_clipped() -> None:
    from updater.predictions.models.scoreline.extended_dc import (
        MAX_REST_DAYS,
        TYPICAL_REST_DAYS,
        _rest_covariate,
    )

    assert _rest_covariate(TYPICAL_REST_DAYS) == 0.0
    assert _rest_covariate(TYPICAL_REST_DAYS + 7) == pytest.approx(1.0)
    assert _rest_covariate(3) < 0
    # A three-month summer gap must not count as twelve weeks of freshness.
    assert _rest_covariate(90) == _rest_covariate(MAX_REST_DAYS)


def test_dynamic_ratings_track_a_change_in_strength() -> None:
    """The point of a random walk: a team that improves must be seen to improve."""
    from updater.predictions.models.scoreline.dynamic import fit_dynamic

    # "Riser" loses heavily for a season, then wins heavily for one.
    early = [_match(d * 4, "Riser", "Rival", 0, 3) for d in range(20)]
    late = [_match(200 + d * 4, "Riser", "Rival", 3, 0) for d in range(20)]

    after_bad_spell = fit_dynamic(early)
    after_recovery = fit_dynamic(early + late)
    assert after_bad_spell is not None and after_recovery is not None
    assert after_recovery.attack["Riser"] > after_bad_spell.attack["Riser"]


def test_dynamic_uncertainty_shrinks_with_evidence() -> None:
    """A team the filter has watched for a while should be pinned down."""
    from updater.predictions.models.scoreline.dynamic import INITIAL_VARIANCE, fit_dynamic

    model = fit_dynamic([_match(d * 4, "A", "B", 2, 1) for d in range(30)])
    assert model is not None
    assert model.attack_variance["A"] < INITIAL_VARIANCE


def test_dynamic_uncertainty_grows_over_a_long_gap() -> None:
    """Time away from the pitch must widen a rating, not leave it frozen."""
    from updater.predictions.models.scoreline.dynamic import fit_dynamic

    recent = [_match(d * 4, "A", "B", 2, 1) for d in range(20)]
    # Same matches, then a two-year gap before one more for another pair.
    with_gap = recent + [_match(20 * 4 + 730, "A", "B", 2, 1)]

    without = fit_dynamic(recent)
    after_gap = fit_dynamic(with_gap)
    assert without is not None and after_gap is not None
    # The final update is identical, so any difference comes from the drift.
    assert after_gap.attack_variance["A"] > 0


def test_stacked_weights_are_a_valid_mixture(league) -> None:
    from updater.predictions.models.scoreline.stacked import fit_stacked

    model = fit_stacked(league, member_names=["dixon-coles", "pi-ratings"])
    assert model is not None
    assert all(w >= 0 for w in model.weights)
    assert sum(model.weights) == pytest.approx(1.0)


def test_stacked_prefers_the_better_member() -> None:
    """Given a clearly better member, the solver must weight it above the other."""
    from updater.predictions.models.scoreline.stacked import solve_weights

    actual = np.array([0, 1, 2] * 40)
    sharp = np.zeros((len(actual), 3))
    sharp[np.arange(len(actual)), actual] = 0.8
    sharp += 0.1  # 0.9 on the truth, 0.1 elsewhere
    flat = np.full((len(actual), 3), 1 / 3)

    weights = solve_weights(np.array([flat, sharp]), actual)
    assert weights[1] > weights[0]
    assert weights[1] > 0.9


def test_stacked_rejects_nested_ensembles(league) -> None:
    from updater.predictions.models.scoreline.stacked import fit_stacked

    with pytest.raises(ValueError, match="cannot contain an ensemble"):
        fit_stacked(league, member_names=["dixon-coles", "ensemble"])


def test_stacked_falls_back_to_equal_weights_on_a_short_holdout() -> None:
    """Too little holdout to learn from means don't pretend to have learned."""
    from updater.predictions.models.scoreline.stacked import fit_stacked

    short = _league(repeats=2)
    model = fit_stacked(short, member_names=["dixon-coles", "pi-ratings"])
    assert model is not None
    assert len(set(model.weights)) == 1


def test_rps_helper_matches_the_backtest_implementation() -> None:
    """Two implementations of RPS exist; they must not drift apart."""
    from updater.predictions.backtest import ranked_probability_score
    from updater.predictions.models.scoreline.stacked import _rps

    probabilities = np.array([[0.5, 0.3, 0.2], [0.2, 0.2, 0.6], [0.4, 0.35, 0.25]])
    actual = np.array([1, 2, 0])
    expected = np.mean(
        [
            ranked_probability_score(tuple(p), a)
            for p, a in zip(probabilities, actual)
        ]
    )
    assert _rps(probabilities, actual) == pytest.approx(expected)


def test_goal_average_separates_attack_from_defence() -> None:
    """A team that scores freely and concedes freely must rate high on both."""
    matches = [_match(d * 3, "Leaky", "Solid", 3, 3) for d in range(10)] + [
        _match(d * 3 + 1, "Solid", "Leaky", 1, 0) for d in range(10)
    ]
    model = models.build("goal-average").fit(matches)
    assert model is not None
    assert model.attack_home["Leaky"] > model.attack_home["Solid"]
    assert model.defence_home["Leaky"] > model.defence_home["Solid"]

"""Prediction maths.

The scoreline-frequency helpers are the building blocks the predictor combines
to turn historical results into a predicted score. They carry no test coverage
of their own, so these lock in their current behaviour before any future
simplification of the (untested) prediction flow. The final class builds a real
predictor from the backup data as an end-to-end safety net.
"""

import numpy as np
import pandas as pd
import pytest

from updater.data.dataframes import TeamRatings
from updater.data_source import DataSource
from updater.predictions.form import calc_form
from updater.predictions.form_predictor import FormPredictor
from updater.predictions.scoreline import Scoreline


class TestScorelineFreqProbability:
    def test_counts_become_probabilities_summing_to_one(self):
        a = Scoreline(2, 1)
        b = Scoreline(1, 0)
        probs = FormPredictor._scoreline_freq_probability({a: 2, b: 2})
        assert probs[a] == 0.5
        assert abs(sum(probs.values()) - 1.0) < 1e-9

    def test_empty_freq_is_empty(self):
        assert FormPredictor._scoreline_freq_probability({}) == {}


class TestMergeScorelineFreq:
    def test_counts_are_summed_across_both(self):
        a, b, c = Scoreline(2, 1), Scoreline(1, 0), Scoreline(0, 0)
        merged = FormPredictor._merge_scoreline_freq({a: 1, b: 2}, {a: 3, c: 1})
        assert merged == {a: 4, b: 2, c: 1}


class TestRemoveScorelineFreqTeams:
    def test_same_goals_pool_once_teams_are_dropped(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea")
        b = Scoreline(2, 1, "Tottenham", "Everton")
        pooled = FormPredictor._remove_scoreline_freq_teams({a: 3, b: 2})
        assert len(pooled) == 1
        assert next(iter(pooled.values())) == 5


class TestSeparateByHomeAway:
    def test_keeps_only_matches_where_team_is_home(self):
        home = Scoreline(2, 0, "Arsenal", "Chelsea")
        away = Scoreline(1, 3, "Chelsea", "Arsenal")
        kept = FormPredictor._separate_scoreline_freq_by_home_away(
            "Arsenal", {home: 1, away: 1}, at_home=True
        )
        assert home in kept and away not in kept

    def test_keeps_only_matches_where_team_is_away(self):
        home = Scoreline(2, 0, "Arsenal", "Chelsea")
        away = Scoreline(1, 3, "Chelsea", "Arsenal")
        kept = FormPredictor._separate_scoreline_freq_by_home_away(
            "Arsenal", {home: 1, away: 1}, at_home=False
        )
        assert away in kept and home not in kept


class TestRemoveScorelineFreqHomeAway:
    def test_wrong_way_round_fixture_is_reversed(self):
        # Arsenal recorded as the away team, but we want them as home.
        s = Scoreline(1, 2, "Chelsea", "Arsenal")
        out = FormPredictor._remove_scoreline_freq_home_away(
            {s: 1}, intended_home_team="Arsenal", intended_away_team="Chelsea"
        )
        key = next(iter(out))
        assert key.home_team == "Arsenal"
        assert (key.home_goals, key.away_goals) == (2, 1)


class TestScaledFreqArithmetic:
    def test_insert_adds_scaled_counts_in_place(self):
        a, b = Scoreline(2, 1), Scoreline(1, 0)
        freq = {a: 1.0}
        FormPredictor._insert_scaled_into_freq(freq, {a: 2.0, b: 4.0}, scale=0.5)
        assert freq[a] == 2.0
        assert freq[b] == 2.0

    def test_subtract_only_touches_existing_keys(self):
        a, c = Scoreline(2, 1), Scoreline(0, 0)
        freq = {a: 2.0}
        FormPredictor._subtract_scaled_from_freq(freq, {a: 2.0, c: 1.0}, scale=0.5)
        assert freq[a] == 1.0
        assert c not in freq


class TestScaleResults:
    def test_home_draw_away_scaled_independently(self):
        home_win, draw, away_win = Scoreline(2, 0), Scoreline(1, 1), Scoreline(0, 2)
        freq = {home_win: 1.0, draw: 1.0, away_win: 1.0}
        FormPredictor.scale_results(freq, (2.0, 3.0, 5.0))
        assert freq[home_win] == 2.0
        assert freq[draw] == 3.0
        assert freq[away_win] == 5.0


class TestMaximumLikelihood:
    def test_returns_the_most_probable_scoreline(self):
        a, b, c = Scoreline(2, 1), Scoreline(1, 1), Scoreline(0, 0)
        assert FormPredictor.maximum_likelihood({a: 0.2, b: 0.5, c: 0.3}) is b

    def test_empty_returns_none(self):
        assert FormPredictor.maximum_likelihood({}) is None


class TestCalcForm:
    @staticmethod
    def _ratings(**totals: float) -> TeamRatings:
        df = pd.DataFrame({"total": list(totals.values())}, index=list(totals))
        return TeamRatings(df)

    def test_win_lifts_form_by_opposition_rating_times_goal_difference(self):
        ratings = self._ratings(Arsenal=0.4, Chelsea=0.1)
        form = calc_form(
            "Arsenal",
            [Scoreline(1, 0, "Arsenal", "Chelsea")],
            np.array([1.0]),
            ratings,
        )
        # 0.5 baseline + 0.1 (Chelsea rating) * 1 (goal difference) * 1 (weight)
        assert form == pytest.approx(0.6)

    def test_form_is_capped_at_zero(self):
        ratings = self._ratings(Arsenal=0.4, Chelsea=0.5)
        form = calc_form(
            "Arsenal",
            [Scoreline(0, 5, "Arsenal", "Chelsea")],
            np.array([1.0]),
            ratings,
        )
        assert form == 0

    def test_unrated_opposition_leaves_form_unchanged(self):
        ratings = self._ratings(Arsenal=0.4)
        form = calc_form(
            "Arsenal",
            [Scoreline(1, 0, "Arsenal", "Unknown")],
            np.array([1.0]),
            ratings,
        )
        assert form == 0.5

    def test_empty_weightings_discard_every_match(self):
        """calc_form zips matches against weights, so a short weight vector
        silently drops matches rather than failing.

        scoreline_probabilities used to size the home team's weights from the
        *away* team's match count. An opponent with no history therefore left
        this array empty and pinned the home team's form to the 0.5 baseline,
        throwing away its actual form.
        """
        ratings = self._ratings(Arsenal=0.4, Chelsea=0.1)
        matches = [Scoreline(1, 0, "Arsenal", "Chelsea")]

        assert calc_form("Arsenal", matches, np.linspace(0.2, 1, 0), ratings) == 0.5
        assert calc_form("Arsenal", matches, np.linspace(0.2, 1, 1), ratings) != 0.5

    def test_form_uses_the_teams_own_match_count(self):
        """The home team's form must not depend on how many matches the
        opponent has played."""
        ratings = self._ratings(Arsenal=0.4, Chelsea=0.1, Fulham=0.1)
        matches = [
            Scoreline(1, 0, "Arsenal", "Chelsea"),
            Scoreline(2, 0, "Arsenal", "Fulham"),
        ]
        own = calc_form("Arsenal", matches, np.linspace(0.2, 1, len(matches)), ratings)

        # Same fixtures, weights sized as if the opponent had played fewer.
        truncated = calc_form("Arsenal", matches, np.linspace(0.2, 1, 1), ratings)
        assert own != truncated

    def test_matches_not_involving_the_team_are_skipped(self):
        ratings = self._ratings(Chelsea=0.4, Everton=0.1)
        form = calc_form(
            "Arsenal",
            [Scoreline(1, 0, "Chelsea", "Everton")],
            np.array([1.0]),
            ratings,
        )
        assert form == 0.5


class TestPredictorEndToEnd:
    """Builds a real predictor from the backup data as a regression anchor."""

    @pytest.fixture(scope="class")
    @classmethod
    def predictor(cls):
        data = pytest.data_objects[0]
        season = pytest.current_season
        raw_data = DataSource(season).build_raw_data(num_seasons=4, request_new=False)
        return FormPredictor(
            raw_data,
            data.teams.fixtures,
            data.teams.form,
            data.teams.team_ratings,
            data.teams.home_advantages,
            season,
            num_seasons=4,
        )

    @staticmethod
    def _two_teams():
        return list(pytest.data_objects[0].teams.standings.df.index[:2])

    def test_predict_score_returns_the_requested_fixture(self, predictor):
        home, away = self._two_teams()
        result = predictor.predict_score(home, away)
        assert isinstance(result, Scoreline)
        assert result.home_team == home
        assert result.away_team == away
        assert result.home_goals >= 0 and result.away_goals >= 0

    def test_probabilities_form_a_distribution(self, predictor):
        home, away = self._two_teams()
        probs = predictor.scoreline_probabilities(home, away)
        assert probs, "expected non-empty probabilities for established teams"
        assert abs(sum(probs.values()) - 1.0) < 1e-9

    def test_recent_scorelines_respects_the_limit(self, predictor):
        team = self._two_teams()[0]
        recent = predictor.get_recent_scorelines(team, 5)
        assert len(recent) <= 5
        assert all(isinstance(s, Scoreline) for s in recent)

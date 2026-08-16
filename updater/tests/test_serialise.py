"""Pins the dashboard payload format.

The dashboard reads this JSON in 120+ places, so the shape is a contract. These
tests exist so a change to any DataFrame's internal layout cannot silently
reshape it.
"""

import math

import numpy as np
import pandas as pd
import pytest

from updater.data.serialise import (
    PAST_SEASON_FORM_FIELDS,
    clean_value,
    column_path,
    form_to_dict,
    to_nested_dict,
)
from updater.predictions.scoreline import Scoreline


class TestColumnPath:
    def test_flat_column_becomes_single_key(self):
        assert column_path("total") == ("total",)

    def test_multiindex_levels_become_a_path(self):
        assert column_path((2025, 1, "score")) == ("2025", "1", "score")

    def test_blank_padding_levels_are_dropped(self):
        assert column_path(("totalHomeAdvantage", "", "")) == ("totalHomeAdvantage",)
        assert column_path((2025, "homeAdvantage", "")) == ("2025", "homeAdvantage")

    def test_keys_are_always_strings(self):
        assert all(isinstance(k, str) for k in column_path((2025, 38, "gD")))


class TestCleanValue:
    def test_nan_becomes_none(self):
        assert clean_value(float("nan")) is None
        assert clean_value(np.float64("nan")) is None

    def test_missing_pandas_values_become_none(self):
        assert clean_value(pd.NaT) is None
        assert clean_value(None) is None

    def test_scoreline_is_unpacked(self):
        result = clean_value(Scoreline("Arsenal", "Chelsea", 2, 1))
        assert isinstance(result, dict)

    def test_nested_containers_are_cleaned(self):
        assert clean_value([1.0, float("nan")]) == [1.0, None]
        assert clean_value({"a": float("nan")}) == {"a": None}

    def test_does_not_mutate_its_input(self):
        """These lists are still held by the DataFrame being serialised."""
        source = [1.0, float("nan")]
        result = clean_value(source)
        assert result is not source
        assert math.isnan(source[1]), "input list was mutated"

    def test_booleans_survive(self):
        """bool subclasses int, so it must not be coerced."""
        assert clean_value(True) is True

    def test_plain_values_pass_through(self):
        assert clean_value(3) == 3
        assert clean_value("Arsenal") == "Arsenal"


class TestToNestedDict:
    def test_flat_columns(self):
        df = pd.DataFrame({"total": [0.9]}, index=["Arsenal"])
        assert to_nested_dict(df) == {"Arsenal": {"total": 0.9}}

    def test_two_level_columns_nest(self):
        df = pd.DataFrame(
            {(2025, "position"): [1], (2025, "points"): [80]}, index=["Arsenal"]
        )
        assert to_nested_dict(df) == {"Arsenal": {"2025": {"position": 1, "points": 80}}}

    def test_three_level_columns_nest(self):
        df = pd.DataFrame({(2025, 1, "gD"): [2]}, index=["Arsenal"])
        assert to_nested_dict(df) == {"Arsenal": {"2025": {"1": {"gD": 2}}}}

    def test_blank_levels_collapse_rather_than_nest(self):
        df = pd.DataFrame({("totalHomeAdvantage", "", ""): [0.1]}, index=["Arsenal"])
        assert to_nested_dict(df) == {"Arsenal": {"totalHomeAdvantage": 0.1}}

    def test_nan_cells_become_none(self):
        df = pd.DataFrame({("2025", "score"): [np.nan]}, index=["Arsenal"])
        assert to_nested_dict(df) == {"Arsenal": {"2025": {"score": None}}}


class TestFormTrimming:
    @staticmethod
    def _form_frame():
        columns = pd.MultiIndex.from_tuples(
            [
                (season, matchday, field)
                for season in (2024, 2025)
                for matchday in (1,)
                for field in (
                    "score",
                    "atHome",
                    "date",
                    "team",
                    "cumGD",
                    "form5",
                    "position",
                )
            ]
        )
        return pd.DataFrame(
            [[0] * len(columns)], index=["Arsenal"], columns=columns
        )

    def test_current_season_keeps_every_field(self):
        result = form_to_dict(self._form_frame())
        assert set(result["Arsenal"]["2025"]["1"]) == {
            "score",
            "atHome",
            "date",
            "team",
            "cumGD",
            "form5",
            "position",
        }

    def test_past_seasons_keep_only_the_fields_in_use(self):
        result = form_to_dict(self._form_frame())
        assert set(result["Arsenal"]["2024"]["1"]) == set(PAST_SEASON_FORM_FIELDS)

    def test_past_seasons_are_still_present(self):
        """Trimming fields must not drop the seasons themselves."""
        result = form_to_dict(self._form_frame())
        assert set(result["Arsenal"]) == {"2024", "2025"}


class TestPayloadContract:
    """Shape checks against the real built data."""

    @pytest.fixture(scope="class")
    @classmethod
    def payload(cls):
        return pytest.data_objects[0].teams.to_dict()

    def test_top_level_keys(self, payload):
        assert set(payload) == {
            "lastUpdated",
            "fixtures",
            "standings",
            "teamRatings",
            "homeAdvantages",
            "form",
            "upcoming",
        }

    def test_every_section_is_keyed_by_team_name(self, payload):
        teams = set(payload["standings"])
        assert len(teams) == 20
        for section in ("fixtures", "teamRatings", "homeAdvantages", "form", "upcoming"):
            assert set(payload[section]) == teams, section

    def test_all_keys_are_strings(self, payload):
        def walk(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    assert isinstance(key, str), f"non-string key {key!r}"
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)

        walk(payload)

    def test_form_is_nested_team_season_matchday(self, payload):
        team = next(iter(payload["form"]))
        season = next(iter(payload["form"][team]))
        matchday = next(iter(payload["form"][team][season]))
        assert season.isdigit() and matchday.isdigit()
        assert isinstance(payload["form"][team][season][matchday], dict)

    def test_no_nan_values_survive(self, payload):
        def walk(node):
            if isinstance(node, dict):
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for item in node:
                    walk(item)
            elif isinstance(node, float):
                assert not math.isnan(node), "NaN leaked into the payload"

        walk(payload)

import pytest
from src.fmt import (
    TwoWayDict,
    clean_full_team_name,
    convert_team_name_or_initials,
    extract_int_score,
    extract_int_score_from_scoreline,
    extract_scoreline,
    extract_str_score,
    extract_str_score_from_scoreline,
    format_scoreline_str,
    format_scoreline_str_from_str,
    identical_fixtures,
    identical_result,
)


def test_two_way_dict():
    d = TwoWayDict({"a": "b"})
    assert d["a"] == "b"
    assert d["b"] == "a"
    d["c"] = "d"
    assert d["c"] == "d"
    assert d["d"] == "c"
    del d["a"]
    assert "a" not in d
    assert "b" not in d
    assert len(d) == 1


def test_convert_team_name_or_initials():
    assert convert_team_name_or_initials("Arsenal") == "ARS"
    assert convert_team_name_or_initials("ARS") == "Arsenal"
    assert convert_team_name_or_initials("Manchester City") == "MCI"
    assert convert_team_name_or_initials("MCI") == "Manchester City"


def test_extract_int_score():
    assert extract_int_score("1 - 2") == (1, 2)


def test_extract_str_score():
    assert extract_str_score("1 - 2") == ("1", "2")


def test_extract_int_score_from_scoreline():
    assert extract_int_score_from_scoreline("ARS 1 - 2 MCI") == (1, 2)


def test_extract_str_score_from_scoreline():
    assert extract_str_score_from_scoreline("ARS 1 - 2 MCI") == ("1", "2")


def test_extract_scoreline():
    assert extract_scoreline("ARS 1 - 2 MCI") == ("ARS", 1, 2, "MCI")


def test_identical_fixtures():
    assert identical_fixtures("ARS 1 - 2 MCI", "ARS 2 - 1 MCI")
    assert not identical_fixtures("ARS 1 - 2 MCI", "LIV 2 - 1 MCI")
    assert not identical_fixtures(None, "LIV 2 - 1 MCI")


def test_identical_result():
    assert identical_result(1, 1, 2, 2)  # Draw
    assert identical_result(2, 1, 3, 1)  # Home win
    assert identical_result(1, 2, 1, 3)  # Away win
    assert not identical_result(1, 1, 2, 1)
    assert not identical_result(2, 1, 1, 1)
    assert not identical_result(1, 2, 1, 1)


def test_format_scoreline_str_from_str():
    assert (
        format_scoreline_str_from_str("Arsenal", "Manchester City", "1 - 2", True)
        == "ARS 1 - 2 MCI"
    )
    assert (
        format_scoreline_str_from_str("Arsenal", "Manchester City", "1 - 2", False)
        == "MCI 1 - 2 ARS"
    )


def test_format_scoreline_str():
    assert (
        format_scoreline_str("Arsenal", "Manchester City", 1, 2, True)
        == "ARS 1 - 2 MCI"
    )
    assert (
        format_scoreline_str("Arsenal", "Manchester City", 1, 2, False)
        == "MCI 2 - 1 ARS"
    )


def test_clean_full_team_name():
    assert clean_full_team_name("Arsenal FC") == "Arsenal"
    assert clean_full_team_name("AFC Bournemouth") == "Bournemouth"
    assert clean_full_team_name("Brighton & Hove Albion") == "Brighton and Hove Albion"

import pytest
from src.updater.fmt import (
    TwoWayDict,
    clean_full_team_name,
    convert_team_name_or_initials,
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


def test_clean_full_team_name():
    assert clean_full_team_name("Arsenal FC") == "Arsenal"
    assert clean_full_team_name("AFC Bournemouth") == "Bournemouth"
    assert clean_full_team_name("Brighton & Hove Albion") == "Brighton and Hove Albion"

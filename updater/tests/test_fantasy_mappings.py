import pytest

from updater.data.dataframes.fantasy import Fantasy


@pytest.mark.parametrize(
    ("extractor", "source", "expected"),
    [
        (
            "_extract_team_mappings",
            {"teams": [{"code": 1, "name": "Arsenal"}]},
            {1: "Arsenal"},
        ),
        (
            "_extract_position_mappings",
            {"element_types": [{"id": 3, "singular_name": "Midfielder"}]},
            {3: "Midfielder"},
        ),
    ],
)
def test_fantasy_mappings(extractor, source, expected):
    assert getattr(Fantasy(), extractor)(source) == expected


@pytest.mark.parametrize(
    ("extractor", "message"),
    [
        ("_extract_team_mappings", "Team data not found in fantasy data"),
        ("_extract_position_mappings", "Position data not found in fantasy data"),
    ],
)
def test_missing_fantasy_mapping_source_has_contextual_error(extractor, message):
    with pytest.raises(ValueError, match=message):
        getattr(Fantasy(), extractor)({})

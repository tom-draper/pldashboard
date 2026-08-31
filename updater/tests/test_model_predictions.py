from updater.data.raw_data import RawData
from updater.predictions.model_predictions import next_upcoming_fixtures


def _fixture(matchday: int, status: str, home: str, away: str) -> dict:
    return {
        "matchday": matchday,
        "utcDate": f"2026-08-{14 + matchday:02d}T12:00:00Z",
        "homeTeam": {"name": home},
        "awayTeam": {"name": away},
        "status": status,
    }


def test_next_upcoming_fixtures_ignores_postponed_fixtures():
    raw_data = RawData(
        fixtures={
            2026: [
                _fixture(1, "POSTPONED", "Arsenal FC", "Chelsea FC"),
                _fixture(2, "SCHEDULED", "Liverpool FC", "Everton FC"),
            ]
        }
    )

    fixtures = next_upcoming_fixtures(raw_data, 2026)

    assert [(home, away) for _, home, away in fixtures] == [("Liverpool", "Everton")]


def test_next_upcoming_fixtures_covers_each_teams_next_game():
    raw_data = RawData(
        fixtures={
            2026: [
                _fixture(3, "SCHEDULED", "Aston Villa FC", "Arsenal FC"),
                _fixture(4, "SCHEDULED", "Newcastle United FC", "Bournemouth FC"),
                _fixture(4, "SCHEDULED", "Arsenal FC", "Chelsea FC"),
            ]
        }
    )

    fixtures = next_upcoming_fixtures(raw_data, 2026)

    assert [(home, away) for _, home, away in fixtures] == [
        ("Aston Villa", "Arsenal"),
        ("Arsenal", "Chelsea"),
        ("Newcastle United", "Bournemouth"),
    ]

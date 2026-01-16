from datetime import datetime

import pytest
from src.updater.database import Database


@pytest.fixture
def db_instance(monkeypatch):
    monkeypatch.setenv("SEASON", "2025")
    monkeypatch.setenv("MONGODB_USERNAME", "testuser")
    monkeypatch.setenv("MONGODB_PASSWORD", "testpass")
    monkeypatch.setenv("MONGODB_DATABASE", "testdb")
    db = Database()
    return db


def test_get_actual_score():
    actual_scores = {
        "ARS vs MCI": {"homeGoals": 1, "awayGoals": 2},
    }
    assert Database._get_actual_score("ARS vs MCI", actual_scores) == {
        "homeGoals": 1,
        "awayGoals": 2,
    }
    assert Database._get_actual_score("LIV vs CHE", actual_scores) is None


def test_build_prediction_objs(db_instance):
    predictions = {
        "Arsenal": {
            "date": datetime(2025, 8, 16, 14, 0),
            "homeInitials": "ARS",
            "awayInitials": "MCI",
            "prediction": {"homeGoals": 2.1, "awayGoals": 1.8},
        },
        "Liverpool": {
            "date": datetime(2025, 8, 16, 16, 30),
            "homeInitials": "LIV",
            "awayInitials": "CHE",
            "prediction": {"homeGoals": 1.5, "awayGoals": 1.5},
        },
    }
    actual_scores = {
        "ARS vs MCI": {"homeGoals": 1, "awayGoals": 2},
    }

    prediction_objs = db_instance._build_prediction_objs(predictions, actual_scores)

    assert len(prediction_objs) == 2

    p1 = next(p for p in prediction_objs if p["_id"] == "ARS vs MCI")
    assert p1["datetime"] == datetime(2025, 8, 16, 14, 0)
    assert p1["home"] == "ARS"
    assert p1["away"] == "MCI"
    assert p1["prediction"] == {"homeGoals": 2.1, "awayGoals": 1.8}
    assert p1["actual"] == {"homeGoals": 1, "awayGoals": 2}

    p2 = next(p for p in prediction_objs if p["_id"] == "LIV vs CHE")
    assert p2["actual"] is None

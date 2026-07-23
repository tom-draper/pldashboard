from datetime import datetime
from unittest.mock import MagicMock, PropertyMock, patch

import pymongo
import pytest

from updater.database import Database


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


def test_build_prediction_objs_empty(db_instance):
    assert db_instance._build_prediction_objs({}, {}) == []


def mock_collection(db_instance, collection):
    # form_predictions_collection is a property that reaches through to Mongo; swap it
    # for a mock so the write logic can be exercised without a live database.
    return patch.object(
        Database,
        "form_predictions_collection",
        new_callable=PropertyMock,
        return_value=collection,
    )


def test_save_predictions_empty_skips_write(db_instance):
    collection = MagicMock()
    with mock_collection(db_instance, collection):
        db_instance._save_predictions([])
    collection.bulk_write.assert_not_called()


def test_save_predictions_upserts_each_prediction(db_instance):
    collection = MagicMock()
    predictions = [{"_id": "ARS vs MCI"}, {"_id": "LIV vs CHE"}]
    with mock_collection(db_instance, collection):
        db_instance._save_predictions(predictions)

    collection.bulk_write.assert_called_once()
    ops, kwargs = collection.bulk_write.call_args
    write_ops = ops[0]
    assert len(write_ops) == 2
    assert all(isinstance(op, pymongo.ReplaceOne) for op in write_ops)
    assert kwargs["ordered"] is False


def test_update_actual_scores_updates_matching_pending(db_instance):
    collection = MagicMock()
    # Two predictions still awaiting a result; only one has a score available.
    collection.find.return_value = [{"_id": "ARS vs MCI"}, {"_id": "LIV vs CHE"}]
    actual_scores = {"ARS vs MCI": {"homeGoals": 1, "awayGoals": 2}}

    with mock_collection(db_instance, collection):
        db_instance.update_actual_scores(actual_scores)

    collection.bulk_write.assert_called_once()
    write_ops = collection.bulk_write.call_args[0][0]
    assert write_ops == [
        pymongo.UpdateOne(
            {"_id": "ARS vs MCI"},
            {"$set": {"actual": {"homeGoals": 1, "awayGoals": 2}}},
        )
    ]


def test_update_actual_scores_no_matches_skips_write(db_instance):
    collection = MagicMock()
    collection.find.return_value = [{"_id": "LIV vs CHE"}]
    # No score recorded for the pending prediction, so nothing to write.
    with mock_collection(db_instance, collection):
        db_instance.update_actual_scores({"ARS vs MCI": {"homeGoals": 1, "awayGoals": 2}})
    collection.bulk_write.assert_not_called()

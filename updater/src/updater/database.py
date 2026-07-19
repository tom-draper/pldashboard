from os import getenv
from typing import Optional
from urllib.parse import quote_plus

import pymongo
from updater.env import require_env, require_env_int


class Database:
    def __init__(self):
        self.current_season = require_env_int("SEASON")

        # Credentials must be percent-encoded: an unescaped '@', ':' or '/' in a
        # password otherwise corrupts the connection string.
        username = quote_plus(require_env("MONGODB_USERNAME"))
        password = quote_plus(require_env("MONGODB_PASSWORD"))
        database = require_env("MONGODB_DATABASE")
        self.connection_string = f"mongodb+srv://{username}:{password}@main.pvnry.mongodb.net/{database}?retryWrites=true&w=majority&authSource=admin"

        self._client: Optional[pymongo.MongoClient] = None

    @property
    def client(self):
        """Lazily create and reuse a single MongoClient.

        MongoClient maintains its own connection pool and is designed to be
        long-lived: creating one per operation forces a fresh TLS handshake and
        topology discovery every time.
        """
        if self._client is None:
            self._client = pymongo.MongoClient(self.connection_string)
        return self._client

    def close(self):
        if self._client is not None:
            self._client.close()
            self._client = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    @property
    def predictions_collection(self):
        """The collection holding score predictions.

        Reads and writes previously disagreed (reading Predictions2023 while
        writing Predictions2024), so both now go through here. The name is
        overridable via MONGODB_PREDICTIONS_COLLECTION; the default preserves
        the existing write target.
        """
        name = getenv("MONGODB_PREDICTIONS_COLLECTION", "Predictions2024")
        return self.client.PremierLeague[name]

    def get_predictions(self):
        return list(
            self.predictions_collection.aggregate(
                [
                    {
                        "$group": {
                            "_id": {
                                "$dateToString": {
                                    "format": "%Y-%m-%d",
                                    "date": "$datetime",
                                }
                            },
                            "predictions": {"$push": "$$ROOT"},
                        }
                    }
                ]
            )
        )

    def get_teams_data(self):
        team_data = self.client.PremierLeague.TeamData.find_one(
            {"_id": self.current_season}
        )
        if team_data is None:
            raise ValueError(f"No team data found for season {self.current_season}")
        return dict(team_data)

    def get_fantasy_data(self):
        fantasy_data = self.client.PremierLeague.Fantasy.find_one({"_id": "fantasy"})
        if fantasy_data is None:
            raise ValueError("No fantasy data found")
        return dict(fantasy_data)

    @staticmethod
    def _get_actual_score(
        prediction_id: str, actual_scores: dict[tuple[str, str], dict[str, int]]
    ):
        actual_score: Optional[str] = None
        if prediction_id in actual_scores:
            actual_score = actual_scores[prediction_id]
        return actual_score

    def _build_prediction_objs(
        self,
        predictions: dict[str, dict[str, float]],
        actual_scores: dict[tuple[str, str], dict[str, int]],
    ):
        """Combine predictions and actual_scores and add an _id field to create
        a dictionary matching the MongoDB schema.

        prediction_objs = [
            {
                '_id': str,
                'datetime': datetime,
                'home': str,
                'away': str,
                'prediction': {
                    'homeGoals': float,
                    'awayGoals': float,
                },
                'actual': None or {
                    'homeGoals': float,
                    'awayGoals': float,
                }
            },
            ...
        ]
        """
        prediction_objs = []
        for prediction in predictions.values():
            pid = f"{prediction['homeInitials']} vs {prediction['awayInitials']}"
            actual_score = self._get_actual_score(pid, actual_scores)
            _prediction = {
                "_id": pid,
                "datetime": prediction["date"],
                "home": prediction["homeInitials"],
                "away": prediction["awayInitials"],
                "prediction": prediction["prediction"],
                "actual": actual_score,
            }
            prediction_objs.append(_prediction)

        return prediction_objs

    def _save_predictions(self, predictions: list):
        if not predictions:
            return

        # One round trip instead of one per prediction.
        self.predictions_collection.bulk_write(
            [
                pymongo.ReplaceOne({"_id": p["_id"]}, p, upsert=True)
                for p in predictions
            ],
            ordered=False,
        )

    def update_predictions(
        self,
        predictions: dict[str, dict[str, float]],
        actual_scores: dict[tuple[str, str], dict[str, int]],
    ):
        """
        Update the MongoDB database with predictions in the preds dict, including
        any actual scores that have been recorded.

        predictions: dict holding prediction details for each team's upcoming game.
        predictions = {
            [team]: {
                'date': datetime,
                'homeInitials': str,
                'awayInitials': str,
                'prediction': {
                    'homeGoals': float,
                    'awayGoals' float
                }
            }
        }
        actual_scores: dict holding actual results for each team's last game.
        actual_scores = {
            [match_id]: {
                'homeGoals': int
                'awayGoals': int,
            }
        }
        """

        preds = self._build_prediction_objs(predictions, actual_scores)
        self._save_predictions(preds)

    def update_actual_scores(
        self, actual_scores: dict[tuple[str, str], dict[str, int]]
    ):
        collection = self.predictions_collection

        # Get the id of all prediction objects that have no value for actual score
        pending = collection.find({"actual": None}, {"_id": 1})

        updates = []
        for d in pending:
            # Check if dict contains this missing actual score
            actual = self._get_actual_score(d["_id"], actual_scores)
            if actual is not None:
                updates.append(
                    pymongo.UpdateOne({"_id": d["_id"]}, {"$set": {"actual": actual}})
                )

        if updates:
            collection.bulk_write(updates, ordered=False)

    def update_team_data(self, team_data: dict, season: int):
        # upsert so the first run of a new season creates the document rather
        # than silently matching nothing.
        self.client.PremierLeague.TeamData.replace_one(
            {"_id": season}, team_data, upsert=True
        )

    def update_fantasy_data(self, fantasy_data: dict):
        self.client.PremierLeague.Fantasy.replace_one(
            {"_id": "fantasy"}, fantasy_data, upsert=True
        )

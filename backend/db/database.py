from os import getenv
from os.path import dirname, join
from typing import Optional

import pymongo
from dotenv import load_dotenv


class Database:
    def __init__(self, current_season):
        self.current_season = current_season

        __file__ = 'database.py'
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        USERNAME = getenv('MONGODB_USERNAME')
        PASSWORD = getenv('MONGODB_PASSWORD')
        MONGODB_DATABASE = getenv('MONGODB_DATABASE')
        self.connection_string = f"mongodb+srv://{USERNAME}:{PASSWORD}@main.pvnry.mongodb.net/{MONGODB_DATABASE}?retryWrites=true&w=majority&authSource=admin"

    async def get_predictions(self) -> list[dict]:
        predictions = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Predictions2022
            predictions = list(collection.aggregate(
                [{
                    "$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$datetime"}},
                               "predictions": {"$push": "$$ROOT"}}
                }]
            ))

        return predictions

    async def get_teams_data(self) -> dict:
        team_data = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData
            team_data = dict(collection.find_one({'_id': self.current_season}))

        return team_data

    @staticmethod
    def _get_actual_score(
        prediction_id: str,
        actual_scores: dict[tuple[str, str], dict[str, int]]
    ) -> Optional[str]:
        actual_score = None
        if prediction_id in actual_scores:
            actual_score = actual_scores[prediction_id]
        return actual_score

    def _build_prediction_objs(self, predictions: dict[str, dict[str, float]],
                               actual_scores: dict[tuple[str, str], dict[str, int]]):
        """ Combine predictions and actual_scores and add an _id field to create 
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
        for pred in predictions.values():
            pred_id = f'{pred["homeInitials"]} vs {pred["awayInitials"]}'
            actual_score = self._get_actual_score(pred_id, actual_scores)
            prediction = {
                '_id': pred_id,
                'datetime': pred['date'],
                'home': pred['homeInitials'],
                'away': pred['awayInitials'],
                'prediction': pred['prediction'],
                'actual': actual_score,
            }
            prediction_objs.append(prediction)

        return prediction_objs

    def _save_predictions(self, predictions: list):
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Predictions2022

            for prediction in predictions:
                collection.replace_one(
                    {'_id': prediction['_id']}, prediction, upsert=True)

    def update_predictions(self, predictions: dict[str, dict[str, float]],
                           actual_scores: dict[tuple[str, str], dict[str, int]]):
        """
        Update the MongoDB database with predictions in the preds dict, including
        any actual scores that have been recorded.

        predictions: dict holding prediction details for each team's upcoming game.
        predictions = {
            team_name: {
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
            match_id: {
                'homeGoals': int
                'awayGoals': int,
            }
        }
        """

        preds = self._build_prediction_objs(predictions, actual_scores)
        self._save_predictions(preds)

    def update_actual_scores(self, actual_scores: dict[tuple[str, str], dict[str, int]]):
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Predictions2022

            # Get the id of all prediction objects that have no value for actual score
            no_actual_scores = collection.find(
                {'actual': None}, {'_id': 1})

            for d in no_actual_scores:
                # Check if dict contains this missing actual score
                actual = self._get_actual_score(d['_id'], actual_scores)
                if actual is not None:
                    collection.update_one({'_id': d['_id']}, {
                        '$set': {'actual': actual}})

    def update_team_data(self, team_data: dict):
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData
            collection.replace_one({'_id': 2022}, team_data)

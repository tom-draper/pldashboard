from os import getenv
from os.path import dirname, join
from typing import Optional

import pymongo
from dotenv import load_dotenv

from lib.utils.utilities import Utilities

util = Utilities()


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

    def get_predictions(self) -> list[dict]:
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

    def get_prediction_accuracy(self) -> dict:
        accuracy = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Accuracy
            accuracy = collection.find_one({'_id': self.current_season})
            
        return accuracy

    def get_teams_data(self) -> dict:
        team_data = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData
            team_data = dict(collection.find_one({'_id': self.current_season}))
        
        return team_data
    
    def get_prev_season_form(self) -> dict:
        prev_form = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData
            prev_form = dict(collection.find_one({'_id': self.current_season-1}, {'form': 1}))
        
        return prev_form

    @staticmethod
    def _get_actual_score(
        home_initials: str,
        away_initials: str,
        actual_scores: dict[tuple[str, str], dict[str, int]]
    ) -> Optional[str]:
        actual_score = None
        if (home_initials, away_initials) in actual_scores:
            actual_score = actual_scores[(home_initials, away_initials)]
        return actual_score
    
    @staticmethod
    def _get_actual_score_new(
        prediction_id: str,
        actual_scores: dict[tuple[str, str], dict[str, int]]
    ) -> Optional[str]:
        actual_score = None
        if prediction_id in actual_scores:
            actual_score = actual_scores[prediction_id]
        return actual_score

    def _build_predictions(self, preds: dict, actual_scores: dict[tuple[str, str], dict[str, int]]):
        predictions = []
        for _, p in preds.items():
            actual_score = self._get_actual_score(p['homeInitials'], p['awayInitials'], actual_scores)
            prediction = {
                '_id': f"{p['homeInitials']} vs {p['awayInitials']}",
                'datetime': p['date'],
                'home': p['homeInitials'],
                'away': p['awayInitials'],
                'prediction': p['prediction'],
                'actual': actual_score,
            }
            predictions.append(prediction)
        
        return predictions

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
            actual_score = self._get_actual_score_new(pred_id, actual_scores)
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
            
    def update_predictions(self, preds: dict, actual_scores: dict[tuple[str, str], dict[str, int]]):
        """
        Update the MongoDB database with predictions in the preds dict, including
        any actual scores that have been recorded.

        preds: prediction dictionary for each team (added to Upcoming DataFrame)
        dict[team_name] = {'date': datetime,
                           'homeInitials': str,
                           'awayInitials': str,
                           'prediction': {
                                'homeGoals': float,
                                'awayGoals' float
                                }
                           }
        """

        predictions = self._build_predictions(preds, actual_scores)
        self._save_predictions(predictions)

    def update_predictions_new(self, predictions: dict[str, dict[str, float]], 
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

    def update_with_json_data(self):
        predictions = self._read_json_predictions()
        self._save_predictions(predictions)

    def update_actual_scores(self, actual_scores: dict[tuple[str, str], dict[str, int]]):
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Predictions2022

            # Get the id of all prediction objects that have no value for actual score
            no_actual_scores = collection.find(
                {'actual': None}, {'_id': 1})

            for d in no_actual_scores:
                # Check if dict contains this missing actual score 
                actual = self._get_actual_score_new(d['_id'], actual_scores)
                if actual is not None:
                    collection.update_one({'_id': d['_id']}, {
                                        '$set': {'actual': actual}})

    def update_all_actual_scores(self, actual_scores: dict[tuple[str, str], dict[str, int]]):
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Predictions2022

            for initials, actual in actual_scores.items():
                prediction_id = f'{initials[0]} vs {initials[1]}'
                collection.update_one({'_id': prediction_id}, {
                                    '$set': {'actual': actual}})
    
    def _insert_prev_season_form(self, team_data: dict):
        prev_form = self.get_prev_season_form()
        team_data['form']['2021'] = prev_form['form']

    def update_team_data(self, team_data: dict):
        # TEMP SOLUTION - add form from previous seasion
        # TODO: Build form dataframe from json_data instead of fixtures
        # Currently the form dataframe is built using the fixtures dataframe, 
        # and only one fixtures dataframe is created for the current season. 
        # Building form datafr4ame straight from raw api data in json_data variable 
        # will allow the form dataframe to be build for any of the last 4 seasons.
        team_data['form'] = {'2022': team_data['form']}
        self._insert_prev_season_form(team_data)
        
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData
            collection.replace_one({'_id': 2022}, team_data)
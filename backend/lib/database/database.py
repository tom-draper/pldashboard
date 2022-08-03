import json
from datetime import datetime
from os import getenv
from os.path import dirname, join
from typing import Optional

import pymongo
from dotenv import load_dotenv

from lib.utils.utilities import Utilities

util = Utilities()


class Database:
    def __init__(self):
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
            collection = client.PremierLeague.Accuracy2022
            accuracy = collection.find_one()
            
        return accuracy

    def get_teams_data(self) -> dict:
        team_data = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData2022
            team_data = dict(collection.find_one({'_id': 'team_data'}))
        
        return team_data
    
    def get_prev_season_form(self) -> dict:
        prev_form = None
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData
            prev_form = dict(collection.find_one({'_id': 'team_data'}, {'form': 1}))
        
        return prev_form

    @staticmethod
    def _accuracy_counts(played: list[dict]) -> tuple[int, int, float, float]:
        score_correct = 0
        result_correct = 0
        home_goals_diff = 0
        away_goals_diff = 0
        for p in played:
            ph = round(p['prediction']['homeGoals'])
            pa = round(p['prediction']['awayGoals'])
            ah = p['actual']['homeGoals']
            aa = p['actual']['awayGoals']
            if ph == ah and pa == aa:
                score_correct += 1
            if util.identical_result(ph, pa, ah, aa):
                result_correct += 1
            home_goals_diff += (ph - ah)
            away_goals_diff += (pa - aa)

        return score_correct, result_correct, home_goals_diff, away_goals_diff

    @staticmethod
    def _avg_accuracy(
        n_played: float,
        correct: float,
        result_correct: float,
        home_goals_diff: float,
        away_goals_diff: float,
    ) -> tuple[float, float, float, float]:
        score_accuracy = 0
        results_accuracy = 0
        home_goals_avg_diff = 0
        away_goals_avg_diff = 0
        if n_played > 0:
            score_accuracy = correct / n_played
            results_accuracy = result_correct / n_played
            home_goals_avg_diff = home_goals_diff / n_played
            away_goals_avg_diff = away_goals_diff / n_played
            
        return score_accuracy, results_accuracy, home_goals_avg_diff, away_goals_avg_diff

    def _calc_accuracy(self, client: pymongo.MongoClient) -> dict[str, float]:
        collection = client.PremierLeague.Predictions2022
        played = collection.find({'actual': {'$ne': None}}, {
                                 '_id': 0, 'prediction': 1, 'actual': 1})

        score_correct, result_correct, home_goals_diff, away_goals_diff = self._accuracy_counts(
            played)

        score_accuracy, results_accuracy, home_goals_avg_diff, away_goals_avg_diff = self._avg_accuracy(
            played.retrieved, score_correct, result_correct, home_goals_diff, away_goals_diff)

        accuracy = {'scoreAccuracy': score_accuracy,
                    'resultAccuracy': results_accuracy,
                    'homeGoalsAvgDiff': home_goals_avg_diff,
                    'awayGoalsAvgDiff': away_goals_avg_diff}
        
        return accuracy

    def _save_accuracy(self, client: pymongo.MongoClient, accuracy: float):
        collection = client.PremierLeague.Accuracy2022
        collection.replace_one({'_id': 'accuracy'}, accuracy)

    def update_accuracy(self):
        with pymongo.MongoClient(self.connection_string) as client:
            accuracy = self._calc_accuracy(client)
            self._save_accuracy(client, accuracy)
        
        return accuracy

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

    def _build_predictions(self, preds: dict, actual_scores: dict[tuple[str, str], dict[str, int]]):
        predictions = []
        for _, p in preds.items():
            actual_score = self._get_actual_score(
                p['homeInitials'], p['awayInitials'], actual_scores)
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

    def _save_predictions(self, predictions: list):
        print('💾 Saving predictions to database...')
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

    def _read_json_predictions(self, season=2021):
        with open(f'data/predictions_{season}.json', 'r') as f:
            data = json.loads(f.read())

        predictions = []
        for date, preds in data['predictions'].items():
            for p in preds:
                dt = datetime.strptime(
                    date + ' ' + p['time'], "%Y-%m-%d %H:%M")

                detailed_prediction = p['details']['score'] if p['details'] else None

                prediction = {
                    '_id': f"{p['homeInitials']} vs {p['awayInitials']}",
                    'datetime': dt,
                    'home': p['homeInitials'],
                    'away': p['awayInitials'],
                    'prediction': p['prediction'],
                    'actual': p['actual'],
                    'detailedPrediction': detailed_prediction
                }
                predictions.append(prediction)
                
        return predictions

    def update_with_json_data(self):
        predictions = self._read_json_predictions()
        self._save_predictions(predictions)

    def update_actual_scores(self, actual_scores: dict[tuple[str, str], dict[str, int]]):
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.Predictions2022

            no_actual_scores = collection.find(
                {'actual': None}, {'_id': 1, 'home': 1, 'away': 1})

            for d in no_actual_scores:
                actual = self._get_actual_score(
                    d['home'], d['away'], actual_scores)
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
        # TEMPORARY SOLUTION - fetch form prev season form data from database and
        # insert into new data
        # TODO: Build form dataframe from json_data instead of fixtures
        # Then include last two seasons within form dataframe instead of only current season
        team_data['form'] = {'2022': team_data['form']}
        
        # Insert form from previous season
        prev_form = self.get_prev_season_form()
        team_data['form']['2021'] = prev_form['form']

    def update_team_data(self, team_data: dict):
        self._insert_prev_season_form(team_data)
        
        with pymongo.MongoClient(self.connection_string) as client:
            collection = client.PremierLeague.TeamData2022
            collection.replace_one({'_id': 'team_data'}, team_data)
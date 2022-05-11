import json
from datetime import datetime
from os import getenv
from os.path import dirname, join
from typing import Optional

import pymongo
from dotenv import load_dotenv

from utilities import Utilities

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
        client = pymongo.MongoClient(self.connection_string)
        collection = client.PremierLeague.Predictions
        predictions = list(collection.find().sort('datetime', pymongo.DESCENDING))
        client.close()
        return predictions
    
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
    
    def _calc_accuracy(self, database) -> dict[str, float]:
        collection = database.Predictions
        played = collection.find({'actual': { '$ne': None }}, {'_id': 0, 'prediction': 1, 'actual': 1})
        
        score_correct, result_correct, home_goals_diff, away_goals_diff = self._accuracy_counts(played)
        
        score_accuracy, results_accuracy, home_goals_avg_diff, away_goals_avg_diff = self._avg_accuracy(played.retrieved, score_correct, result_correct, home_goals_diff, away_goals_diff)
        
        accuracy = {'scoreAccuracy': score_accuracy, 
                    'resultAccuracy': results_accuracy, 
                    'homeGoalsAvgDiff': home_goals_avg_diff, 
                    'awayGoalsAvgDiff': away_goals_avg_diff}
        return accuracy
    
    def _save_accuracy(self, database, accuracy: float):
        collection = database.Accuracy
        collection.replace_one({'_id': 'accuracy'}, accuracy)
        
    def update_accuracy(self):
        client = pymongo.MongoClient(self.connection_string)
        database = client.PremierLeague
        
        accuracy = self._calc_accuracy(database)
        
        self._save_accuracy(database, accuracy)
        
        client.close()
        
        return accuracy
            
    @staticmethod
    def _get_actual_score(
            home_initials: str, 
            away_initials: str, 
            actual_scores: dict[tuple[str, str], dict[str, int]]
        ) -> Optional[str]:
        if (home_initials, away_initials) in actual_scores:
            return actual_scores[(home_initials, away_initials)]
        return None
    
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
    
    @staticmethod
    def _save_predictions(database, predictions: list):
        print('💾 Saving predictions to database...')
        collection = database.Predictions
        for prediction in predictions:
            collection.replace_one({'_id': prediction['_id']}, prediction, upsert=True)
    
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
        
        client = pymongo.MongoClient(self.connection_string)
        database = client.PremierLeague
        
        self._save_predictions(database, predictions)

        client.close()
    
    def update_with_json_data(self):
        with open('data/predictions_2021.json', 'r') as f:
            data = json.loads(f.read())
            
        predictions = []
        for date, preds in data['predictions'].items():
            for p in preds:
                time = p['time']
                dt = datetime.strptime(date + ' ' + time, "%Y-%m-%d %H:%M")
                
                detailed_prediction = None
                if p['details']:
                    detailed_prediction = p['details']['score']
                
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
            
            
        client = pymongo.MongoClient(self.connection_string)
        database = client.PremierLeague
        
        self._save_predictions(database, predictions)
        
        client.close()
        
    def update_actual_scores(self, actual_scores: dict[tuple[str, str], dict[str, int]]):        
        client = pymongo.MongoClient(self.connection_string)
        collection = client.PremierLeague.Predictions
        
        no_actual_scores = collection.find({'actual': None}, {'_id': 1, 'home': 1, 'away': 1})
        
        for d in no_actual_scores:
            actual = self._get_actual_score(d['home'], d['away'], actual_scores)
            if actual is not None:
                collection.update_one({'_id': d['_id']}, {'$set': {'actual': actual}})
                    
        client.close()
    
    def update_all_actual_scores(self, actual_scores: dict[tuple[str, str], dict[str, int]]):
        client = pymongo.MongoClient(self.connection_string)
        collection = client.PremierLeague.Predictions
        
        for initials, actual in actual_scores.items():
            prediction_id = f'{initials[0]} vs {initials[1]}'
            collection.update_one({'_id': prediction_id}, {'$set': {'actual': actual}})
        
        client.close()

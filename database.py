import json
from datetime import datetime
from os import getenv
from os.path import dirname, join

import pymongo
from dotenv import load_dotenv
from pymongo import collection

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
    
    
    def get_predictions(self):
        client = pymongo.MongoClient(self.connection_string)
        collection = client.PremierLeague.Predictions
        predictions = list(collection.find().sort('datetime', pymongo.DESCENDING))
        client.close()
        return predictions
    
    def _accuracy_counts(self, played):
        score_correct = 0
        result_correct = 0
        home_goals_diff = 0
        away_goals_diff = 0
        for p in played:
            ph = p['prediction']['homeGoals']
            pa = p['prediction']['awayGoals']
            ah = p['actual']['homeGoals']
            aa = p['actual']['awayGoals']
            if ph == ah and pa == aa:
                score_correct += 1
            if util.identical_result(ph, pa, ah, aa):
                result_correct += 1
            home_goals_diff += (ph - ah)
            away_goals_diff += (pa - aa)

        return score_correct, result_correct, home_goals_diff, away_goals_diff
    
    def _avg_accuracy(self, n_played, correct, result_correct, home_goals_diff, away_goals_diff):
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
    
    def _calc_accuracy(self, database):
        collection = database.Predictions
        played = collection.find({'actual': { '$ne': None }}, {'_id': 0, 'prediction': 1, 'actual': 1})
        
        score_correct, result_correct, home_goals_diff, away_goals_diff = self._accuracy_counts(played)
        
        score_accuracy, results_accuracy, home_goals_avg_diff, away_goals_avg_diff = self._avg_accuracy(played.retrieved, score_correct, result_correct, home_goals_diff, away_goals_diff)
        
        accuracy = {'scoreAccuracy': score_accuracy, 
                    'resultAccuracy': results_accuracy, 
                    'homeGoalsAvgDiff': home_goals_avg_diff, 
                    'awayGoalsAvgDiff': away_goals_avg_diff}
        return accuracy
    
    def _save_accuracy(self, database, accuracy):
        collection = database.Accuracy
        collection.replace_one({'_id': 'accuracy'}, accuracy)
        
    def update_accuracy(self):
        client = pymongo.MongoClient(self.connection_string)
        database = client.PremierLeague
        
        accuracy = self._calc_accuracy(database)
        
        self._save_accuracy(database, accuracy)
        
        client.close()
        
        return accuracy
    
    def _get_actual_score(self, home_initials, away_initials, actual_scores):
        for score in actual_scores:
            if score[1] == home_initials and score[2] == away_initials:
                return {'homeGoals': score[3], 'awayGoals': score[4]}
        return None
    
    def _build_predictions(self, preds, actual_scores):
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
                'detailedPrediction': p['detailedPrediction']
            }
            predictions.append(prediction) 
        return predictions
    
    def _save_predictions(self, database, predictions):
        print('💾 Saving predictions to database...')
        collection = database.Predictions
        for prediction in predictions:
            collection.replace_one({'_id': prediction['_id']}, prediction, upsert=True)
    
    def update_predictions(self, preds, actual_scores):
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
        
    def update_actual_scores(self, actual_scores: tuple[datetime, str, str, int, int]):        
        client = pymongo.MongoClient(self.connection_string)
        collection = client.PremierLeague.Predictions
        
        no_actual_scores = collection.find({'actual': None}, {'_id': 1, 'home': 1, 'away': 1})
        
        for nas in no_actual_scores:
            actual_score = self._get_actual_score(nas['home'], nas['away'], actual_scores)
            if actual_scores is not None:
                collection.update_one({'_id': nas['_id']}, {'$set': {'actual': actual_score}})
                    
        client.close()
    
    def update_all_actual_scores(self, actual_scores: tuple[datetime, str, str, int, int]):        
        client = pymongo.MongoClient(self.connection_string)
        collection = client.PremierLeague.Predictions
        
        for actual_score in actual_scores:
            _, home_initial, away_initial, home_goals, away_goals = actual_score
            
            pred_id = f'{home_initial} vs {away_initial}'
            actual = {'homeGoals': home_goals, 'awayGoals': away_goals}
            
            collection.update_one({'_id': pred_id}, {'$set': {'actual': actual}})
        
        client.close()
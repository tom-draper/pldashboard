from pymongo import MongoClient
from os.path import dirname, join
from os import getenv

from dotenv import load_dotenv


class Database:
    def __init__(self):
        __file__ = 'database.py'
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        USERNAME = getenv('MONGODB_USERNAME')
        PASSWORD = getenv('MONGODB_PASSWORD')
        MONGODB_DATABASE = getenv('MONGODB_DATABASE')
        self.connection_string = f"mongodb+srv://{USERNAME}:{PASSWORD}@main.pvnry.mongodb.net/{MONGODB_DATABASE}?retryWrites=true&w=majority&authSource=admin"
        
    def update_accuracy(self, database):
        database.Accuracy
    
    def get_actual_score(self, home_initials, away_initials, actual_scores):
        for score in actual_scores:
            if score[1] == home_initials and score[2] == away_initials:
                return {'homeGoals': score[3], 'awayGoals': score[4]}
        return None
    
    def get_predictions(self, preds, actual_scores):
        predictions = []
        for _, p in preds.items():
            actual_score = self.get_actual_score(p['HomeInitials'], p['AwayInitials'],actual_scores)
            prediction = {
                '_id': f"{p['HomeInitials']} vs {p['AwayInitials']}",
                'datetime': p['Date'],
                'home': p['HomeInitials'],
                'away': p['AwayInitials'],
                'prediction': p['Prediction'],
                'actual': actual_score,
                'detailedPrediction': p['Details']['score']
            }
            predictions.append(prediction) 
        return predictions
    
    def save_predictions(self, database, predictions):
        print('Saving predictions to database...')
        collection = database.Predictions
        for prediction in predictions:
            collection.replace_one({'_id': prediction['_id']}, prediction, upsert=True)
    
    def update_database(self, preds, actual_scores):
        predictions = self.get_predictions(preds, actual_scores)
        
        client = MongoClient(self.connection_string)
        database = client.PremierLeague
        
        self.save_predictions(database, predictions)

        client.close()
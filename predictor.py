from typing import List, Tuple
import json
import re
import numpy as np
from datetime import datetime

from pandas.core.base import DataError
from pandas.core.frame import DataFrame
from utilities import Utilities

utilities = Utilities()

class Predictor:
    def __init__(self, current_season):
        self.current_season = current_season
        self.predictions = {}
        self.accuracy = None
        self.prediction_file = f'data/predictions.json'
    
    def set_accuracy(self) -> Tuple[float, float]:
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions_{self.current_season}']
            
            total = 0
            correct = 0
            result_correct = 0
            for prediction in predictions:
                if prediction['prediction'] != None and prediction['actual'] != None:
                    total += 1
                    if prediction['prediction'] == prediction['actual']:
                        correct += 1
                    
                    # Get the goals scored for predictions and actual
                    _, home_score_p, _, away_score_p, _ = re.split(' +', prediction['prediction'])
                    _, home_score_a,  _, away_score_a, _ = re.split(' +', prediction['actual'])
                    home_score_p, away_score_p, home_score_a, away_score_a = map(int, [home_score_p, away_score_p, home_score_a, away_score_a])
                    # Prediction and actual BOTH a draw or home win or away win
                    if (home_score_p == away_score_p and home_score_a == away_score_a) or \
                       (home_score_p > away_score_p and home_score_a > away_score_a) or \
                       (home_score_p < away_score_p and home_score_a < away_score_a):
                        result_correct += 1
        
        if total == 0:
            return 0
        
        self.accuracy = correct / total
        self.result_accuracy  = result_correct / total
        
        return self.accuracy, self.result_accuracy

    
    def update_prediction(self, actual_scores: list) -> int:
        count = 0
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions_{self.current_season}']
            
            for date, score in actual_scores:
                for prediction in predictions:
                    if prediction['prediction'] != None:
                        # If the actual scoreline matches this prediction, this is the prediction to update
                        home_p, _, _, _, away_p = re.split(' +', prediction['prediction'])
                        home_s, _, _, _, away_s = re.split(' +', score)
                        if (prediction['date'] == date) and (home_p == home_s) and (away_p == away_s) and (prediction['actual'] == None):
                            # Update this prediction with its actual score
                            print(prediction)
                            prediction['actual'] = score
                            count += 1
                            break
            
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
        
        return count
                    
    def record_actual_results(self, fixtures: DataFrame) -> int:
        actual_scores = []
        
        for matchday_no in range(1, 39):
            matchday = fixtures.df[f'Matchday {matchday_no}']
            
            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):                
                for team_name, row in fixtures.df[f'Matchday {matchday_no}'].iterrows():
                    if row['Status'] == 'FINISHED':
                        date = np.datetime_as_string(row['Date'].asm8, unit='D')
                        if row['HomeAway'] == 'Home':
                            actual_score = f'{utilities.convert_team_name_or_initials(team_name)}  {row["Score"]}  {utilities.convert_team_name_or_initials(row["Team"])}'
                        else:
                            actual_score = f'{utilities.convert_team_name_or_initials(row["Team"])}  {row["Score"]}  {utilities.convert_team_name_or_initials(team_name)}'
                        actual_scores.append((date, actual_score))
        
        # Update prediction json objects by inserting their actual scores
        count = self.update_prediction(actual_scores)
        return count
    
    def prediction_already_made(self, new_prediction: object, predictions: List[object]) -> bool:
        for prediction in predictions:
            if prediction['date'] == new_prediction['date'] and prediction['prediction'] == new_prediction['prediction']:
                return True
        return False
        
    def save_prediction(self, new_predictions: List[object]) -> int:
        count = 0
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions_{self.current_season}']
            
            for new_prediction in new_predictions:
                if not self.prediction_already_made(new_prediction, predictions):
                    predictions.append(new_prediction)
                    count += 1
        
        predictions.sort(key=lambda prediction: datetime.strptime(prediction['date'], "%Y-%M-%d"))
        
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
        
        return count
    
    def calc_score_prediction(self, team_name: str, current_form: float, team_playing_next_form_rating: float, team_playing_prev_meetings: List[object]) -> Tuple[int, int]:
        # Get total goals scored and conceded in all previous games with this
        # particular opposition team
        goals_scored = 0
        goals_conceded = 0
        for prev_match in team_playing_prev_meetings:
            if team_name == prev_match[1]:
                # Played at home
                goals_scored += prev_match[3]
                goals_conceded += prev_match[4]
            elif team_name == prev_match[2]:
                # Played away
                goals_scored += prev_match[4]
                goals_conceded += prev_match[3]
                
        # Average scored and conceded            
        predicted_scored = goals_scored / len(team_playing_prev_meetings)
        predicted_conceded = goals_conceded / len(team_playing_prev_meetings)
        
        # Boost the score of the team better in form based on the absolute 
        # difference in form
        form_diff = current_form - team_playing_next_form_rating
        if form_diff > 0:
            # This team in better form
            predicted_scored += predicted_scored * (form_diff/100)
        else:
            # Other team in better form
            predicted_conceded += predicted_conceded * (abs(form_diff)/100)
        
        predicted_scored = int(predicted_scored)
        predicted_conceded = int(predicted_conceded)
        
        return predicted_scored, predicted_conceded
    
    def set_score_predictions(self, form, next_games) -> dict:
        predictions = {}  # Stores team names and the corresponding prediction for their next game
        predictions_list = []  # Stores prediction objects for storing in a json file
        
        team_names = form.df.index.values.tolist()
        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            if next_games == None:
                # If season finished
                predictions[team_name] = None
            else:
                current_form = form.get_current_form_rating(team_name)
                date = next_games.df['Date'].astype(str).loc[team_name]
                team_playing_next_name = next_games.df['Next Game'].loc[team_name]
                team_playing_next_form_rating = form.get_current_form_rating(team_playing_next_name)
                team_playing_next_home_away = next_games.df['HomeAway'].loc[team_name]
                team_playing_prev_meetings = next_games.df.loc[team_name]['Previous Meetings']
                                
                if len(team_playing_prev_meetings) > 0:
                    predicted_scored, predicted_conceded = self.calc_score_prediction(team_name, current_form, team_playing_next_form_rating, team_playing_prev_meetings)
                else:
                    predicted_scored = 0
                    predicted_conceded = 0
                
                # Construct prediction string to display
                if team_playing_next_home_away == "Home":
                    prediction = f'{utilities.convert_team_name_or_initials(team_name)}  {predicted_scored} - {predicted_conceded}  {utilities.convert_team_name_or_initials(team_playing_next_name)}'
                else:
                    prediction = f'{utilities.convert_team_name_or_initials(team_playing_next_name)}  {predicted_conceded} - {predicted_scored}  {utilities.convert_team_name_or_initials(team_name)}'
                
                predictions_list.append({
                    "date": date,
                    "prediction": prediction,
                    "actual": None
                })
                predictions[team_name] = prediction
                
        count = self.save_prediction(predictions_list)
        self.predictions = predictions
        
        return count
import json
import re
import pandas as pd
import numpy as np
from datetime import datetime
from utilities import Utilities

utilities = Utilities()

class Predictor:
    def __init__(self):
        self.prediction_file = 'data/predictions.json'
    
    def save_prediction(self, date, prediction):
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data['predictions']
            
            new_prediction = {
                "date": date,
                "prediction": prediction,
                "actual": None
            }
            
            if new_prediction not in predictions:
                predictions.append(new_prediction)
        
        predictions.sort(key=lambda prediction: datetime.strptime(prediction['date'], "%Y-%M-%d"))
        
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
    
    def update_prediction(self, date, score):
         with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data['predictions']
            
            for prediction in predictions:
                if prediction['prediction'] != None:
                    home_p, _, _, _, away_p = re.split(' +', prediction['prediction'])
                    home_s, _, _, _, away_s = re.split(' +', score)
                    
                    if prediction['date'] == date and home_p == home_s and away_p == away_s and prediction['actual'] == None:
                        prediction['actual'] = score
            
            with open(self.prediction_file, 'w') as f:
                json.dump(data, f)
            
    def record_actual_results(self, fixtures):
        for matchday_no in range(1, 39):
            matchday = fixtures.df[f'Matchday {matchday_no}']
            
            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):                
                for team_name, row in fixtures.df[f'Matchday {matchday_no}'].iterrows():
                    if row['Status'] == 'FINISHED':
                        date = np.datetime_as_string(row['Date'].asm8, unit='D')
                        if row['HomeAway'] == 'Home':
                            actual_score = f'{utilities.convert_team_name_or_initials(team_name)}  {row["Score"]}  {utilities.convert_team_name_or_initials(row["Team"])}'
                            self.update_prediction(date, actual_score)
                        else:
                            actual_score = f'{utilities.convert_team_name_or_initials(row["Team"])}  {row["Score"]}  {utilities.convert_team_name_or_initials(team_name)}'
                            self.update_prediction(date, actual_score)
    
    def calc_score_predictions(self, form, next_games) -> dict:
        score_predictions = {}
        
        team_names = form.df.index.values.tolist()
        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            if next_games == None:
                # If season finished
                score_predictions[team_name] = None
            else:
                current_form = form.get_current_form_rating(team_name)
                date = next_games.df['Date'].astype(str).loc[team_name]
                team_playing_next_name = next_games.df['Next Game'].loc[team_name]
                team_playing_next_form_rating = form.get_current_form_rating(team_playing_next_name)
                team_playing_next_home_away = next_games.df['HomeAway'].loc[team_name]
                team_playing_prev_meetings = next_games.df.loc[team_name]['Previous Meetings']
                                
                if len(team_playing_prev_meetings) > 0:
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
                else:
                    predicted_scored = 0
                    predicted_conceded = 0
                
                # Construct prediction string to display
                if team_playing_next_home_away == "Home":
                    prediction = f'{utilities.convert_team_name_or_initials(team_name)}  {predicted_scored} - {predicted_conceded}  {utilities.convert_team_name_or_initials(team_playing_next_name)}'
                    self.save_prediction(date, prediction)
                else:
                    prediction = f'{utilities.convert_team_name_or_initials(team_playing_next_name)}  {predicted_conceded} - {predicted_scored}  {utilities.convert_team_name_or_initials(team_name)}'
                    self.save_prediction(date, prediction)
                
                score_predictions[team_name] = prediction
                    
        return score_predictions
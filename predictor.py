from typing import List, Tuple, Set
import json
import re
import numpy as np
from pandas.core.frame import DataFrame
from utilities import Utilities

utilities = Utilities()

class Predictor:
    def __init__(self, current_season):
        self.current_season = current_season
        self.predictions = {}
        self.accuracy = None
        self.result_accuracy = None
        self.home_scored_avg_diff = None
        self.away_scored_avg_diff = None
        self.prediction_file = f'data/predictions.json'
    
    def prediction_count(self, predictions: dict):
        total, correct, result_correct,  = 0, 0, 0
        # Count number of home and away goals (predicted vs actually)
        n_pred_home_goals, n_pred_away_goals, n_act_home_goals, n_act_away_goals = 0, 0, 0, 0
        
        # Scan through all current predictions and fill any missing 'actual' scorelines
        for predictions in predictions.values():
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
                        
                    n_pred_home_goals += home_score_p
                    n_pred_away_goals += away_score_p
                    n_act_home_goals += home_score_a
                    n_act_away_goals += away_score_a
        
        return total, correct, result_correct, n_pred_home_goals, n_pred_away_goals, n_act_home_goals, n_act_away_goals
    
    def set_accuracy(self):
        """Sets the class accuracy variables:
            - accuracy: the proportion of perfectly predicted predicitons
            - result_accuracy: the proportion of predictions with a correct result 
                (win, draw, lose)
            - home_acored_avg_diff: the difference between the predicted average 
                home goals scored vs the actual average home goals scored
            - away_acored_avg_diff: the difference between the predicted average 
                away goals scored vs the actual average away goals scored
        """
        # Read predictions dictionary (date string : predictions list) from json file
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
            
        total, correct, result_correct, n_pred_home_goals, n_pred_away_goals, n_act_home_goals, n_act_away_goals = self.prediction_count(predictions)
        
        if total != 0:        
            self.accuracy = correct / total
            self.result_accuracy  = result_correct / total
            # Aim for both to be zero
            # Positive -> predicting too many goals
            # Negative -> predicting too few goals
            self.home_scored_avg_diff = (n_pred_home_goals - n_act_home_goals) / total
            self.away_scored_avg_diff = (n_pred_away_goals - n_act_away_goals) / total
            
            # Write accuracy metrics to json file
            with open(self.prediction_file) as json_file:
                data = json.load(json_file)
                data['accuracy'] = self.accuracy
                data['resultAccuracy'] = self.result_accuracy
                data['homeScoredAvgDiff'] = self.home_scored_avg_diff
                data['awayScoredAvgDiff'] = self.away_scored_avg_diff
            
            # Overwrite file with new data
            with open(self.prediction_file, 'w') as f:
                json.dump(data, f)
        
    
    def insert_actual_scores_into_json_file(self, actual_scores: list) -> int:
        """Check whether each actual score string in the list is present in the 
           predictions json file and insert it if not."""
        count = 0
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
                        
            for date, score in actual_scores:
                for prediction in predictions[date]:
                    if prediction['prediction'] != None:
                        home_p, _, _, _, away_p = re.split(' +', prediction['prediction'])
                        home_s, _, _, _, away_s = re.split(' +', score)
                        # If the actual scoreline matches this prediction and no actual score has been filled
                        if (home_p == home_s) and (away_p == away_s) and (prediction['actual'] == None):
                            # Update this prediction with its actual score
                            prediction['actual'] = score
                            count += 1
                            break
        
        # Overwrite file with new data
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
        count = self.insert_actual_scores_into_json_file(actual_scores)
        return count
    
    def prediction_already_made(self, date: str, new_prediction: str, predictions: List[dict]) -> bool:        
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                if prediction['prediction'] == new_prediction:
                    already_made = True
        return already_made
        
    def insert_predicted_scores_into_json_file(self, new_predictions: Set[Tuple[str, str]]) -> int:
        count = 0
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
            
            for date, new_prediction in new_predictions:
                if not self.prediction_already_made(date, new_prediction, predictions):
                    predictions[date].append({'prediction': new_prediction, 'actual': None})
                    print("Adding new prediction:", new_prediction)
                    count += 1
        
        predictions = sorted(predictions.items())
        
        # Overwrite file with new data
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
        
        return count
    
    def calc_score_prediction(self, team_name: str, opp_team_name: str, home_advantages: DataFrame, home_away: str, form_rating: float, opp_form_rating: float, prev_meetings: List[dict]) -> Tuple[int, int]:
        # Get total goals scored and conceded in all previous games with this
        # particular opposition team
        goals_scored = 0
        goals_conceded = 0
        for prev_match in prev_meetings:
            if team_name == prev_match[1]:
                # Played at home
                goals_scored += prev_match[3]
                goals_conceded += prev_match[4]
            elif team_name == prev_match[2]:
                # Played away
                goals_scored += prev_match[4]
                goals_conceded += prev_match[3]
                
        # Average scored and conceded            
        predicted_scored = goals_scored / len(prev_meetings)
        predicted_conceded = goals_conceded / len(prev_meetings)
        
        # Boost the score of the team better in form based on the absolute 
        # difference in form
        form_diff = form_rating - opp_form_rating
        if form_diff > 0:
            # This team in better form
            predicted_scored += predicted_scored * (form_diff/100)
        else:
            # Other team in better form
            predicted_conceded += predicted_conceded * (abs(form_diff)/100)
                
        # Decrese scores conceded if playing at home
        if home_away == "Home":
            predicted_conceded *= (1 - home_advantages.df.loc[team_name, 'Total Home Advantage'][0])
        else:
            predicted_scored *= (1 - home_advantages.df.loc[opp_team_name, 'Total Home Advantage'][0])
        
        return int(round(predicted_scored)), int(round(predicted_conceded))
    
    def set_score_predictions(self, form, next_games, home_advantages) -> dict:
        predictions = {}  # Stores team names and the corresponding prediction for their next game
        predictions_for_json = set()  # Stores prediction objects for storing in a json file
        
        team_names = form.df.index.values.tolist()
        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if next_games != None:
                form_rating = form.get_current_form_rating(team_name)
                opp_team_name = next_games.df['Next Game'].loc[team_name]
                opposition_form_rating = form.get_current_form_rating(opp_team_name)
                home_away = next_games.df['HomeAway'].loc[team_name]
                prev_meetings = next_games.df.loc[team_name]['Previous Meetings']
                                
                if len(prev_meetings) > 0:
                    predicted_scored, predicted_conceded = self.calc_score_prediction(team_name, opp_team_name, home_advantages, home_away, form_rating, opposition_form_rating, prev_meetings)
                else:
                    predicted_scored = 0
                    predicted_conceded = 0
                
                # Construct prediction string to display
                if home_away == "Home":
                    prediction = f'{utilities.convert_team_name_or_initials(team_name)}  {predicted_scored} - {predicted_conceded}  {utilities.convert_team_name_or_initials(opp_team_name)}'
                else:
                    prediction = f'{utilities.convert_team_name_or_initials(opp_team_name)}  {predicted_conceded} - {predicted_scored}  {utilities.convert_team_name_or_initials(team_name)}'
                
                game_date = next_games.df['Date'].astype(str).loc[team_name]
                predictions_for_json.add((game_date, prediction))
            predictions[team_name] = prediction
            
        count = self.insert_predicted_scores_into_json_file(predictions_for_json)
        self.predictions = predictions
        
        return count

    def signed_float_str(self, float_val):
        float_val = round(float_val, 2)
        if float_val >= 0:
            return f'+{float_val}'
        return str(float_val)

    def update_predictions(self, fixtures, form, next_games, home_advantages):
        count = self.set_score_predictions(form, next_games, home_advantages)
        if count > 0:
            print(f'ℹ️ Added {count} new predictions')
            
        count = self.record_actual_results(fixtures)
        if count > 0:
            print(f'ℹ️ Updated {count} predictions with their actual results')
            
        self.set_accuracy()
        print(f'ℹ️ Predicting with accuracy: {self.accuracy*100}%')
        print(f'ℹ️ Predicting correct results with accuracy: {self.result_accuracy*100}%')
        print(f'ℹ️ Net predictions: [{self.signed_float_str(self.home_scored_avg_diff)}] - [{self.signed_float_str(self.away_scored_avg_diff)}]')
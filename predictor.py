from typing import List, Tuple
import json
import re
import numpy as np
from pandas.core.frame import DataFrame
from utilities import Utilities

util = Utilities()

class Predictor:
    def __init__(self, current_season):
        self.current_season = current_season
        self.predictions = {}
        self.accuracy = None
        self.result_accuracy = None
        self.home_scored_avg_diff = None
        self.away_scored_avg_diff = None
        self.prediction_file = f'data/predictions.json'
    
    def identical_fixtures(self, scoreline1, scoreline2):
        home_p, _, _, _, away_p = re.split(' +', scoreline1)
        home_s, _, _, _, away_s = re.split(' +', scoreline2)
        return (home_p == home_s) and (away_p == away_s)

    def extract_scores(self, scoreline):
        _, home_score, _, away_score, _ = re.split(' +', scoreline)
        return int(home_score), int(away_score)
    
    def identical_result(self, pred_home_goals, pred_away_goals, act_home_goals, act_away_goals):
        return (pred_home_goals == pred_away_goals and act_home_goals == act_away_goals) or \
                (pred_home_goals > pred_away_goals and act_home_goals > act_away_goals) or \
                (pred_home_goals < pred_away_goals and act_home_goals < act_away_goals)

    
    def prediction_count(self, predictions: dict):
        total, correct, result_correct,  = 0, 0, 0
        # Count number of home and away goals (predicted vs actually)
        n_pred_home_goals, n_pred_away_goals, n_act_home_goals, n_act_away_goals = 0, 0, 0, 0
        
        # Scan through all current predictions and fill any missing 'actual' scorelines
        for predictions in predictions.values():
            for prediction in predictions:
                predicted_score  = prediction['prediction']
                actual_score = prediction['actual']
                if predicted_score != None and actual_score != None:
                    total += 1
                    if predicted_score == actual_score:
                        correct += 1
                    
                    # Get the goals scored for predictions and actual
                    pred_home_goals, pred_away_goals = self.extract_scores(predicted_score)
                    act_home_goals, act_away_goals = self.extract_scores(actual_score)
                    # Prediction and actual BOTH a draw or home win or away win
                    if self.identical_result(pred_home_goals, pred_away_goals, act_home_goals, act_away_goals):
                        result_correct += 1
                        
                    n_pred_home_goals += pred_home_goals
                    n_pred_away_goals += pred_away_goals
                    n_act_home_goals += act_home_goals
                    n_act_away_goals += act_away_goals
        
        return total, correct, result_correct, n_pred_home_goals, n_pred_away_goals, n_act_home_goals, n_act_away_goals
    
    def insert_accuracy_into_json_file(self):
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
    
    def record_accuracy(self):
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

    
    def insert_actual_scores_into_json_file(self, actual_scores: list):
        """Check whether each actual score string in the list is present in the 
           predictions json file and insert it if not."""
        n_inserted = 0
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
                        
            for date, actual_score in actual_scores:
                for prediction in predictions[date]:
                    predicted_score = prediction['prediction']
                    actual_score = prediction['actual']
                    if predicted_score != None:
                        # If the actual scoreline matches this prediction and no actual score has been filled
                        if self.identical_fixtures(actual_score, predicted_score) and actual_score == None:
                            # Update this prediction with its actual score
                            prediction['actual'] = actual_score
                            print("Adding actual score:", actual_score)
                            n_inserted += 1
                            break
        
        # Overwrite file with new data
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
        
        if n_inserted > 0:
            print(f'ℹ️ Updated {n_inserted} existing predictions with their actual results')
    
    def format_scoreline_str_from_str(self, team_name, opp_team_name, score_str, home_away):
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)
        
        if home_away == 'Home':
            scoreline = f'{team_name_initials}  {score_str}  {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials}  {score_str}  {team_name_initials}'
        return scoreline
    
    def get_actual_scores(self, fixtures: DataFrame) -> List[str]:
        actual_scores = []
        for matchday_no in range(1, 39):
            matchday = fixtures.df[f'Matchday {matchday_no}']
            
            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):                
                for team_name, row in fixtures.df[f'Matchday {matchday_no}'].iterrows():
                    if row['Status'] == 'FINISHED':
                        date = np.datetime_as_string(row['Date'].asm8, unit='D')
                        actual_score = self.format_scoreline_str_from_str(team_name, row["Team"], row["Score"], row["HomeAway"])
                        actual_scores.append((date, actual_score))
        
        return actual_scores
                            
    def record_actual_results(self, fixtures: DataFrame):
        actual_scores = self.get_actual_scores(fixtures)
        # Update prediction json objects by inserting their actual scores
        n_inserted = self.insert_actual_scores_into_json_file(actual_scores)
                
        if n_inserted > 0:
            print(f'ℹ️ Updated {n_inserted} existing predictions with their actual results')
            
            
    
    
    def exact_prediction_already_made(self, date: str, new_prediction: str, predictions: List[dict]) -> bool:        
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                # Check if prediciton strings match perfectly
                # i.e. identical fixture and same score predicted
                if (prediction['prediction'] == new_prediction) and (prediction['actual'] == None):
                    already_made = True
                    break
        return already_made

    def outdated_prediction_already_made(self, date: str, new_prediction: str, predictions: List[dict]) -> bool: 
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                predicted_score = prediction['prediction']
                actual_score = prediction['actual']
                if self.identical_fixtures(predicted_score, new_prediction):
                    # If fixture match perfectly but predicted scoreline different (outdated)
                    if (predicted_score != new_prediction) and (actual_score == None):
                        already_made = True  
                    break
        return already_made
    
    def insert_new_prediction(self, date, new_prediction, predictions):
        if date not in predictions.keys():
            predictions[date] = []
            
        # Update existing prediction object with new score prediction
        for prediction in predictions[date]:
            predicted_score = prediction['prediction']
            actual_score = prediction['actual']
            if self.identical_fixtures(predicted_score, new_prediction):
                # If fixture match perfectly but predicted scoreline different (outdated)
                if (predicted_score != new_prediction) and (actual_score == None):
                    print("Updating existing prediction:", predicted_score, '-->', new_prediction)
                    prediction['prediction'] = new_prediction
                return
            
        # Add new prediction object
        print("Adding new prediction:", new_prediction)
        predictions[date].append({'prediction': new_prediction, 'actual': None})
        
        
    def insert_predicted_scores_into_json_file(self):
        new_predictions = self.predictions.values()
        
        n_inserted = 0
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
            
            for date, new_prediction in new_predictions:
                if not self.exact_prediction_already_made(date, new_prediction, predictions):
                    self.insert_new_prediction(date, new_prediction, predictions)
                    n_inserted += 1
        
        # for k in data.keys():
        #     print(k)
        
        # predictions = sorted(data.items())
        
        # for k in data.keys():
        #     print(k)
        
        # Overwrite file with new data
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
        
        if n_inserted > 0:
            print(f'ℹ️ Added {n_inserted} new predictions')

    
    def avg_previous_result(self, team_name, prev_meetings):
        goals_scored, goals_conceded = 0, 0
        
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
        avg_scored = goals_scored / len(prev_meetings)
        avg_conceded = goals_conceded / len(prev_meetings)
        return avg_scored, avg_conceded

    def modify_prediction_by_current_form(self, form_rating, opp_form_rating, pred_scored=0, pred_conceded=0):
        # Boost the score of the team better in form based on the absolute 
        # difference in form
        form_diff = form_rating - opp_form_rating
        if form_diff > 0:
            # This team in better form
            pred_scored += pred_scored * (form_diff/100)
        else:
            # Other team in better form
            pred_conceded += pred_conceded * (abs(form_diff)/100)
        return pred_scored, pred_conceded

        
    def modify_prediction_by_home_advantage(self, team_name, opp_team_name, home_advantages, home_away, predicted_scored=0, predicted_conceded=0):
        if home_away == "Home":
            predicted_conceded *= (1 - home_advantages.df.loc[team_name, 'Total Home Advantage'][0])
        else:
            predicted_scored *= (1 - home_advantages.df.loc[opp_team_name, 'Total Home Advantage'][0])
        return predicted_scored, predicted_conceded
    
    def calc_score_prediction(self, team_name: str, opp_team_name: str, home_advantages: DataFrame, home_away: str, form_rating: float, opp_form_rating: float, prev_meetings: List[dict]) -> Tuple[int, int]:
        # Begin with average scored and conceded in previous meetings         
        predicted_scored, predicted_conceded = self.avg_previous_result(team_name, prev_meetings)
        predicted_scored, predicted_conceded = self.modify_prediction_by_current_form(form_rating, opp_form_rating, predicted_scored, predicted_conceded)
        # Decrese scores conceded if playing at home
        predicted_scored, predicted_conceded = self.modify_prediction_by_home_advantage(team_name, opp_team_name, home_advantages, home_away, predicted_scored, predicted_conceded)
        
        return int(round(predicted_scored)), int(round(predicted_conceded))
    
    def format_scoreline_str(self, team_name, opp_team_name, scored, conceded, home_away) -> str:
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)
        # Construct prediction string to display
        if home_away == "Home":
            scoreline = f'{team_name_initials}  {scored} - {conceded}  {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials}  {conceded} - {scored}  {team_name_initials}'
        return scoreline
    
    def gen_score_predictions(self, form, next_games, home_advantages):
        """Generate a dictionary

        Args:
            form ([type]): [description]
            next_games ([type]): [description]
            home_advantages ([type]): [description]
        """
        predictions = {}  # {"Liverpool FC": ("25-08-21", "LIV  2 - 1 BUR"), ...}
        
        team_names = form.df.index.values.tolist()
        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if next_games != None:
                form_rating = form.get_current_form_rating(team_name)
                opp_team_name = next_games.df['Next Game'].loc[team_name]
                opp_form_rating = form.get_current_form_rating(opp_team_name)
                home_away = next_games.df['HomeAway'].loc[team_name]
                prev_meetings = next_games.df.loc[team_name]['Previous Meetings']
                                
                if len(prev_meetings) > 0:
                    pred_scored, pred_conceded = self.calc_score_prediction(team_name, opp_team_name, home_advantages, home_away, form_rating, opp_form_rating, prev_meetings)
                else:
                    pred_scored, pred_conceded = 0, 0
                    
                scoreline = self.format_scoreline_str(team_name, opp_team_name, pred_scored, pred_conceded, home_away)
                
                game_date = next_games.df['Date'].astype(str).loc[team_name]
                prediction = (game_date, scoreline)
                
            predictions[team_name] = prediction
            
        self.predictions = predictions
        
    def signed_float_str(self, float_val):
        float_val = round(float_val, 2)
        if float_val >= 0:
            return f'+{float_val}'
        return str(float_val)

    def update_predictions(self, fixtures, form, next_games, home_advantages):
        self.gen_score_predictions(form, next_games, home_advantages)
        self.insert_predicted_scores_into_json_file()
            
        actual_scores = self.get_actual_scores(fixtures)
        self.insert_actual_scores_into_json_file(actual_scores)
        
        for k in self.predictions.keys():
            print(k)
        
        self.record_accuracy()
        self.insert_accuracy_into_json_file()
        print(f'ℹ️ Predicting with accuracy: {self.accuracy*100}%')
        print(f'ℹ️ Predicting correct results with accuracy: {self.result_accuracy*100}%')
        print(f'ℹ️ Net predictions: [{self.signed_float_str(self.home_scored_avg_diff)}] - [{self.signed_float_str(self.away_scored_avg_diff)}]')
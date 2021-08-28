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
    
    def get_predictions(self):
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
        return predictions

    def get_accuracy(self):
        accuracy = round(self.accuracy, 2)
        result_accuracy = round(self.result_accuracy, 2)
        return accuracy, result_accuracy
    
    def get_next_game_prediction(self, team_name):
        score_prediction = self.predictions[team_name][1]  # (Date, Prediction)

        return score_prediction
    
    def identical_fixtures(self, scoreline1, scoreline2):
        home_p, _, _, _, away_p = scoreline1.split(' ')
        home_s, _, _, _, away_s = scoreline2.split(' ')
        return (home_p == home_s) and (away_p == away_s)

    def extract_scores(self, scoreline):
        _, home_score, _, away_score, _ = scoreline.split(' ')
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
            matchday = fixtures.df[matchday_no]
            
            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):                
                for team_name, row in fixtures.df[matchday_no].iterrows():
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
            
            
    
    
    def exact_prediction_already_made(self, date: str, new_prediction: str, predictions: dict) -> bool:        
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                # Check if prediciton strings match perfectly
                # i.e. identical fixture and same score predicted
                if (prediction['prediction'] == new_prediction) and (prediction['actual'] == None):
                    already_made = True
                    break
        return already_made

    def outdated_prediction_already_made(self, date: str, new_prediction: str, predictions: dict) -> bool: 
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                predicted_score = prediction['prediction']
                actual_score = prediction['actual']
                if predicted_score != None:
                    if self.identical_fixtures(predicted_score, new_prediction):
                        # If fixture match perfectly but predicted scoreline different (outdated)
                        if (predicted_score != new_prediction) and (actual_score == None):
                            already_made = True  
                        break
        return already_made
    
    def insert_new_prediction(self, date: str, new_prediction: str, predictions: dict):
        if date not in predictions.keys():
            predictions[date] = []
            
        # Update existing prediction object with new score prediction
        for prediction in predictions[date]:
            predicted_score = prediction['prediction']
            actual_score = prediction['actual']
            if predicted_score != None:
                if self.identical_fixtures(predicted_score, new_prediction):
                    # If fixture match perfectly but predicted scoreline different (outdated)
                    if (predicted_score != new_prediction) and (actual_score == None):
                        print("Updating existing prediction:", predicted_score, '-->', new_prediction)
                        prediction['prediction'] = new_prediction
                    return
            
        # Add new prediction object
        print("Adding new prediction:", new_prediction)
        predictions[date].append({'prediction': new_prediction, 'actual': None})
    
    def avg_previous_result(self, team_name: str, prev_meetings: List[Tuple], debug=False):
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
        
        if debug:
            print("\tAvg".ljust(60), f"[{avg_scored} - {avg_conceded}]")

        return avg_scored, avg_conceded

    def modify_prediction_by_current_form(self, form_rating: str, opp_form_rating: str, pred_scored: int = 0, pred_conceded: int = 0, debug: bool = False):
        # Boost the score of the team better in form based on the absolute 
        # difference in form
        form_diff = form_rating - opp_form_rating
        
        if form_diff > 0:
            # This team in better form
            if debug:
                print(f"\tForm difference {form_rating} - {opp_form_rating} = [{round(form_diff, 2)}] -> {pred_scored} + {round(pred_scored * (form_diff/100), 2)}".ljust(60), f"[{round(pred_scored + (pred_scored * (form_diff/100)), 2)} - {round(pred_conceded, 2)}]")
            pred_scored += pred_scored * (form_diff/100)
        else:
            # Other team in better form
            if debug:
                print(f"\tForm difference {form_rating} - {opp_form_rating} = [{round(form_diff, 2)}] -> {pred_conceded} + {round(pred_conceded * (abs(form_diff)/100), 2)}".ljust(60), f"[{round(pred_scored, 2)} - {round(pred_conceded + (pred_conceded * (abs(form_diff)/100)), 2)}]")
            pred_conceded += pred_conceded * (abs(form_diff)/100)
        return pred_scored, pred_conceded

        
    def modify_prediction_by_home_advantage(self, team_name: str, opp_team_name: str, home_advantages: DataFrame, home_away: str, pred_scored: int = 0, pred_conceded: int = 0, debug: bool = False) -> Tuple[int, int]:
        if home_away == "Home":
            # Decrease conceded (if team has a positive home advantage)
            if debug:
                print(f"\tHome -> {pred_conceded} x {round((1 - home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]), 2)}".ljust(60), f"[{round(pred_scored, 2)} - {round(pred_conceded * ((1 - home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0])), 2)}]")
            pred_conceded *= (1 - home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0])
        else:
            # Decrease scored (if opposition team has a positive home advantage)
            if debug:
                print(f"\tAway -> {pred_scored} x {round((1 - home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]), 2)}".ljust(60), f"[{round(pred_scored * ((1 - home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0])), 2)} - {round(pred_conceded, 2)}]")
            pred_scored *= (1 - home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0])
        return pred_scored, pred_conceded
    
    def calc_score_prediction(self, team_name: str, opp_team_name: str, home_advantages: DataFrame, home_away: str, form_rating: float, opp_form_rating: float, prev_meetings: List[dict], debug: bool = False) -> Tuple[int, int]:
        pred_scored, pred_conceded = 0, 0
        if len(prev_meetings) > 0:
            # Begin with average scored and conceded in previous meetings
            pred_scored, pred_conceded = self.avg_previous_result(team_name, prev_meetings, debug=debug)
        # Modify based on difference in current form between two teams
        pred_scored, pred_conceded = self.modify_prediction_by_current_form(form_rating, opp_form_rating, pred_scored, pred_conceded, debug=debug)
        # Decrese scores conceded if playing at home
        pred_scored, pred_conceded = self.modify_prediction_by_home_advantage(team_name, opp_team_name, home_advantages, home_away, pred_scored, pred_conceded, debug=debug)
        
        return int(round(pred_scored)), int(round(pred_conceded))
    
    def format_scoreline_str(self, team_name: str, opp_team_name: str, scored: int, conceded: int, home_away: str) -> str:
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)
        # Construct prediction string to display
        if home_away == "Home":
            scoreline = f'{team_name_initials} {scored} - {conceded} {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials} {conceded} - {scored} {team_name_initials}'
        return scoreline
    
    def gen_score_predictions(self, form: DataFrame, next_games: DataFrame, home_advantages: DataFrame, debug: bool = False):
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
                opp_team_name = next_games.df['NextTeam'].loc[team_name]
                opp_form_rating = form.get_current_form_rating(opp_team_name)
                home_away = next_games.df['HomeAway'].loc[team_name]
                prev_meetings = next_games.df.loc[team_name]['PreviousMeetings']
                
                if debug:
                    print(team_name, "vs", opp_team_name)
                                
                pred_scored, pred_conceded = self.calc_score_prediction(team_name, opp_team_name, home_advantages, home_away, form_rating, opp_form_rating, prev_meetings, debug=debug)
                    
                scoreline = self.format_scoreline_str(team_name, opp_team_name, pred_scored, pred_conceded, home_away)
                
                if debug:
                    print("\t\b", scoreline)
                
                game_date = next_games.df['Date'].astype(str).loc[team_name]
                prediction = (game_date, scoreline)
                
            predictions[team_name] = prediction
            
        self.predictions = predictions
        
    def signed_float_str(self, value: float):
        value = round(value, 2)
        if value >= 0:
            return f'+{value}'
        return str(value)

    def insert_new_predictions(self, predictions: dict):
        new_predictions = self.predictions.values()
        
        n_inserted = 0
        for date, new_prediction in new_predictions:
            if not self.exact_prediction_already_made(date, new_prediction, predictions):
                self.insert_new_prediction(date, new_prediction, predictions)
                n_inserted += 1
        
        return n_inserted
    
    def insert_actual_scores(self, predictions: dict, fixtures: DataFrame):
        actual_scores = self.get_actual_scores(fixtures)
        
        n_inserted = 0
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
        
        return n_inserted
    
    def insert_accuracy(self, data: dict):
        data['accuracy'] = self.accuracy
        data['resultAccuracy'] = self.result_accuracy
        data['homeScoredAvgDiff'] = self.home_scored_avg_diff
        data['awayScoredAvgDiff'] = self.away_scored_avg_diff

    def update_json_file(self, fixtures: DataFrame):
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data[f'predictions{self.current_season}']
            
            new_predictions_inserted = self.insert_new_predictions(predictions)
            actual_scores_inserted = self.insert_actual_scores(predictions, fixtures)
            self.insert_accuracy(data)
        
            if new_predictions_inserted > 0:
                print(f'ℹ️ Added {new_predictions_inserted} new predictions')
            if actual_scores_inserted > 0:
                print(f'ℹ️ Updated {actual_scores_inserted} existing predictions with their actual results')
                
        # Sort by date
        predictions = dict(sorted(predictions.items(), key=lambda x: x[0]))
        
        # Overwrite file with new data
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
        
    def update_predictions(self, fixtures, form, next_games, home_advantages):
        self.gen_score_predictions(form, next_games, home_advantages, debug=False)
        self.record_accuracy()
        self.update_json_file(fixtures)
        print(f'ℹ️ Predicting with accuracy: {round(self.accuracy*100, 2)}%')
        print(f'ℹ️ Predicting correct results with accuracy: {round(self.result_accuracy*100, 2)}%')
        print(f'ℹ️ Net predictions: [{self.signed_float_str(self.home_scored_avg_diff)}] - [{self.signed_float_str(self.away_scored_avg_diff)}]')

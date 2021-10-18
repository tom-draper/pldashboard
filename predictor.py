from dataclasses import dataclass
import json
from typing import Optional
from datetime import datetime

import numpy as np
from pandas.core.frame import DataFrame

from data import Fixtures, Form, HomeAdvantages, Upcoming
from utilities import Utilities

util = Utilities()


@dataclass
class PredictionsCount:
    total: int
    correct: int
    result_correct: int
    n_pred_home: int
    n_pred_away: int
    n_act_home: int
    n_act_away: int
    
    
@dataclass
class Accuracy:
    accuracy: float
    result_accuracy: float
    home_scored_avg_diff: float 
    away_scored_avg_diff: float
    

class Predictor:
    def __init__(self, current_season):
        self.current_season = current_season
        self.predictions = {}  # type: dict[str, tuple[str, str, list[str]]]
        self.accuracy = None  # type: Accuracy
        
        self.form_diff_multiplier = 1.5
        self.home_advantage_multiplier = 1.5
        # self.accuracy = None
        # self.result_accuracy = None
        # self.home_scored_avg_diff = None
        # self.away_scored_avg_diff = None
        self.prediction_file = f'data/predictions_{current_season}.json'

    def get_predictions(self) -> dict:
        predictions = {}
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data['predictions']
        return predictions

    def get_accuracy(self) -> tuple[float, float]:
        accuracy = round(self.accuracy['accuracy']*100, 2)
        result_accuracy = round(self.accuracy['resultAccuracy']*100, 2)  # As percentage
        return accuracy, result_accuracy

    def get_next_game_prediction(self, team_name: str) -> tuple[str, str]:
        return self.predictions[team_name][1]  # Prediction from (Date, Prediction, Details)







    def predictions_count(self) -> tuple[int, int, int, int, int, int, int]:
        # Read predictions dictionary (date string : predictions list) from json file
        predictions = {}
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions = data['predictions']
        
        total = 0
        correct = 0
        result_correct = 0
        # Count number of home and away goals (predicted vs actually)
        n_pred_home = 0
        n_pred_away = 0
        n_act_home = 0
        n_act_away = 0

        # Scan through all current predictions and fill any missing 'actual' scorelines
        for predictions in predictions.values():
            for prediction in predictions:
                predicted_score = prediction['prediction']
                actual_score = prediction['actual']
                
                if predicted_score != None and actual_score != None:
                    total += 1
                    if predicted_score == actual_score:
                        correct += 1

                    # Get the goals scored for predictions and actual
                    pred_home_goals, pred_away_goals = util.extract_int_score_from_scoreline(predicted_score)
                    act_home_goals, act_away_goals = util.extract_int_score_from_scoreline(actual_score)
                    # Prediction and actual BOTH a draw or home win or away win
                    if util.identical_result(pred_home_goals, pred_away_goals, act_home_goals, act_away_goals):
                        result_correct += 1

                    n_pred_home += pred_home_goals
                    n_pred_away += pred_away_goals
                    n_act_home += act_home_goals
                    n_act_away += act_away_goals

        return PredictionsCount(total, correct, result_correct, n_pred_home, 
                                n_pred_away, n_act_home, n_act_away)
    
    def measure_accuracy(self):
        """Sets the class accuracy variables:
            - accuracy: the proportion of perfectly predicted predicitons
            - result_accuracy: the proportion of predictions with a correct result 
                (win, draw, lose)
            - home_acored_avg_diff: the difference between the predicted average 
                home goals scored vs the actual average home goals scored
            - away_acored_avg_diff: the difference between the predicted average 
                away goals scored vs the actual average away goals scored
        """

        counts = self.predictions_count()

        accuracy = {}
        if counts.total != 0:
            accuracy['accuracy'] = counts.correct / counts.total
            accuracy['resultAccuracy'] = counts.result_correct / counts.total
            # Aim for both to be zero
            # Positive -> predicting too many goals
            # Negative -> predicting too few goals
            accuracy['homeScoredAvgDiff'] = (counts.n_pred_home - counts.n_act_home) / counts.total
            accuracy['awayScoredAvgDiff'] = (counts.n_pred_away - counts.n_act_away) / counts.total
            
        return accuracy

    def format_scoreline_str_from_str(self, team_name: str, opp_team_name: str, 
                                      score: str, home_away: str) -> str:
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)

        if home_away == 'Home':
            scoreline = f'{team_name_initials} {score} {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials} {score} {team_name_initials}'

        return scoreline

    def get_actual_scores(self, fixtures: DataFrame) -> set[tuple[str, str]]:
        actual_scores = set()
        for matchday_no in range(1, 39):
            matchday = fixtures.df[matchday_no]

            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):
                for team_name, row in fixtures.df[matchday_no].iterrows():
                    if row['Status'] == 'FINISHED':
                        date = np.datetime_as_string(
                            row['Date'].asm8, unit='D')
                        actual_score = self.format_scoreline_str_from_str(
                            team_name, row["Team"], row["Score"], row["HomeAway"])
                        actual_scores.add((date, actual_score))

        return actual_scores

    def exact_prediction_already_made(self, date: str, new_prediction: str, 
                                      predictions: dict) -> bool:
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                # Check if prediciton strings match perfectly
                # i.e. identical fixture and same score predicted
                if (prediction['prediction'] == new_prediction) and (prediction['actual'] == None):
                    already_made = True
                    break

        return already_made

    def outdated_prediction_already_made(self, date: str, new_prediction: str, 
                                         predictions: dict) -> bool:
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                predicted_score = prediction['prediction']
                actual_score = prediction['actual']
                if predicted_score != None:
                    if util.identical_fixtures(predicted_score, new_prediction):
                        # If fixture match perfectly but predicted scoreline different (outdated)
                        if (predicted_score != new_prediction) and (actual_score == None):
                            already_made = True
                        break

        return already_made
    
    def update_existing_prediction(self, date: str, new_prediction: str, details: list[str], 
                                   predictions: dict[str, list]) -> bool:
        # Update existing prediction object with new score prediction...
        for prediction in predictions[date]:
            predicted_score = prediction['prediction']
            if util.identical_fixtures(predicted_score, new_prediction):
                # If fixture match perfectly predicted scoreline different (outdated)
                if (predicted_score != new_prediction) and (prediction['actual'] == None):
                    print("Updating existing prediction:", predicted_score, '-->', new_prediction)
                    prediction['prediction'] = new_prediction
                    prediction['details'] = details
                return True
        return False

    def insert_new_prediction(self, date: str, time: str, prediction_id: int, new_prediction: str, 
                              details: list[str], predictions: dict[str, list]) -> bool:
        """Attempts to inesrt a prediction into the predictions dictionary.
           Returns True if inserted a NEW predcition
           Return False if a prediction for this fixture already exists"""
        # Init with empty list if missing...
        if date not in predictions.keys():
            predictions[date] = []

        # Try to update the existing prediciton if available...
        if self.update_existing_prediction(date, new_prediction, details, predictions):
            id_used = False
        else:
            # Otherwise add new...
            print("Adding new prediction:", new_prediction)
            predictions[date].append({'id': prediction_id, 
                                      'prediction': new_prediction,
                                      'time': time, 
                                      'actual': None, 
                                      'details': details})
            id_used = True
        
        return id_used

    def avg_previous_result(self, team_name: str, prev_matches: 
                            list[dict[str, str]]) -> tuple[float, float]:
        goals_scored = 0
        goals_conceded = 0
        for prev_match in prev_matches:
            if team_name == prev_match['HomeTeam']:
                # Played at home
                goals_scored += prev_match['HomeGoals']
                goals_conceded += prev_match['AwayGoals']
            elif team_name == prev_match['AwayTeam']:
                # Played away
                goals_scored += prev_match['AwayGoals']
                goals_conceded += prev_match['HomeGoals']

        # Average scored and conceded
        avg_scored = goals_scored / len(prev_matches)
        avg_conceded = goals_conceded / len(prev_matches)

        return avg_scored, avg_conceded

    def modify_prediction_by_current_form(self, form_rating: float, opp_form_rating: float, 
                                          home_away: str, pred_scored: float = 0, 
                                          pred_conceded: float = 0) -> tuple[float, float]:
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = form_rating - opp_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            operation = f'{round(pred_scored, 4)} += {round(pred_scored, 4)} * {round((form_diff/100), 4)} * {self.form_diff_multiplier}'
            pred_scored += pred_scored * (form_diff/100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            operation = f'{round(pred_conceded, 4)} += {round(pred_conceded, 4)} * {round((form_diff/100), 4)} * {self.form_diff_multiplier}'
            pred_conceded += pred_conceded * abs(form_diff/100) * self.form_diff_multiplier
        
        if home_away == "Home":
            home_goals = pred_scored
            away_goals = pred_conceded
            home_form_rating = form_rating
            away_form_rating = opp_form_rating
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
            home_form_rating = opp_form_rating
            away_form_rating = form_rating
            
        detail = {'description': 'Adjusted by form',
                  'operation': operation,
                  'homeGoals': round(home_goals, 4),
                  'awayGoals': round(away_goals, 4),
                  'homeFormRating': round(home_form_rating, 4),
                  'awayFormRating': round(away_form_rating, 4)}

        return pred_scored, pred_conceded, detail

    def modify_prediction_by_home_advantage(self, home_advantage: float, opp_home_advantage: float,
                                            home_away: str, pred_scored: float = 0, 
                                            pred_conceded: float = 0) -> tuple[float, float]:
        if home_away == "Home":
            # Decrease conceded (if team has a positive home advantage)
            operation = f'{round(pred_conceded, 4)} *= 1 - ({round(home_advantage, 4)} * {self.home_advantage_multiplier})'
            pred_conceded *= (1 - (home_advantage * self.home_advantage_multiplier))
            home_goals = pred_scored
            away_goals = pred_conceded
            advantage = home_advantage
        else:
            # Decrease scored (if opposition team has a positive home advantage)
            operation = f'{round(pred_scored, 4)} *= 1 - ({round(opp_home_advantage, 4)} * {self.home_advantage_multiplier})'
            pred_scored *= (1 - (opp_home_advantage * self.home_advantage_multiplier))
            home_goals = pred_conceded
            away_goals = pred_scored
            advantage = opp_home_advantage

        detail = {'description': 'Adjusted by home advantage',
                  'operation': operation,
                  'homeGoals': round(home_goals, 4), 
                  'awayGoals': round(away_goals, 4), 
                  'homeAdvantage': round(advantage, 4)}
        
        return pred_scored, pred_conceded, detail

    def neutral_prev_matches(self, prev_matches):
        neutral_prev_matches = []
        for match in prev_matches:
            neutral_match = {}
            # Rename to match json format
            neutral_match['date'] = match['Date']
            neutral_match['homeTeam'] = match['HomeTeam']
            neutral_match['awayTeam'] = match['AwayTeam']
            neutral_match['homeGoals'] = match['HomeGoals']
            neutral_match['awayGoals'] = match['AwayGoals']
            neutral_prev_matches.append(neutral_match)
        
        return neutral_prev_matches

    def starting_score(self, team_name: str, prev_matches: list[dict[str]], home_away: str):
        if prev_matches:
            # Begin with average scored and conceded in previous meetings
            pred_scored, pred_conceded = self.avg_previous_result(team_name, prev_matches)
            description = 'Previous match average'
        else:
            pred_scored, pred_conceded = 1.0, 1.0
            description = 'Default'
        
        if home_away == "Home":
            home_goals = pred_scored
            away_goals = pred_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
            
        detail = {'description': description, 
                  'previousMatches': self.neutral_prev_matches(prev_matches),
                  'homeGoals': round(home_goals, 4), 
                  'awayGoals': round(away_goals, 4)}
        
        return pred_scored, pred_conceded, detail

    def detailed_score(self, home_away, pred_scored, pred_conceded):
        if home_away == "Home":
            home_goals = pred_scored
            away_goals = pred_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
        detailed_score = {'homeGoals': round(home_goals, 4), 
                          'awayGoals': round(away_goals, 4)}
        return detailed_score

    def calc_score_prediction(self, team_name: str, home_advantage: float, 
                              opp_home_advantage: float, home_away: str, 
                              form_rating: float, opp_form_rating: float, 
                              prev_matches: list[dict[str, str]]) -> tuple[int, int]:
        details = {'starting': {}, 'adjustments': [], 'score': {}}
        
        pred_scored, pred_conceded, detail = self.starting_score(team_name, prev_matches, home_away)
        details['starting'] = detail

        # Modify based on difference in current form between two teams
        pred_scored, pred_conceded, detail = self.modify_prediction_by_current_form(
            form_rating, opp_form_rating, home_away, pred_scored, pred_conceded)
        details['adjustments'].append(detail)
        
        # Decrese scores conceded if playing at home
        pred_scored, pred_conceded, detail = self.modify_prediction_by_home_advantage(
            home_advantage, opp_home_advantage, home_away, pred_scored, pred_conceded)
        details['adjustments'].append(detail)
        
        # Get unrounded version of predicted score
        detail = self.detailed_score(home_away, pred_scored, pred_conceded)
        details['score'] = detail

        return int(round(pred_scored)), int(round(pred_conceded)), details

    def format_scoreline_str(self, team_name: str, opp_team_name: str, scored: int, 
                             conceded: int, home_away: str) -> str:
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)
        
        # Construct prediction string for display...
        if home_away == "Home":
            scoreline = f'{team_name_initials} {scored} - {conceded} {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials} {conceded} - {scored} {team_name_initials}'

        return scoreline

    def gen_score_predictions(self, form: DataFrame, upcoming: DataFrame, 
                              home_advantages: DataFrame):
        """Generate a dictionary

        Args:
            form ([type]): [description]
            next_games ([type]): [description]
            home_advantages ([type]): [description]
        """
        # {"Liverpool FC": ("25-08-21", "LIV  2 - 1 BUR"), ...}
        predictions = {}  # type: dict[str, Optional[tuple[str, str]]]
        team_names = form.df.index.values.tolist()

        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if upcoming != None:
                opp_team_name = upcoming.df['NextTeam'].loc[team_name]
                form_rating = form.get_current_form_rating(team_name)
                opp_form_rating = form.get_current_form_rating(opp_team_name)
                home_advantage = home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]
                opp_home_advantage = home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]
                home_away = upcoming.df['HomeAway'].loc[team_name]  # type: dict[str, str]
                prev_matches = upcoming.df.loc[team_name]['PreviousMatches']  # type: list[tuple]

                pred_scored, pred_conceded, details = self.calc_score_prediction(
                    team_name, home_advantage,opp_home_advantage, home_away, 
                    form_rating, opp_form_rating, prev_matches)

                scoreline = self.format_scoreline_str(team_name, opp_team_name, 
                                                      pred_scored, pred_conceded, 
                                                      home_away)

                date = upcoming.df['Date'].loc[team_name].to_pydatetime()
                prediction = (date, scoreline, details)
                print(prediction)

            predictions[team_name] = prediction

        return predictions

    def signed_float_str(self, value: float) -> str:
        value = round(value, 2)
        if value >= 0:
            return f'+{value}'
        return str(value)
    
    def max_prediction_id(self, predictions: dict) -> int:
        return max([max([pred['id'] for pred in preds]) for preds in predictions.values()])        

    def insert_new_predictions(self, new_predictions, predictions: dict):
        max_id = self.max_prediction_id(predictions)
        prediction_id = max_id + 1
        
        n_inserted = 0
        for dt, new_prediction, details in new_predictions:
            date = datetime.strftime(dt, '%Y-%m-%d')
            print(dt)
            print(date)
            if not self.exact_prediction_already_made(date, new_prediction, predictions):
                time = datetime.strftime(dt, '%H:%M:%S')
                if self.insert_new_prediction(date, time, prediction_id, new_prediction, 
                                              details, predictions):
                    prediction_id += 1
                    n_inserted += 1

        if n_inserted > 0:
            print(f'➡️  Added {n_inserted} new predictions')

    def insert_actual_scores(self, actual_scores: set[tuple[str, str]], predictions: dict):
        n_inserted = 0
        for date, actual_score in actual_scores:
            for prediction in predictions[date]:
                predicted_score = prediction['prediction']
                # If the actual scoreline matches this prediction and no actual score has been filled
                if util.identical_fixtures(predicted_score, actual_score) and prediction['actual'] == None:
                    # Update this prediction with its actual score
                    prediction['actual'] = actual_score
                    print("Adding actual score:", actual_score)
                    n_inserted += 1
                    break

        if n_inserted > 0:
            print(f'➡️  Updated {n_inserted} existing predictions with their actual results')

    def sort_predictions(self, data, predictions_json):
        # Sort by date keys...
        data['predictions'] = dict(sorted(predictions_json.items(), key=lambda x: x[0]))

    def insert_accuracy(self, data: dict):
        data['accuracy'] = self.accuracy

    def update_json_file(self, new_predictions, actual_scores):
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions_json = data['predictions']  # type: dict[str, list]
            
            # Update with new data...
            self.insert_new_predictions(new_predictions, predictions_json)
            self.insert_actual_scores(actual_scores, predictions_json)
            # Sort predictions by date...
            self.sort_predictions(data, predictions_json)
            # Update accuracy...
            self.insert_accuracy(data)

        # Overwrite file with new data...
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
    
    def print_accuracy(self):
        print(f'ℹ️ Predicting with accuracy: {round(self.accuracy["accuracy"]*100, 2)}%')
        print(f'ℹ️ Predicting correct results with accuracy: {round(self.accuracy["resultAccuracy"]*100, 2)}%')
        print(f'ℹ️ Net predictions: [{self.signed_float_str(self.accuracy["homeScoredAvgDiff"])}] - [{self.signed_float_str(self.accuracy["awayScoredAvgDiff"])}]')

    def update(self, fixtures: Fixtures, form: Form, upcoming: Upcoming, 
               home_advantages: HomeAdvantages):
        self.predictions = self.gen_score_predictions(form, upcoming, home_advantages)
        self.accuracy = self.measure_accuracy()
        actual_scores = self.get_actual_scores(fixtures)
        self.update_json_file(self.predictions.values(), actual_scores)
        self.print_accuracy()
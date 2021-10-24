from dataclasses import dataclass
from datetime import datetime
import json
import numpy as np
import pandas as pd

from pandas.core.frame import DataFrame
from utilities import Utilities

util = Utilities()
    

class Predictor:
    def __init__(self, form_diff_multiplier: int = 1.5, home_advantage_multiplier: int = 1.5):
        self.form_diff_multiplier = form_diff_multiplier
        self.home_advantage_multiplier = home_advantage_multiplier

    def outdated_prediction_already_made(self, date: str, new_prediction: str, 
                                         predictions: dict) -> bool:
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                predicted_score = prediction['prediction']
                actual_score = prediction['actual']
                if predicted_score is not None:
                    if util.identical_fixtures(predicted_score, new_prediction):
                        # If fixture match perfectly but predicted scoreline different (outdated)
                        if (predicted_score != new_prediction) and (actual_score is None):
                            already_made = True
                        break

        return already_made

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

    def adjust_prediction_by_current_form(self, form_rating: float, opp_form_rating: float, 
                                          at_home: bool, pred_scored: float = 0, 
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
        
        if at_home:
            xg_home = pred_scored
            xg_away = pred_conceded
            form_rating_home = form_rating
            form_rating_away = opp_form_rating
        else:
            xg_home = pred_conceded
            xg_away = pred_scored
            form_rating_home = opp_form_rating
            form_rating_away = form_rating
            
        detail = {'description': 'Adjusted by form',
                  'operation': operation,
                  'xGHome': round(xg_home, 4),
                  'xGAway': round(xg_away, 4),
                  'formRatingHome': round(form_rating_home, 4),
                  'formRatingAway': round(form_rating_away, 4)}

        return pred_scored, pred_conceded, detail

    def adjust_prediction_by_home_advantage(self, home_advantage: float, 
                                            opp_home_advantage: float,
                                            at_home: bool, pred_scored: float = 0, 
                                            pred_conceded: float = 0) -> tuple[float, float]:
        # Use the home advantge to adjust the pred scored and conceded
        # for a team in opposite directions by an equal amount
        if at_home:
            operation = f'{round(pred_conceded, 4)} *= 1 - ({round(home_advantage, 4)} * {self.home_advantage_multiplier} * 0.5)\n' \
                        f'{round(pred_scored, 4)} *= 1 + ({round(home_advantage, 4)} * {self.home_advantage_multiplier}  * 0.5)'
            # Decrease conceded (assuming team has a positive home advantage)
            pred_conceded *= 1 - (home_advantage * self.home_advantage_multiplier * 0.5)
            # Increase scored (assuming team has a positive home advantage)
            pred_scored *= 1 + (home_advantage * self.home_advantage_multiplier * 0.5)
            home_goals = pred_scored
            away_goals = pred_conceded
            advantage = home_advantage
        else:
            operation = f'{round(pred_scored, 4)} *= 1 - ({round(opp_home_advantage, 4)} * {self.home_advantage_multiplier} * 0.5)\n' \
                        f'{round(pred_conceded, 4)} *= 1 + ({round(home_advantage, 4)} * {self.home_advantage_multiplier} * 0.5) '
            # Decrease scored (assuming opposition team has a positive home advantage)
            pred_scored *= 1 - (opp_home_advantage * self.home_advantage_multiplier * 0.5)
            # Increase conceded (assuming opposition team has a positive home advantage)
            pred_conceded *= 1 + (opp_home_advantage * self.home_advantage_multiplier * 0.5)
            home_goals = pred_conceded
            away_goals = pred_scored
            advantage = opp_home_advantage

        detail = {'description': 'Adjusted by home advantage',
                  'operation': operation,
                  'xGHome': round(home_goals, 4), 
                  'xGAway': round(away_goals, 4), 
                  'homeAdvantage': round(advantage, 4)}
        
        return pred_scored, pred_conceded, detail

    def neutral_prev_matches(self, prev_matches: list[dict[str, str]]):
        neutral_prev_matches = []
        for match in prev_matches:
            neutral_match = {}
            # Rename to match json format
            for k, v in match.items():
                neutral_match[k[0].lower() + k[1:]] = v
            neutral_prev_matches.append(neutral_match)
        
        return neutral_prev_matches

    def starting_score(self, team_name: str, prev_matches: list[dict[str, str]], at_home: bool):
        if prev_matches:
            # Begin with average scored and conceded in previous meetings
            pred_scored, pred_conceded = self.avg_previous_result(team_name, prev_matches)
            description = 'Previous match average'
        else:
            pred_scored, pred_conceded = 1.0, 1.0
            description = 'Default'
        
        if at_home:
            home_goals = pred_scored
            away_goals = pred_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
            
        detail = {'description': description, 
                  'previousMatches': self.neutral_prev_matches(prev_matches),
                  'xGHome': round(home_goals, 4), 
                  'xGAway': round(away_goals, 4)}
        
        return pred_scored, pred_conceded, detail

    def detailed_score(self, pred_scored, pred_conceded, at_home):
        if at_home:
            home_goals = pred_scored
            away_goals = pred_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
        detailed_score = {'xGHome': round(home_goals, 4), 
                          'xGAway': round(away_goals, 4)}
        return detailed_score

    def calc_score_prediction(self, team_name: str, home_advantage: float, 
                              opp_home_advantage: float, at_home: bool, 
                              form_rating: float, opp_form_rating: float, 
                              prev_matches: list[dict[str, str]]) -> tuple[int, int]:
        details = {'initial': {}, 'adjustments': [], 'score': {}}
        
        pred_scored, pred_conceded, detail = self.starting_score(team_name, prev_matches, at_home)
        details['initial'] = detail

        # Modify based on difference in current form between two teams
        pred_scored, pred_conceded, detail = self.adjust_prediction_by_current_form(
            form_rating, opp_form_rating, at_home, pred_scored, pred_conceded)
        details['adjustments'].append(detail)
        
        # Decrese scores conceded if playing at home
        pred_scored, pred_conceded, detail = self.adjust_prediction_by_home_advantage(
            home_advantage, opp_home_advantage, at_home, pred_scored, pred_conceded)
        details['adjustments'].append(detail)
        
        # Get unrounded version of predicted score
        detail = self.detailed_score(pred_scored, pred_conceded, at_home, )
        details['score'] = detail

        return int(round(pred_scored)), int(round(pred_conceded)), details
    
    def prediction_details(self, team_name, opp_team_name, pred_scored, pred_conceded, at_home):
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)
        
        # Construct prediction string for display...
        if at_home:
            home_initials = team_name_initials
            away_initials = opp_team_name_initials
            prediction = {'xGHome': pred_scored, 'xGAway': pred_conceded}
        else:
            home_initials = opp_team_name_initials
            away_initials = team_name_initials
            prediction = {'xGHome': pred_conceded, 'xGAway': pred_scored}
        return home_initials, away_initials, prediction

    def gen_score_predictions(self, form, upcoming: DataFrame, home_advantages) -> dict:
        predictions = {}
        team_names = form.df.index.values.tolist()

        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if upcoming is not None:
                opp_team_name = upcoming['NextTeam'].loc[team_name]
                form_rating = form.get_current_form_rating(team_name)  # type: float
                opp_form_rating = form.get_current_form_rating(opp_team_name)  # type: float
                home_advantage = home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]  # type: float
                opp_home_advantage = home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]  # type: float
                at_home = upcoming['AtHome'].loc[team_name]  # type: bool
                prev_matches = upcoming['PreviousMatches'].loc[team_name]  # type: list[tuple]
                                
                pred_scored, pred_conceded, details = self.calc_score_prediction(
                    team_name, home_advantage, opp_home_advantage, at_home, 
                    form_rating, opp_form_rating, prev_matches)

                home_initials, away_initials, pred = self.prediction_details(
                    team_name, opp_team_name, pred_scored, pred_conceded, at_home)
            
                date = upcoming['Date'].loc[team_name].to_pydatetime()
                
                prediction = {'Date': date, 
                              'HomeInitials': home_initials, 
                              'AwayInitials': away_initials, 
                              'Prediction': pred, 
                              'Details': details}

            predictions[team_name] = prediction

        return predictions
    
    
class Predictions:
    def __init__(self, current_season):
        self.predictor = Predictor()
        self.accuracy = None  # type: dict[str, float]
        self.prediction_file = f'data/predictions_{current_season}.json'
    
    @dataclass
    class PredictionsCount:
        total: int
        correct: int
        result_correct: int
        n_pred_home: int
        n_pred_away: int
        n_act_home: int
        n_act_away: int

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

    def print_accuracy(self):
        print(f'ℹ️ Predicting with accuracy: {round(self.accuracy["accuracy"]*100, 2)}%')
        print(f'ℹ️ Predicting correct results with accuracy: {round(self.accuracy["resultAccuracy"]*100, 2)}%')
        print(f'ℹ️ Net predictions: [{self.signed_float_str(self.accuracy["homeScoredAvgDiff"])}] - [{self.signed_float_str(self.accuracy["awayScoredAvgDiff"])}]')
            
    def signed_float_str(self, value: float) -> str:
        value = round(value, 2)
        if value >= 0:
            return f'+{value}'
        return str(value)
    
    def predictions_count(self, predictions) -> tuple[int, int, int, int, int, int, int]:
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
                
                if predicted_score is not None and actual_score is not None:
                    total += 1
                    if (predicted_score['xGHome'] == actual_score['homeGoals'] and 
                        predicted_score['xGAway'] == actual_score['awayGoals']):
                        correct += 1

                    # Prediction and actual BOTH a draw or home win or away win
                    if util.identical_result(predicted_score['xGHome'], predicted_score['xGAway'], 
                                             actual_score['homeGoals'], actual_score['awayGoals']):
                        result_correct += 1

                    n_pred_home += predicted_score['xGHome']
                    n_pred_away += predicted_score['xGAway']
                    n_act_home += actual_score['homeGoals']
                    n_act_away += actual_score['awayGoals']

        return self.PredictionsCount(total, correct, result_correct, n_pred_home, 
                                     n_pred_away, n_act_home, n_act_away)
    
    def measure_accuracy(self, predictions):
        """Sets the class accuracy variables:
            - accuracy: the proportion of perfectly predicted predicitons
            - result_accuracy: the proportion of predictions with a correct result 
                (win, draw, lose)
            - home_acored_avg_diff: the difference between the predicted average 
                home goals scored vs the actual average home goals scored
            - away_acored_avg_diff: the difference between the predicted average 
                away goals scored vs the actual average away goals scored
        """
        counts = self.predictions_count(predictions)

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
    
    def max_prediction_id(self, predictions: dict) -> int:
        return max([max([pred['id'] for pred in preds]) for preds in predictions.values()])
    
    def exact_prediction_already_made(self, date: str, home_initials, away_initials, new_prediction: str, 
                                      predictions: dict) -> bool:
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                # Check if prediciton strings match perfectly
                # i.e. identical fixture and same score predicted
                if (prediction['homeInitials'] == home_initials) and (prediction['awayInitials'] == away_initials) and (prediction['prediction'] == new_prediction) and (prediction['actual'] is None):
                    already_made = True
                    break

        return already_made
    
    def update_existing_prediction(self, date: str, home_initials: str, 
                                   away_initials: str, new_prediction: dict, 
                                   details: list[str], predictions: dict[str, list]) -> bool:
        # Update existing prediction object with new score prediction...
        for prediction in predictions[date]:
            predicted_score = prediction['prediction']
            if (prediction['homeInitials'] == home_initials and 
                prediction['awayInitials'] == away_initials):
                # If fixture match perfectly predicted scoreline different (outdated)
                if predicted_score != new_prediction and prediction['actual'] is None:
                    print("Updating existing prediction:", 
                          home_initials, prediction['prediction']['xGHome'], '-', prediction['prediction']['xGAway'], away_initials, 
                          '-->', home_initials, predicted_score['xGHome'], '-',  predicted_score['xGAway'], away_initials,)
                    prediction['prediction'] = new_prediction
                    prediction['details'] = details
                return True
        return False

    def insert_new_prediction(self, date: str, time: str, prediction_id: int,
                              home_initials: str, away_initials: str, 
                              new_prediction: dict, details: list[str], 
                              predictions: dict[str, list]) -> bool:
        """Attempts to inesrt a prediction into the predictions dictionary.
           Returns True if inserted a NEW predcition
           Return False if a prediction for this fixture already exists"""
        # Init with empty list if missing...
        if date not in predictions.keys():
            predictions[date] = []

        # Try to update the existing prediciton if available...
        if self.update_existing_prediction(date, home_initials, away_initials, 
                                           new_prediction, details, predictions):
            id_used = False
        else:
            # Otherwise add new...
            print("Adding new prediction:", home_initials, new_prediction['xGHome'], '-', new_prediction['xGAway'], away_initials)
            predictions[date].append({'id': prediction_id, 
                                      'time': time, 
                                      'homeInitials': home_initials,
                                      'awayInitials': away_initials,
                                      'prediction': new_prediction,
                                      'actual': None, 
                                      'details': details})
            id_used = True
        
        return id_used

    def insert_new_predictions(self, new_predictions, predictions_json: dict):
        start_id = self.max_prediction_id(predictions_json) + 1
        
        n_inserted = 0
        for new_prediction in new_predictions.values():
            date = datetime.strftime(new_prediction['Date'], '%Y-%m-%d')
            if not self.exact_prediction_already_made(date, 
                                                      new_prediction['HomeInitials'], 
                                                      new_prediction['AwayInitials'], 
                                                      new_prediction['Prediction'], 
                                                      predictions_json):
                time = datetime.strftime(new_prediction['Date'], '%H:%M')
                if self.insert_new_prediction(date, time, start_id+n_inserted, 
                                              new_prediction['HomeInitials'], 
                                              new_prediction['AwayInitials'], 
                                              new_prediction['Prediction'], 
                                              new_prediction['Details'], 
                                              predictions_json):
                    n_inserted += 1

        if n_inserted > 0:
            print(f'➡️  Added {n_inserted} new predictions')

    def insert_actual_scores(self, actual_scores: set[tuple[str, str]], predictions: dict):
        n_inserted = 0
        for dt, home_initials, away_initials, home_goals, away_goals in actual_scores:
            date = np.datetime_as_string(dt.asm8, unit='D')

            for prediction in predictions[date]:
                # If the actual scoreline matches this prediction and no actual score has been filled
                if (home_initials == prediction['homeInitials'] and 
                    away_initials == prediction['awayInitials'] and 
                    prediction['actual'] == None):
                    # Update this prediction with its actual score
                    prediction['actual'] = {'homeGoals': home_goals, 
                                            'awayGoals': away_goals}
                    print("Adding actual score:", home_initials, home_goals, '-', away_goals, away_initials)
                    n_inserted += 1
                    break

        if n_inserted > 0:
            print(f'➡️  Updated {n_inserted} existing predictions with their actual results')

    def sort_predictions(self, data, predictions_json):
        for date in predictions_json:
            predictions_json[date] = sorted(predictions_json[date], key=lambda x: x['time'])
        # Sort by date keys...
        data['predictions'] = dict(sorted(predictions_json.items(), key=lambda x: x[0]))
        
    def update_json_file(self, new_predictions: dict, actual_scores: set[tuple[datetime, str, str, int, int]]):
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions_json = data['predictions']  # type: dict[str, list]
            
            # Update with new data...
            self.insert_new_predictions(new_predictions, predictions_json)
            self.insert_actual_scores(actual_scores, predictions_json)
            # Sort predictions by date...
            self.sort_predictions(data, predictions_json)
            # Update accuracy...
            self.accuracy = data['accuracy'] = self.measure_accuracy(predictions_json)

        # Overwrite file with new data...
        with open(self.prediction_file, 'w') as f:
            json.dump(data, f)
    
    def prediction_details(self, team_name, opp_team_name, pred_scored, pred_conceded, at_home):
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)
        
        # Construct prediction string for display...
        if at_home:
            home_initials = team_name_initials
            away_initials = opp_team_name_initials
            prediction = {'xGHome': pred_scored, 'xGAway': pred_conceded}
        else:
            home_initials = opp_team_name_initials
            away_initials = team_name_initials
            prediction = {'xGHome': pred_conceded, 'xGAway': pred_scored}
        return home_initials, away_initials, prediction
        
    def get_actual_scores(self, fixtures: DataFrame) -> set[tuple[str, str]]:
        # To contain a tuple for all actual scores so far this season
        actual_scores = set()  
        
        for matchday_no in range(1, 39):
            matchday = fixtures.df[matchday_no]

            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):
                for team_name, row in fixtures.df[matchday_no].iterrows():
                    if row['Status'] == 'FINISHED':
                        date = np.datetime_as_string(row['Date'].asm8, unit='D')
                        date = row['Date']
                        team_name_initials = util.convert_team_name_or_initials(team_name)
                        opp_team_name_initials = util.convert_team_name_or_initials(row['Team'])
                        home_goals, away_goals = util.extract_int_score(row['Score'])
                        if row['AtHome']:
                            home_initials = team_name_initials
                            away_initials = opp_team_name_initials
                        else:
                            home_initials = opp_team_name_initials
                            away_initials = team_name_initials
                        actual_scores.add((date, home_initials, away_initials, home_goals, away_goals))

        return actual_scores
    
    def update(self, fixtures, form, upcoming, home_advantages):
        d = self.predictor.gen_score_predictions(form, upcoming, home_advantages)
        actual_scores = self.get_actual_scores(fixtures)
        self.update_json_file(d, actual_scores)
        self.print_accuracy()
        
        upcoming_predictions = pd.DataFrame.from_dict(d, orient='index')[['Prediction', 'Details']]
        upcoming_predictions.columns = ['Prediction', 'PredictionDetails']
        
        return upcoming_predictions
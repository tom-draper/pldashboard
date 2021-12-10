from dataclasses import dataclass
from datetime import datetime
import json
import numpy as np
import pandas as pd

from pandas.core.frame import DataFrame
from utilities import Utilities

util = Utilities()


class Predictor:
    def __init__(self, form_diff_multiplier: int = 0.5, home_advantage_multiplier: int = 1.5):
        self.form_diff_multiplier = form_diff_multiplier
        self.home_advantage_multiplier = home_advantage_multiplier

    def _outdated_prediction_already_made(self, date: str, new_prediction: str,
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

    def _avg_previous_result(self, team_name: str,
                             prev_matches: list[dict[str, str]]) -> tuple[float, float]:
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

    def _adjust_prediction_by_current_form(self, form_rating: float, opp_form_rating: float,
                                           at_home: bool, pred_scored: float = 0, pred_conceded: float = 0) -> tuple[float, float]:
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = form_rating - opp_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            operation = f'{round(pred_scored, 4)} += {round(pred_scored, 4)} * {round((form_diff/100), 4)} * {self.form_diff_multiplier}'
            increased_separation = pred_scored * \
                (form_diff/100) * self.form_diff_multiplier
            pred_scored += increased_separation/2
            pred_conceded -= increased_separation/2
        else:
            # Opposition team in better form -> increase predicted coneded
            operation = f'{round(pred_conceded, 4)} += {round(pred_conceded, 4)} * {round((form_diff/100), 4)} * {self.form_diff_multiplier}'
            increased_separation = pred_conceded * \
                abs(form_diff/100) * self.form_diff_multiplier
            pred_conceded += increased_separation/2
            pred_scored -= increased_separation/2

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

        detail = {'description': 'Adjusted by form (5 games)',
                  'operation': operation,
                  'homeGoals': round(xg_home, 4),
                  'awayGoals': round(xg_away, 4),
                  'formRatingHome': round(form_rating_home, 4),
                  'formRatingAway': round(form_rating_away, 4)}

        return pred_scored, pred_conceded, detail

    def _adjust_by_form(self, form_rating: float, opp_form_rating: float,
                        at_home: bool, n_games: int, pred_scored: float = 0,
                        pred_conceded: float = 0) -> tuple[float, float]:
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = form_rating - opp_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            operation = f'{round(pred_scored, 4)} += {round(pred_scored, 4)} * {round((form_diff/100), 4)} * {self.form_diff_multiplier}'
            pred_scored += pred_scored * \
                (form_diff/100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            operation = f'{round(pred_conceded, 4)} += {round(pred_conceded, 4)} * {round((form_diff/100), 4)} * {self.form_diff_multiplier}'
            pred_conceded += pred_conceded * \
                abs(form_diff/100) * self.form_diff_multiplier

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

        detail = {'description': f'Adjusted by form ({n_games} games)',
                  'operation': operation,
                  'homeGoals': round(xg_home, 4),
                  'awayGoals': round(xg_away, 4),
                  'formRatingHome': round(form_rating_home, 4),
                  'formRatingAway': round(form_rating_away, 4)}

        return pred_scored, pred_conceded, detail

    def _adjust_by_home_advantage(self, home_advantage: float,
                                  opp_home_advantage: float, at_home: bool, pred_scored: float = 0,
                                  pred_conceded: float = 0) -> tuple[float, float]:
        # Use the home advantge to adjust the pred scored and conceded
        # for a team in opposite directions by an equal amount
        if at_home:
            operation = f'{round(pred_conceded, 4)} *= 1 - ({round(home_advantage, 4)} * {self.home_advantage_multiplier} * 0.5)\n' \
                        f'{round(pred_scored, 4)} *= 1 + ({round(home_advantage, 4)} * {self.home_advantage_multiplier}  * 0.5)'
            # Decrease conceded (assuming team has a positive home advantage)
            pred_conceded *= 1 - \
                (home_advantage * self.home_advantage_multiplier * 0.5)
            # Increase scored (assuming team has a positive home advantage)
            pred_scored *= 1 + (home_advantage *
                                self.home_advantage_multiplier * 0.5)
            home_goals = pred_scored
            away_goals = pred_conceded
            advantage = home_advantage
        else:
            operation = f'{round(pred_scored, 4)} *= 1 - ({round(opp_home_advantage, 4)} * {self.home_advantage_multiplier} * 0.5)\n' \
                        f'{round(pred_conceded, 4)} *= 1 + ({round(home_advantage, 4)} * {self.home_advantage_multiplier} * 0.5) '
            # Decrease scored (assuming opposition team has a positive home advantage)
            pred_scored *= 1 - (opp_home_advantage *
                                self.home_advantage_multiplier * 0.5)
            # Increase conceded (assuming opposition team has a positive home advantage)
            pred_conceded *= 1 + (opp_home_advantage *
                                  self.home_advantage_multiplier * 0.5)
            home_goals = pred_conceded
            away_goals = pred_scored
            advantage = opp_home_advantage

        detail = {'description': 'Adjusted by home advantage',
                  'operation': operation,
                  'homeGoals': round(home_goals, 4),
                  'awayGoals': round(away_goals, 4),
                  'homeAdvantage': round(advantage, 4)}

        return pred_scored, pred_conceded, detail

    def _neutral_prev_matches(self, prev_matches: list[dict[str, str]]):
        neutral_prev_matches = []
        for match in prev_matches:
            neutral_match = {}
            # Rename to match json format
            for k, v in match.items():
                neutral_match[k[0].lower() + k[1:]] = v
            neutral_match.pop('result')  # Remove result key
            neutral_prev_matches.append(neutral_match)

        return neutral_prev_matches

    def _starting_score(self, avg_result: tuple[float, float],
                        opp_avg_result: tuple[float, float], at_home: bool):
        # Midway between team's avg scored and opposition's avg conceded
        pred_scored = (avg_result[0] + opp_avg_result[1]) / 2
        pred_conceded = (avg_result[1] + opp_avg_result[0]) / 2

        if at_home:
            home_goals = pred_scored
            away_goals = pred_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored

        detail = {'description': 'Combined average season result',
                  'homeGoals': round(home_goals, 4),
                  'awayGoals': round(away_goals, 4)}

        return pred_scored, pred_conceded, detail

    def _adjust_by_prev_matches(self, team_name: str, pred_scored: float, pred_conceded: float,
                                prev_matches: list[dict[str, str]], at_home: bool, prev_meeting_weight: float = 0.5):
        prev_meeting_scored = 0
        prev_meeting_conceded = 0
        if prev_matches:
            # Modify with average scored and conceded in previous meetings
            prev_meeting_scored, prev_meeting_conceded = self._avg_previous_result(
                team_name, prev_matches)

            pred_scored = (prev_meeting_scored * prev_meeting_weight) + \
                          (pred_scored * (1 - prev_meeting_weight))
            pred_conceded = (prev_meeting_conceded * prev_meeting_weight) + \
                            (pred_conceded * (1 - prev_meeting_weight))

            description = 'Adjusted by previous meetings'
        else:
            description = 'No previous meetings'

        if at_home:
            home_goals = pred_scored
            away_goals = pred_conceded
            prev_meeting_home_goals = prev_meeting_scored
            prev_meeting_away_goals = prev_meeting_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
            prev_meeting_home_goals = prev_meeting_conceded
            prev_meeting_away_goals = prev_meeting_scored

        detail = {'description': description,
                  'previousMatches': self._neutral_prev_matches(prev_matches),
                  'prevMatchesHomeGoals': round(prev_meeting_home_goals, 4),
                  'prevMatchesAwayGoals': round(prev_meeting_away_goals, 4),
                  'homeGoals': round(home_goals, 4),
                  'awayGoals': round(away_goals, 4)}

        return pred_scored, pred_conceded, detail

    def _detailed_score(self, pred_scored: float, pred_conceded: float, at_home: bool):
        if at_home:
            home_goals = pred_scored
            away_goals = pred_conceded
        else:
            home_goals = pred_conceded
            away_goals = pred_scored
        detailed_score = {'homeGoals': round(home_goals, 4),
                          'awayGoals': round(away_goals, 4)}
        return detailed_score

    def _calc_score_prediction(self, team_name: str,
                               avg_result: tuple[float, float], opp_avg_result: tuple[float, float],
                               home_advantage: float, opp_home_advantage: float, at_home: bool,
                               form_rating: float, long_term_form_rating: float,
                               opp_form_rating: float, opp_long_term_form_rating: float,
                               prev_matches: list[dict[str, str]]) -> tuple[int, int]:
        details = {'initial': {}, 'adjustments': [], 'score': {}}

        pred_scored, pred_conceded, detail = self._starting_score(
            avg_result, opp_avg_result, at_home)
        details['initial'] = detail

        pred_scored, pred_conceded, detail = self._adjust_by_prev_matches(team_name,
                                                                          pred_scored, pred_conceded, prev_matches, at_home)
        details['adjustments'].append(detail)

        # Modify based on difference in current form (last 5 games) between two teams
        pred_scored, pred_conceded, detail = self._adjust_by_form(
            form_rating, opp_form_rating, at_home, 5, pred_scored, pred_conceded)
        details['adjustments'].append(detail)

        # Modify based on difference in longer-term (10 games) form between two teams
        pred_scored, pred_conceded, detail = self._adjust_by_form(
            long_term_form_rating, opp_long_term_form_rating, at_home, 10, pred_scored, pred_conceded)
        details['adjustments'].append(detail)

        # Decrese scores conceded if playing at home
        pred_scored, pred_conceded, detail = self._adjust_by_home_advantage(
            home_advantage, opp_home_advantage, at_home, pred_scored, pred_conceded)
        details['adjustments'].append(detail)

        # Get unrounded version of predicted score
        detail = self._detailed_score(pred_scored, pred_conceded, at_home, )
        details['score'] = detail

        return int(round(pred_scored)), int(round(pred_conceded)), details

    def _prediction_details(self, team_name, opp_team_name, pred_scored, pred_conceded, at_home):
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(
            opp_team_name)

        # Construct prediction string for display...
        if at_home:
            home_initials = team_name_initials
            away_initials = opp_team_name_initials
            prediction = {'homeGoals': pred_scored, 'awayGoals': pred_conceded}
        else:
            home_initials = opp_team_name_initials
            away_initials = team_name_initials
            prediction = {'homeGoals': pred_conceded, 'awayGoals': pred_scored}

        return home_initials, away_initials, prediction

    def gen_score_predictions(self, fixtures, form, upcoming, home_advantages) -> dict:
        predictions = {}
        team_names = form.df.index.values.tolist()

        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if upcoming is not None:
                form_rating = form.get_current_form_rating(team_name)
                long_term_form_rating = form.get_long_term_form_rating(
                    team_name)
                opp_team_name = upcoming.at[team_name, 'NextTeam']
                opp_form_rating = form.get_current_form_rating(opp_team_name)
                opp_long_term_form_rating = form.get_long_term_form_rating(
                    opp_team_name)
                avg_result = fixtures.get_avg_result(team_name)
                opp_avg_result = fixtures.get_avg_result(opp_team_name)
                home_advantage = home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]
                opp_home_advantage = home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]
                at_home = upcoming.at[team_name, 'AtHome']
                prev_matches = upcoming.at[team_name, 'PreviousMatches']

                pred_scored, pred_conceded, details = self._calc_score_prediction(
                    team_name, avg_result, opp_avg_result, home_advantage,
                    opp_home_advantage, at_home, form_rating, long_term_form_rating,
                    opp_form_rating, opp_long_term_form_rating, prev_matches)

                home_initials, away_initials, pred = self._prediction_details(
                    team_name, opp_team_name, pred_scored, pred_conceded, at_home)

                date = upcoming.at[team_name, 'Date'].to_pydatetime()

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

    def _print_accuracy(self):
        print(f' ℹ️ Predicting with accuracy: {round(self.accuracy["accuracy"]*100, 2)}%')
        print(f' ℹ️ Predicting correct results with accuracy: {round(self.accuracy["resultAccuracy"]*100, 2)}%')
        print(f' ℹ️ Net predictions: [{self._signed_float_str(self.accuracy["homeScoredAvgDiff"])}] - [{self._signed_float_str(self.accuracy["awayScoredAvgDiff"])}]')

    def _signed_float_str(self, value: float) -> str:
        value = round(value, 2)
        if value >= 0:
            return f'+{value}'
        return str(value)

    def _predictions_count(self, predictions) -> tuple[int, int, int, int, int, int, int]:
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
                    if (predicted_score['homeGoals'] == actual_score['homeGoals'] and
                            predicted_score['awayGoals'] == actual_score['awayGoals']):
                        correct += 1

                    # Prediction and actual BOTH a draw or home win or away win
                    if util.identical_result(predicted_score['homeGoals'], predicted_score['awayGoals'],
                                             actual_score['homeGoals'], actual_score['awayGoals']):
                        result_correct += 1

                    n_pred_home += predicted_score['homeGoals']
                    n_pred_away += predicted_score['awayGoals']
                    n_act_home += actual_score['homeGoals']
                    n_act_away += actual_score['awayGoals']

        return self.PredictionsCount(total, correct, result_correct, n_pred_home,
                                     n_pred_away, n_act_home, n_act_away)

    def _measure_accuracy(self, predictions):
        """Sets the class accuracy variables:
            - accuracy: the proportion of perfectly predicted predicitons
            - result_accuracy: the proportion of predictions with a correct result 
                (win, draw, lose)
            - home_acored_avg_diff: the difference between the predicted average 
                home goals scored vs the actual average home goals scored
            - away_acored_avg_diff: the difference between the predicted average 
                away goals scored vs the actual average away goals scored
        """
        counts = self._predictions_count(predictions)

        accuracy = {}
        if counts.total != 0:
            accuracy['accuracy'] = counts.correct / counts.total
            accuracy['resultAccuracy'] = counts.result_correct / counts.total
            # Aim for both to be zero
            # Positive -> predicting too many goals
            # Negative -> predicting too few goals
            accuracy['homeScoredAvgDiff'] = (
                counts.n_pred_home - counts.n_act_home) / counts.total
            accuracy['awayScoredAvgDiff'] = (
                counts.n_pred_away - counts.n_act_away) / counts.total
        return accuracy

    def _max_prediction_id(self, predictions: dict) -> int:
        return max([max([pred['id'] for pred in preds]) for preds in predictions.values()])

    def _exact_prediction_already_made(self, date: str, home_initials: str, away_initials: str,
                                       new_prediction: str, predictions: dict) -> bool:
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                # Check if prediciton strings match perfectly
                # i.e. identical fixture and same score predicted
                if (prediction['homeInitials'] == home_initials) and \
                        (prediction['awayInitials'] == away_initials) and \
                        (prediction['prediction'] == new_prediction) and \
                        (prediction['actual'] is None):
                    already_made = True
                    break
        return already_made
    
    def _display_prediction_change(self, home_initials, away_initials, old_prediction, new_prediction):
        print("Updating existing prediction:", 
            home_initials, old_prediction[0], '-', 
            old_prediction[1], away_initials, '-->', 
            home_initials, new_prediction[0], '-',  
            new_prediction[1], away_initials)

    def _update_existing_prediction(self, date: str, home_initials: str,
                                    away_initials: str, new_prediction: dict, details: list[str],
                                    predictions: dict[str, list]) -> bool:
        updated = False
        new_detailed_pred_score = (details['score']['homeGoals'], details['score']['awayGoals'])
        
        # Update existing prediction object with new score prediction...
        for prediction in predictions[date]:
            detailed_pred_score = (prediction['details']['score']['homeGoals'], prediction['details']['score']['awayGoals'])
            
            # If fixture match perfectly but predicted detailed scoreline is different -> outdated
            if (prediction['homeInitials'] == home_initials and prediction['awayInitials'] == away_initials):
                if detailed_pred_score != new_detailed_pred_score and prediction['actual'] is None:
                    self._display_prediction_change(home_initials, away_initials, detailed_pred_score, new_detailed_pred_score)
                    prediction['prediction'] = new_prediction
                    prediction['details'] = details
                updated = True
                break
            
        return updated

    def _insert_new_prediction(self, date: str, time: str, prediction_id: int,
                               home_initials: str, away_initials: str, new_prediction: dict, details: list[str],
                               predictions: dict[str, list]) -> bool:
        """Attempts to inesrt a prediction into the predictions dictionary.
           Returns True if inserted a NEW predcition
           Return False if a prediction for this fixture already exists"""
        # Init with empty list if missing...
        if date not in predictions.keys():
            predictions[date] = []

        # Try to update the existing prediciton if available...
        if self._update_existing_prediction(date, home_initials, away_initials,
                                            new_prediction, details, predictions):
            id_used = False
        else:
            # Otherwise add new...
            print("Adding new prediction:", home_initials,
                  new_prediction['homeGoals'], '-', new_prediction['awayGoals'], away_initials)
            predictions[date].append({'id': prediction_id,
                                      'time': time,
                                      'homeInitials': home_initials,
                                      'awayInitials': away_initials,
                                      'prediction': new_prediction,
                                      'actual': None,
                                      'details': details})
            id_used = True

        return id_used

    def _insert_new_predictions(self, new_predictions, predictions_json: dict):
        start_id = self._max_prediction_id(predictions_json) + 1

        n_inserted = 0
        for new_prediction in new_predictions.values():
            date = datetime.strftime(new_prediction['Date'], '%Y-%m-%d')
            if not self._exact_prediction_already_made(date,
                                                       new_prediction['HomeInitials'],
                                                       new_prediction['AwayInitials'],
                                                       new_prediction['Prediction'],
                                                       predictions_json):
                time = datetime.strftime(new_prediction['Date'], '%H:%M')
                if self._insert_new_prediction(date, time, start_id+n_inserted,
                                               new_prediction['HomeInitials'],
                                               new_prediction['AwayInitials'],
                                               new_prediction['Prediction'],
                                               new_prediction['Details'],
                                               predictions_json):
                    n_inserted += 1

        if n_inserted > 0:
            print(f'➡️  Added {n_inserted} new predictions')

    def _insert_actual_scores(self, actual_scores: set[tuple[str, str]], predictions: dict):
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

    def _sort_predictions(self, data, predictions_json):
        for date in predictions_json:
            predictions_json[date] = sorted(
                predictions_json[date], key=lambda x: x['time'])
        # Sort by date keys...
        data['predictions'] = dict(
            sorted(predictions_json.items(), key=lambda x: x[0]))

    def _update_json_file(self, new_predictions: dict, actual_scores: set[tuple[datetime, str, str, int, int]]):
        with open(self.prediction_file) as json_file:
            data = json.load(json_file)
            predictions_json = data['predictions']  # type: dict[str, list]

            # Update with new data...
            self._insert_new_predictions(new_predictions, predictions_json)
            self._insert_actual_scores(actual_scores, predictions_json)
            # Sort predictions by date...
            self._sort_predictions(data, predictions_json)
            # Update accuracy...
            self.accuracy = data['accuracy'] = self._measure_accuracy(predictions_json)

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
            prediction = {'homeGoals': pred_scored, 'awayGoals': pred_conceded}
        else:
            home_initials = opp_team_name_initials
            away_initials = team_name_initials
            prediction = {'homeGoals': pred_conceded, 'awayGoals': pred_scored}
        return home_initials, away_initials, prediction

    def _get_actual_scores(self, fixtures: DataFrame) -> set[tuple[str, str]]:
        # To contain a tuple for all actual scores so far this season
        actual_scores = set()

        for matchday_no in range(1, 39):
            matchday = fixtures.df[matchday_no]

            # If whole column is SCHEDULED, skip
            if not all(matchday['Status'] == 'SCHEDULED'):
                for team_name, row in fixtures.df[matchday_no].iterrows():
                    if row['Status'] == 'FINISHED':
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
        d = self.predictor.gen_score_predictions(
            fixtures, form, upcoming, home_advantages)
        actual_scores = self._get_actual_scores(fixtures)
        self._update_json_file(d, actual_scores)
        self._print_accuracy()

        upcoming_predictions = pd.DataFrame.from_dict(
            d, orient='index')[['Prediction', 'Details']]
        upcoming_predictions.columns = ['Prediction', 'PredictionDetails']

        return upcoming_predictions

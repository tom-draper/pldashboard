from dataclasses import dataclass
from datetime import datetime
from typing import Union

import pandas as pd
from pandas.core.frame import DataFrame
from data import HomeAdvantages

from database import Database
from utilities import Utilities
from data import Fixtures, Form, Upcoming, HomeAdvantages

util = Utilities()


class Predictor:
    def __init__(self, form_diff_multiplier: int = 0.5, home_advantage_multiplier: int = 1):
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
            pred_scored: float = 0, pred_conceded: float = 0) -> tuple[float, float]:
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = form_rating - opp_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            pred_scored += pred_scored * (form_diff/100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            pred_conceded += pred_conceded * abs(form_diff/100) * self.form_diff_multiplier

        return pred_scored, pred_conceded

    def _adjust_by_home_advantage(self, home_advantage: float,
            opp_home_advantage: float, at_home: bool, pred_scored: float = 0,
            pred_conceded: float = 0) -> tuple[float, float]:
        # Use the home advantge to adjust the pred scored and conceded
        # for a team in opposite directions by an equal amount
        if at_home:
            # Decrease conceded (assuming team has a positive home advantage)
            pred_conceded *= 1 - (home_advantage * self.home_advantage_multiplier * 0.5)
            # Increase scored (assuming team has a positive home advantage)
            pred_scored *= 1 + (home_advantage * self.home_advantage_multiplier * 0.5)
        else:
            # Decrease scored (assuming opposition team has a positive home advantage)
            pred_scored *= 1 - (opp_home_advantage * self.home_advantage_multiplier * 0.5)
            # Increase conceded (assuming opposition team has a positive home advantage)
            pred_conceded *= 1 + (opp_home_advantage * self.home_advantage_multiplier * 0.5)

        return pred_scored, pred_conceded

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
                        opp_avg_result: tuple[float, float]):
        # Midway between team's avg scored and opposition's avg conceded
        pred_scored = (avg_result[0] + opp_avg_result[1]) / 2
        pred_conceded = (avg_result[1] + opp_avg_result[0]) / 2

        return pred_scored, pred_conceded

    def _adjust_by_prev_matches(self, team_name: str, pred_scored: float, 
            pred_conceded: float, prev_matches: list[dict[str, str]], 
            prev_meeting_weight: float = 0.5) -> tuple[float, float, dict[str, str]]:
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

        return pred_scored, pred_conceded

    def _calc_score_prediction(self, team_name: str, avg_result: tuple[float, float], 
            opp_avg_result: tuple[float, float], home_advantage: float, 
            opp_home_advantage: float, at_home: bool, form_rating: float, 
            long_term_form_rating: float, opp_form_rating: float, 
            opp_long_term_form_rating: float, prev_matches: list[dict[str, str]]
            ) -> tuple[float, float]:

        pred_scored, pred_conceded = self._starting_score(avg_result, opp_avg_result)

        pred_scored, pred_conceded = self._adjust_by_prev_matches(team_name, pred_scored, pred_conceded, prev_matches)

        # Modify based on difference in current form (last 5 games) between two teams
        pred_scored, pred_conceded = self._adjust_by_form(form_rating, opp_form_rating, pred_scored, pred_conceded)

        # Modify based on difference in longer-term (10 games) form between two teams
        pred_scored, pred_conceded = self._adjust_by_form(long_term_form_rating, opp_long_term_form_rating, pred_scored, pred_conceded)

        # Decrese scores conceded if playing at home
        pred_scored, pred_conceded = self._adjust_by_home_advantage(home_advantage, opp_home_advantage, at_home, pred_scored, pred_conceded)

        return pred_scored, pred_conceded

    def _prediction_details(self, team_name: str, opp_team_name: str, pred_scored: float, 
            pred_conceded: float, at_home: bool) -> tuple[str, str, dict[str, int], dict[str, float]]:
        team_name_initials = util.convert_team_name_or_initials(team_name)
        opp_team_name_initials = util.convert_team_name_or_initials(opp_team_name)

        # Construct prediction string for display...
        if at_home:
            home = team_name_initials
            away = opp_team_name_initials
            prediction = {'homeGoals': int(round(pred_scored)), 'awayGoals':  int(round(pred_conceded))}
            detailed_prediction = {'homeGoals': round(pred_scored, 4), 'awayGoals': round(pred_conceded, 4)}
        else:
            home = opp_team_name_initials
            away = team_name_initials
            prediction = {'homeGoals':  int(round(pred_conceded)), 'awayGoals':  int(round(pred_scored))}
            detailed_prediction = {'homeGoals': round(pred_conceded, 4), 'awayGoals': round(pred_scored, 4)}

        return home, away, prediction, detailed_prediction

    def gen_score_predictions(self, fixtures: Fixtures, form: Form, upcoming: Upcoming, 
            home_advantages: HomeAdvantages) -> dict[dict[str, Union[datetime, str, float]]]:
        predictions = {}  # type: dict[dict[str, Union[datetime, str, float]]]
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

                pred_scored, pred_conceded = self._calc_score_prediction(
                    team_name, avg_result, opp_avg_result, home_advantage,
                    opp_home_advantage, at_home, form_rating, long_term_form_rating,
                    opp_form_rating, opp_long_term_form_rating, prev_matches)

                home_initials, away_initials, pred, detailed_pred = self._prediction_details(
                    team_name, opp_team_name, pred_scored, pred_conceded, at_home)

                date = upcoming.at[team_name, 'Date'].to_pydatetime()

                prediction = {'date': date,
                              'homeInitials': home_initials,
                              'awayInitials': away_initials,
                              'prediction': pred,
                              'detailedPrediction': detailed_pred}

            predictions[team_name] = prediction

        return predictions


class Predictions:
    def __init__(self, current_season: int):
        self.predictor = Predictor()
        self.database = Database()
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
        return self.database.get_predictions()

    def get_accuracy(self) -> tuple[float, float]:
        accuracy = round(self.accuracy['scoreAccuracy']*100, 2)
        result_accuracy = round(self.accuracy['resultAccuracy']*100, 2)  # As percentage
        return accuracy, result_accuracy

    def _print_accuracy(self):
        print(f' ℹ️ Predicting with accuracy: {round(self.accuracy["scoreAccuracy"]*100, 2)}%')
        print(f' ℹ️ Predicting correct results with accuracy: {round(self.accuracy["resultAccuracy"]*100, 2)}%')
        print(f' ℹ️ Net predictions: [{self._signed_float_str(self.accuracy["homeGoalsAvgDiff"])}] - [{self._signed_float_str(self.accuracy["awayGoalsAvgDiff"])}]')

    def _signed_float_str(self, value: float) -> str:
        value = round(value, 2)
        if value >= 0:
            return f'+{value}'
        return str(value)

    def _get_actual_scores(self, fixtures: Fixtures) -> set[tuple[datetime, str, 
                                                                  str, float, float]]:
        # To contain a tuple for all actual scores so far this season
        actual_scores = set()

        for matchday_no in range(1, 39):
            matchday_status = fixtures.df[matchday_no]['Status'] 

            # If whole column is SCHEDULED, skip
            if not all(matchday_status == 'SCHEDULED'):
                for team_name, row in fixtures.df[matchday_no].iterrows():
                    if row['Status'] == 'FINISHED':
                        home_initials = util.convert_team_name_or_initials(team_name)
                        away_initials = util.convert_team_name_or_initials(row['Team'])
                        home_goals, away_goals = util.extract_int_score(row['Score'])

                        if not row['AtHome']:
                            home_initials, away_initials = away_initials, home_initials

                        actual_scores.add((row['Date'], home_initials, away_initials, home_goals, away_goals))

        return actual_scores

    def update(self, fixtures: Fixtures, form: Form, upcoming: Upcoming, 
            home_advantages: HomeAdvantages) -> DataFrame:
        predictions = self.predictor.gen_score_predictions(fixtures, form, upcoming, home_advantages)
        actual_scores = self._get_actual_scores(fixtures)
        
        self.database.update_predictions(predictions, actual_scores)
        
        self.accuracy = self.database.update_accuracy()
        
        self.database.update_actual_scores(actual_scores)
        
        # self._update_json_file(predictions, actual_scores)
        self._print_accuracy()

        upcoming_predictions = pd.DataFrame.from_dict(predictions, orient='index')[['prediction', 'detailedPrediction']]
        upcoming_predictions.columns = ['Prediction', 'DetailedPrediction']

        return upcoming_predictions

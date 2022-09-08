import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dataclasses import dataclass
from datetime import datetime
from typing import Union

import pandas as pd
from pandas.core.frame import DataFrame

from data import Fixtures, Form, HomeAdvantages, Upcoming
from lib.database.database import Database
from lib.utils.utilities import Utilities

utils = Utilities()


class Predictor:
    def __init__(self, form_diff_multiplier: int = 0.5, home_adv_multiplier: int = 1):
        self.form_diff_multiplier = form_diff_multiplier
        self.home_adv_multiplier = home_adv_multiplier

    @staticmethod
    def _outdated_prediction_already_made(
            date: str,
            new_prediction: str,
            predictions: dict
        ) -> bool:
        already_made = False
        if date in predictions.keys():
            for prediction in predictions[date]:
                predicted_score = prediction['prediction']
                actual_score = prediction['actual']
                if predicted_score is not None:
                    if utils.identical_fixtures(predicted_score, new_prediction):
                        # If fixture match perfectly but predicted scoreline different (outdated)
                        if (predicted_score != new_prediction) and (actual_score is None):
                            already_made = True
                        break

        return already_made

    @staticmethod
    def _avg_previous_result(
            team_name: str,
            prev_matches: list[dict[str, str]]
        ) -> tuple[float, float]:
        goals_scored = 0
        goals_conceded = 0
        for prev_match in prev_matches:
            if team_name == prev_match['homeTeam']:
                # Played at home
                goals_scored += prev_match['homeGoals']
                goals_conceded += prev_match['awayGoals']
            elif team_name == prev_match['awayTeam']:
                # Played away
                goals_scored += prev_match['awayGoals']
                goals_conceded += prev_match['homeGoals']

        # Average scored and conceded
        avg_scored = goals_scored / len(prev_matches)
        avg_conceded = goals_conceded / len(prev_matches)

        return avg_scored, avg_conceded

    def _adjust_by_form(
            self, 
            form_rating: float,
            opp_form_rating: float,
            pred_scored: float = 0,
            pred_conceded: float = 0
        ) -> tuple[float, float]:
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = form_rating - opp_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            pred_scored += pred_scored * (form_diff/100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            pred_conceded += pred_conceded * abs(form_diff/100) * self.form_diff_multiplier

        return pred_scored, pred_conceded
    
    def _adjust_by_form_new(
            self, 
            home_form_rating: float,
            away_form_rating: float,
            home_goals: float = 0,
            away_goals: float = 0
        ) -> tuple[float, float]:
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = home_form_rating - away_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            home_goals += home_goals * (form_diff/100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            away_goals += away_goals * abs(form_diff/100) * self.form_diff_multiplier

        return home_goals, away_goals

    def _adjust_by_home_advantage(
            self, 
            home_advantage: float,
            opp_home_advantage: float,
            at_home: bool,
            pred_scored: float = 0,
            pred_conceded: float = 0
        ) -> tuple[float, float]:
        # Use the home advantge to adjust the pred scored and conceded
        # for a team in opposite directions by an equal amount
        if at_home:
            # Decrease conceded (assuming team has a positive home advantage)
            pred_conceded *= 1 - (home_advantage * self.home_adv_multiplier * 0.5)
            # Increase scored (assuming team has a positive home advantage)
            pred_scored *= 1 + (home_advantage * self.home_adv_multiplier * 0.5)
        else:
            # Decrease scored (assuming opposition team has a positive home advantage)
            pred_scored *= 1 - (opp_home_advantage * self.home_adv_multiplier * 0.5)
            # Increase conceded (assuming opposition team has a positive home advantage)
            pred_conceded *= 1 + (opp_home_advantage * self.home_adv_multiplier * 0.5)

        return pred_scored, pred_conceded

    def _adjust_by_home_advantage_new(
            self, 
            home_advantage: float,
            home_goals: float = 0,
            away_goals: float = 0
        ) -> tuple[float, float]:
        home_goals *= 1 + (home_advantage * self.home_adv_multiplier * 0.5)
        away_goals *= 1 - (home_advantage * self.home_adv_multiplier * 0.5)
        return home_goals, away_goals

    @staticmethod
    def _neutral_prev_matches(prev_matches: list[dict[str, str]]):
        neutral_prev_matches = []
        for match in prev_matches:
            neutral_match = {}
            # Rename to match json format
            for k, v in match.items():
                neutral_match[k[0].lower() + k[1:]] = v
            neutral_match.pop('result')  # Remove result key
            neutral_prev_matches.append(neutral_match)

        return neutral_prev_matches

    @staticmethod
    def _starting_score(
            avg_result: tuple[float, float],
            opp_avg_result: tuple[float, float]
        ) -> tuple[float, float]:
        # Midway between team's avg scored and opposition's avg conceded
        pred_scored = (avg_result[0] + opp_avg_result[1]) / 2
        pred_conceded = (avg_result[1] + opp_avg_result[0]) / 2

        return pred_scored, pred_conceded
    
    @staticmethod
    def _starting_score_new(
            home_avg_result: tuple[float, float],
            away_avg_result: tuple[float, float]
        ) -> tuple[float, float]:
        # Midway between team's avg scored and opposition's avg conceded
        home_goals = (home_avg_result[0] + away_avg_result[1]) / 2
        away_goals = (home_avg_result[1] + away_avg_result[0]) / 2
        return home_goals, away_goals

    def _adjust_by_prev_matches(
            self,
            team_name: str,
            pred_scored: float, 
            pred_conceded: float,
            prev_matches: list[dict[str, str]], 
            prev_meeting_weight: float = 0.5
        ) -> tuple[float, float]:
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
    
    def _adjust_by_prev_matches_new(
            self,
            team_name: str,
            home_goals: float, 
            away_goals: float,
            at_home: float,
            prev_matches: list[dict[str, str]], 
            prev_meeting_weight: float = 0.5
        ) -> tuple[float, float]:
        if prev_matches:
            # Get avg scored and conceded from perspective of current team
            avg_scored, avg_conceded = self._avg_previous_result(team_name, prev_matches)
            
            # Allocated to home and away goals depending on at_home
            if at_home:
                avg_home_goals = avg_scored
                avg_away_goals = avg_conceded
            else:
                avg_home_goals = avg_conceded
                avg_away_goals = avg_scored

            home_goals = (avg_home_goals * prev_meeting_weight) + (home_goals * (1 - prev_meeting_weight))
            away_goals = (avg_away_goals * prev_meeting_weight) + (away_goals * (1 - prev_meeting_weight))

        return home_goals, away_goals

    def _calc_score_prediction(
            self, 
            team_name: str, 
            avg_result: tuple[float, float], 
            opp_avg_result: tuple[float, float],
            home_advantage: float, 
            opp_home_advantage: float,
            at_home: bool,
            form_rating: float, 
            long_term_form_rating: float,
            opp_form_rating: float, 
            opp_long_term_form_rating: float,
            prev_matches: list[dict[str, str]]
        ) -> tuple[float, float]:

        pred_scored, pred_conceded = self._starting_score(
            avg_result, opp_avg_result)
                
        pred_scored, pred_conceded = self._adjust_by_prev_matches(
            team_name, pred_scored, pred_conceded, prev_matches)

        # Modify based on difference in current form (last 5 games) between two teams
        pred_scored, pred_conceded = self._adjust_by_form(
            form_rating, opp_form_rating, pred_scored, pred_conceded)

        # Modify based on difference in longer-term (10 games) form between two teams
        pred_scored, pred_conceded = self._adjust_by_form(
            long_term_form_rating, opp_long_term_form_rating, pred_scored, pred_conceded)

        # Decrese scores conceded if playing at home
        pred_scored, pred_conceded = self._adjust_by_home_advantage(
            home_advantage, opp_home_advantage, at_home, pred_scored, pred_conceded)

        return pred_scored, pred_conceded
    
    def _calc_score_prediction_new(
            self, 
            team_name: str,
            home_avg_result: tuple[float, float], 
            away_avg_result: tuple[float, float],
            home_form_rating: float, 
            away_form_rating: float, 
            home_long_term_form_rating: float,
            away_long_term_form_rating: float,
            at_home: bool,
            home_advantage: float, 
            prev_matches: list[dict[str, str]]
        ) -> tuple[float, float]:

        home_goals, away_goals = self._starting_score_new(
            home_avg_result, away_avg_result)
        
        home_goals, away_goals = self._adjust_by_prev_matches_new(
            team_name, home_goals, away_goals, at_home, prev_matches)
        
        # Modify based on difference in current form (last 5 games) between two teams
        home_goals, away_goals = self._adjust_by_form_new(
            home_form_rating, away_form_rating, home_goals, away_goals)
        
        # Modify based on difference in longer-term (10 games) form between two teams
        home_goals, away_goals = self._adjust_by_form_new(
            home_long_term_form_rating, away_long_term_form_rating, home_goals, away_goals)
        
        # Decrese scores conceded if playing at home
        home_goals, away_goals = self._adjust_by_home_advantage_new(
            home_advantage, home_goals, away_goals)

        return home_goals, away_goals

    @staticmethod
    def _prediction_details(
            team_name: str, 
            opp_team_name: str,
            pred_scored: float, 
            pred_conceded: float,
            at_home: bool
        ) -> tuple[str, str, dict[str, int], dict[str, float]]:
        team_name_initials = utils.convert_team_name_or_initials(team_name)
        opp_team_name_initials = utils.convert_team_name_or_initials(opp_team_name)
        
        # Construct prediction string for display
        if at_home:
            home = team_name_initials
            away = opp_team_name_initials
            prediction = {'homeGoals': round(pred_scored, 4), 'awayGoals': round(pred_conceded, 4)}
        else:
            home = opp_team_name_initials
            away = team_name_initials
            prediction = {'homeGoals': round(pred_conceded, 4), 'awayGoals': round(pred_scored, 4)}

        return home, away, prediction

    def gen_score_predictions(
            self, 
            fixtures: Fixtures, 
            form: Form, 
            upcoming: Upcoming, 
            home_advantages: HomeAdvantages
        ) -> dict[dict[str, Union[datetime, str, float]]]:
        predictions = {}  # type: dict[dict[str, Union[datetime, str, float]]]
        team_names = form.df.index.values.tolist()
        
        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if upcoming is not None:
                form_rating = form.get_current_form_rating(team_name)
                long_term_form_rating = form.get_long_term_form_rating(team_name)
                                
                opp_team_name = upcoming.at[team_name, 'nextTeam']
                at_home = upcoming.at[team_name, 'atHome']
                prev_matches = upcoming.at[team_name, 'prevMatches']
                
                opp_form_rating = form.get_current_form_rating(opp_team_name)
                opp_long_term_form_rating = form.get_long_term_form_rating(opp_team_name)

                avg_result = fixtures.get_avg_result(team_name)
                opp_avg_result = fixtures.get_avg_result(opp_team_name)
                
                home_advantage = home_advantages.df.loc[team_name, 'totalHomeAdvantage'][0]
                opp_home_advantage = home_advantages.df.loc[opp_team_name, 'totalHomeAdvantage'][0]

                pred_scored, pred_conceded = self._calc_score_prediction(
                    team_name, avg_result, opp_avg_result, home_advantage,
                    opp_home_advantage, at_home, form_rating, long_term_form_rating,
                    opp_form_rating, opp_long_term_form_rating, prev_matches)

                home_initials, away_initials, pred = self._prediction_details(
                    team_name, opp_team_name, pred_scored, pred_conceded, at_home)

                date = upcoming.at[team_name, 'date'].to_pydatetime()
                
                prediction = {'date': date,
                              'homeInitials': home_initials,
                              'awayInitials': away_initials,
                              'prediction': pred}
                        
            predictions[team_name] = prediction

        return predictions
    
    def gen_score_predictions_new(
            self, 
            fixtures: Fixtures, 
            form: Form, 
            upcoming: Upcoming, 
            home_advantages: HomeAdvantages
        ) -> dict[dict[str, Union[datetime, str, float]]]:
        predictions = {}  # type: dict[dict[str, Union[datetime, str, float]]]
        team_names = form.df.index.values.tolist()
        
        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if upcoming is not None:
                at_home = upcoming.at[team_name, 'atHome']
                if at_home:
                    home_team_name = team_name
                    away_team_name = upcoming.at[home_team_name, 'nextTeam']
                else:
                    away_team_name = team_name
                    home_team_name = upcoming.at[away_team_name, 'nextTeam']

                home_form_rating = form.get_current_form_rating(home_team_name)
                home_long_term_form_rating = form.get_long_term_form_rating(home_team_name)
                home_avg_result = fixtures.get_avg_result(home_team_name)
                
                away_form_rating = form.get_current_form_rating(away_team_name)
                away_long_term_form_rating = form.get_long_term_form_rating(away_team_name)
                away_avg_result = fixtures.get_avg_result(away_team_name)

                home_advantage = home_advantages.df.loc[home_team_name, 'totalHomeAdvantage'][0]
                prev_matches = upcoming.at[team_name, 'prevMatches']
                
                home_goals, away_goals = self._calc_score_prediction_new(
                    team_name, 
                    home_avg_result, away_avg_result,
                    home_form_rating, away_form_rating,
                    home_long_term_form_rating, away_long_term_form_rating,
                    at_home,
                    home_advantage,
                    prev_matches)
            
                prediction = {
                    'homeGoals': round(home_goals, 4),
                    'awayGoals': round(away_goals, 4)
                }
            
            predictions[team_name] = prediction

        return predictions


class Predictions:
    def __init__(self, current_season: int):
        self.predictor = Predictor()
        self.database = Database(current_season)
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

    @staticmethod
    def _signed_float_str(value: float) -> str:
        value = round(value, 2)
        if value >= 0:
            return f'+{value}'
        return str(value)
    
    def _predictions_to_df(self, predictions: dict[str, dict[str, float]]) -> DataFrame:
        d = {}
        for team, prediction in predictions.items():
            p = {}
            for goals_type, goals in prediction.items():
                p[('prediction', goals_type)] = goals
            d[team] = p
        
        df = pd.DataFrame.from_dict(d, orient='index')
        return df

    def build(
            self, 
            fixtures: Fixtures, 
            form: Form, 
            upcoming: Upcoming, 
            home_advantages: HomeAdvantages,
        ) -> DataFrame:
        # predictions = self.predictor.gen_score_predictions(fixtures, form, upcoming, home_advantages)
        predictions = self.predictor.gen_score_predictions_new(fixtures, form, upcoming, home_advantages)
        # actual_scores = fixtures.get_actual_scores()
        
        # if update_db:
        #     print('old')
        #     print(predictions)
        #     print(actual_scores)
        #     self.database.update_predictions(predictions, actual_scores)
        #     self.database.update_actual_scores(actual_scores)
        
        upcoming_predictions = self._predictions_to_df(predictions)
        
        return upcoming_predictions

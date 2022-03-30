import json
import numpy as np

from predictions import Predictor
from updater import Updater
from utilities import Utilities
from tqdm import tqdm

util = Utilities()

class OptimisePredictions:
    
    @staticmethod
    def correct_result(ph, pa, ah, aa):
        return (ph > pa and ah > aa) or (ph == pa and ah == aa) or (ph < pa and ah < aa)
    
    @staticmethod
    def game_result_tuple(match: dict) -> tuple[str, str]:
        home_score = match['score']['fullTime']['homeTeam']
        away_score = match['score']['fullTime']['awayTeam']
        if home_score == away_score:
            result = ('Drew', 'Drew')
        elif home_score > away_score:
            result = ('Won', 'Lost')
        else:
            result = ('Lost', 'Won')

        return result
    
    def get_prev_matches(self, json_data, team_names):
        prev_matches = []
        for i in range(4):
            data = json_data['fixtures'][current_season-i]
            for match in data:
                if match['status'] == 'FINISHED':
                    home_team = match['homeTeam']['name'].replace('&', 'and')  # type: str
                    away_team = match['awayTeam']['name'].replace('&', 'and')  # type: str

                    if home_team in team_names and away_team in team_names:
                        result = self.game_result_tuple(match)
                        prev_match = {'HomeTeam': home_team,
                                      'AwayTeam': away_team,
                                      'HomeGoals': match['score']['fullTime']['homeTeam'],
                                      'AwayGoals': match['score']['fullTime']['awayTeam'],
                                      'Result': result[0]}
                        prev_matches.append(prev_match)
        return prev_matches
    
    def score_predictions(self, predictor, actual_scores, json_data, team_names, form, fixtures, home_advantages) -> dict:
        correct = 0
        correct_result = 0
        # Check ALL teams as two teams can have different next games
        for team_name, opp_team_name, actual_score in actual_scores:
            form_rating = form.get_current_form_rating(team_name)
            long_term_form_rating = form.get_long_term_form_rating(team_name)
            opp_form_rating = form.get_current_form_rating(opp_team_name)
            opp_long_term_form_rating = form.get_long_term_form_rating(opp_team_name)
            avg_result = fixtures.get_avg_result(team_name)
            opp_avg_result = fixtures.get_avg_result(opp_team_name)
            home_advantage = home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]
            opp_home_advantage = home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]
            prev_matches = self.get_prev_matches(json_data, team_names)
            
            pred_scored, pred_conceded = predictor._calc_score_prediction(
                team_name, avg_result, opp_avg_result, home_advantage,
                opp_home_advantage, True, form_rating, long_term_form_rating,
                opp_form_rating, opp_long_term_form_rating, prev_matches)
        
            pred_scored = int(round(pred_scored))
            pred_conceded = int(round(pred_conceded))
            
            if pred_scored == actual_score['homeGoals'] and pred_conceded == actual_score['awayGoals']:
                correct += 1
            if self.correct_result(pred_scored, pred_conceded, actual_score['homeGoals'], actual_score['awayGoals']):
                correct_result += 1

        accuracy = correct / len(actual_scores)
        results_accuracy = correct_result / len(actual_scores)
        
        return accuracy, results_accuracy
    
    @staticmethod
    def get_actual_scores(current_season):
        with open(f'data/predictions_{current_season}.json') as json_file:
            data = json.load(json_file)
            predictions_json = data['predictions']
        
        actual_scores = []
        for predictions in predictions_json.values():
            for prediction in predictions:
                if prediction['actual'] is not None:
                    actual_score = (util.convert_team_name_or_initials(prediction['homeInitials']), 
                                    util.convert_team_name_or_initials(prediction['awayInitials']),
                                    prediction['actual'])
                    actual_scores.append(actual_score)
        return actual_scores
            
    
    def brute_force(self, current_season):
        actual_scores = self.get_actual_scores(current_season)
        
        updater = Updater(current_season)
        updater.update_all(request_new=True)
        
        n = 50
        home_advantage_multiplier = 1
        best = (-1, -1, -1, home_advantage_multiplier)
        for form_diff_multiplier in np.linspace(1.5, 10, n):
            predictor = Predictor(home_advantage_multiplier, form_diff_multiplier)
            accuracy, results_accuracy = self.score_predictions(predictor, 
                                                                actual_scores,
                                                                updater.json_data,
                                                                updater.data.team_names,
                                                                updater.data.form, 
                                                                updater.data.fixtures,
                                                                updater.data.home_advantages)
            if results_accuracy > best[1]:
                best = (accuracy, results_accuracy, form_diff_multiplier, home_advantage_multiplier)
                print('New best found:', best)
                
        print('FINAL BEST:', best)

if __name__ == '__main__':
    current_season = 2021
    o = OptimisePredictions()
    o.brute_force(current_season)
import json
import numpy as np

from predictions import Predictor
from updater import Updater
from utilities import Utilities

util = Utilities()

class OptimisePredictions:
    def correct_result(self, ph, pa, ah, aa):
        if ph > pa and ah > aa:
            return True
        elif ph == pa and ah == aa:
            return True
        elif ph < pa and ah < aa:
            return True
        return False
    
    def game_result_tuple(self, match: dict) -> tuple[str, str]:
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
    
    def score_predictions(self, predictor, actual_scores, json_data, team_names, form, home_advantages) -> dict:
        correct = 0
        correct_result = 0
        total = 0
        # Check ALL teams as two teams can have different next games
        for team_name, opp_team_name, actual_score in actual_scores:
            form_rating = form.get_current_form_rating(team_name)
            opp_form_rating = form.get_current_form_rating(opp_team_name)
            
            home_advantage = home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]
            opp_home_advantage = home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]
            
            at_home = True
            
            prev_matches = self.get_prev_matches(json_data, team_names)
            
            pred_scored, pred_conceded, _ = predictor.calc_score_prediction(
                team_name, home_advantage, opp_home_advantage, at_home, 
                form_rating, opp_form_rating, prev_matches)

            _, _, pred = predictor.prediction_details(
                team_name, opp_team_name, pred_scored, pred_conceded, at_home)
            
            if pred['homeGoals'] == actual_score['homeGoals'] and pred['awayGoals'] == actual_score['awayGoals']:
                correct += 1
            if self.correct_result(pred['homeGoals'], pred['awayGoals'], actual_score['homeGoals'], actual_score['awayGoals']):
                correct_result += 1
            total += 1

        return correct/total, correct_result/total
    
    def get_actual_scores(self, current_season):
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
        
        progress = 0
        n = 25
        best_accuracy = -1
        best = None
        for form_diff_multiplier in np.linspace(0, 5, n):
            for home_advantage_multiplier in np.linspace(0, 30, n):
                predictor = Predictor(current_season, home_advantage_multiplier, form_diff_multiplier)
                accuracy, results_accuracy = self.score_predictions(predictor, 
                                                                    actual_scores,
                                                                    updater.json_data,
                                                                    updater.data.team_names,
                                                                    updater.data.form, 
                                                                    updater.data.home_advantages)
                if accuracy > best_accuracy:
                    best_accuracy = accuracy
                    best = ('form:', form_diff_multiplier, 'home advantage:', home_advantage_multiplier)
                    print('New best found:', best)
                    print('     Accuracy:', accuracy)
                    print('     Results accuracy:', results_accuracy)
                
                print(round((progress / (n**2)) * 100, 2), '%')
                progress += 1
                
                
        print('FINAL BEST:', best)
        print('     Accuracy:', best_accuracy)

if __name__ == '__main__':
    current_season = 2021
    o = OptimisePredictions()
    o.brute_force(current_season)


"""Results:
FINAL BEST: ('form:', 1, 'home advantage:', 25.70707070707071)
     Results accuracy: 0.5348837209302325

FINAL BEST: ('form:', 0.0, 'home advantage:', 23.75)
     Accuracy: 0.12790697674418605
"""
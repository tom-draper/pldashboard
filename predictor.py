from typing import Optional
from utilities import Utilities

util = Utilities()
    

class Predictor:
    def __init__(self, current_season: int):
        self.current_season = current_season
        self.form_diff_multiplier = 1.5
        self.home_advantage_multiplier = 1.5

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
            operation = f'{round(pred_conceded, 4)} *= (1 - ({round(home_advantage, 4)} * {self.home_advantage_multiplier})) * 0.5\n' \
                        f'{round(pred_scored, 4)} *= (1 + ({round(home_advantage, 4)} * {self.home_advantage_multiplier})) * 0.5'
            # Decrease conceded (assuming team has a positive home advantage)
            pred_conceded *= (1 - (home_advantage * self.home_advantage_multiplier)) / 2
            # Increase scored (assuming team has a positive home advantage)
            pred_scored *= (1 + (home_advantage * self.home_advantage_multiplier)) / 2
            home_goals = pred_scored
            away_goals = pred_conceded
            advantage = home_advantage
        else:
            operation = f'{round(pred_scored, 4)} *= (1 - ({round(opp_home_advantage, 4)} * {self.home_advantage_multiplier})) * 0.5\n' \
                        f'{round(pred_conceded, 4)} *= (1 + ({round(home_advantage, 4)} * {self.home_advantage_multiplier})) * 0.5'
            # Decrease scored (assuming opposition team has a positive home advantage)
            pred_scored *= (1 - (opp_home_advantage * self.home_advantage_multiplier)) * 0.5
            # Increase conceded (assuming opposition team has a positive home advantage)
            pred_conceded *= (1 + (opp_home_advantage * self.home_advantage_multiplier)) * 0.5
            home_goals = pred_conceded
            away_goals = pred_scored
            advantage = opp_home_advantage

        detail = {'description': 'Adjusted by home advantage',
                  'operation': operation,
                  'xGHome': round(home_goals, 4), 
                  'xGAway': round(away_goals, 4), 
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

    def gen_score_predictions(self, form, upcoming, home_advantages) -> dict:
        # {"Liverpool FC": ("25-08-21", "LIV  2 - 1 BUR"), ...}
        predictions = {}  # type: dict[str, Optional[tuple[str, str]]]
        team_names = form.df.index.values.tolist()

        # Check ALL teams as two teams can have different next games
        for team_name in team_names:
            prediction = None
            if upcoming != None:
                opp_team_name = upcoming.df['NextTeam'].loc[team_name]
                form_rating = form.get_current_form_rating(team_name)  # type: float
                opp_form_rating = form.get_current_form_rating(opp_team_name)  # type: float
                home_advantage = home_advantages.df.loc[team_name, 'TotalHomeAdvantage'][0]  # type: float
                opp_home_advantage = home_advantages.df.loc[opp_team_name, 'TotalHomeAdvantage'][0]  # type: float
                at_home = upcoming.df['AtHome'].loc[team_name]  # type: bool
                prev_matches = upcoming.df['PreviousMatches'].loc[team_name]  # type: list[tuple]
                
                pred_scored, pred_conceded, details = self.calc_score_prediction(
                    team_name, home_advantage, opp_home_advantage, at_home, 
                    form_rating, opp_form_rating, prev_matches)

                home_initials, away_initials, pred = self.prediction_details(
                    team_name, opp_team_name, pred_scored, pred_conceded, at_home)
            
                date = upcoming.df['Date'].loc[team_name].to_pydatetime()
                
                prediction = {'Date': date, 
                              'HomeInitials': home_initials, 
                              'AwayInitials': away_initials, 
                              'Prediction': pred, 
                              'Details': details}

            predictions[team_name] = prediction

        return predictions

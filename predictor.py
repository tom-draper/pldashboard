from utilities import Utilities

utilities = Utilities()

class Predictor:
    def calcScorePredictions(self, form, next_games) -> dict:
        score_predictions = {}
        
        team_names = form.df.index.values.tolist()
        for team_name in team_names:
            if next_games == None:
                # If season finished
                score_predictions[team_name] = None
            else:
                current_form = form.getCurrentFormRating(team_name)
                team_playing_next_name = next_games.df['Next Game'].loc[team_name]
                team_playing_next_form_rating = form.getCurrentFormRating(team_playing_next_name)
                team_playing_next_home_away = next_games.df['HomeAway'].loc[team_name]
                team_playing_prev_meetings = next_games.df.loc[team_name]['Previous Meetings']
                
                # Get total goals scored and conceded in all previous games with this
                # particular opposition team
                goals_scored = 0
                goals_conceded = 0
                for prev_match in team_playing_prev_meetings:
                    if team_name == prev_match[1]:
                        # Played at home
                        goals_scored += prev_match[3]
                        goals_conceded += prev_match[4]
                    elif team_name == prev_match[2]:
                        # Played away
                        goals_scored += prev_match[4]
                        goals_conceded += prev_match[3]
                        
                # Average scored and conceded            
                predicted_scored = goals_scored / len(team_playing_prev_meetings)
                predicted_conceded = goals_conceded / len(team_playing_prev_meetings)
                
                # Boost the score of the team better in form based on the absolute 
                # difference in form
                form_diff = current_form - team_playing_next_form_rating
                if form_diff > 0:
                    # This team in better form
                    predicted_scored += predicted_scored * (form_diff/100)
                else:
                    # Other team in better form
                    predicted_conceded += predicted_conceded * (abs(form_diff)/100)
                
                predicted_scored = int(predicted_scored)
                predicted_conceded = int(predicted_conceded)
                
                # Construct prediction string to display
                if team_playing_next_home_away == "home":
                    prediction = f'{utilities.convertTeamNameOrInitials(team_name)}  {predicted_scored} - {predicted_conceded}  {utilities.convertTeamNameOrInitials(team_playing_next_name)}'
                else:
                    prediction = f'{utilities.convertTeamNameOrInitials(team_playing_next_name)}  {predicted_conceded} - {predicted_scored}  {utilities.convertTeamNameOrInitials(team_name)}'
                score_predictions[team_name] = prediction
        
        return score_predictions
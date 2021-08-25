from data import Data
from flask import Flask, render_template, request

season = 2021


class Params:
    def __init__(self,
                 season=season,
                 title=None,
                 team_name=None,
                 team_name_hyphen=None,
                 position=None,
                 form=None,
                 recent_teams_played=None,
                 form_rating=None,
                 clean_sheet_ratio=None,
                 goals_per_game=None,
                 conceded_per_game=None,
                 won_against_star_team=None,
                 opp_team_name_hyphen=None,
                 opp_form_rating=None,
                 home_away=None,
                 prev_meetings=None,
                 prediction=None,
                 prediction_accuracy=None,
                 prediction_results_accuracy=None,
                 table_snippet=None,
                 team_table_idx=None,
                 team_logo_url=None,
                 opp_logo_url=None):
        self.season = season
        self.title = title
        self.team_name = team_name
        self.team_name_hyphen = team_name_hyphen
        self.position = position
        self.form = form
        self.recent_teams_played = recent_teams_played
        self.form_rating = form_rating
        self.clean_sheet_ratio = clean_sheet_ratio
        self.goals_per_game = goals_per_game
        self.conceded_per_game = conceded_per_game
        self.won_against_star_team = won_against_star_team
        self.opp_team_name_hyphen = opp_team_name_hyphen
        self.opp_form_rating = opp_form_rating
        self.home_away = home_away
        self.prev_meetings = prev_meetings
        self.prediction = prediction
        self.prediction_accuracy = prediction_accuracy
        self.prediction_results_accuracy = prediction_results_accuracy
        self.table_snippet = table_snippet
        self.team_table_idx = team_table_idx
        self.team_logo_url = team_logo_url
        self.opp_logo_url = opp_logo_url


app = Flask(__name__)


@app.route("/")
@app.route("/home")
def home():
    params = Params(title='Premier League')
    return render_template('home.html', params=params)


def get_params(team_name_hyphen):
    title = team_name_hyphen.replace('-', ' ').title().replace('And', 'and')
    
    # This team
    team_name = title + ' FC'
    team_logo_url = data.get_logo_url(team_name)
    
    # Get data values to display on team webpage
    position = data.standings.get_position(team_name, season)
    
    # Season stats
    form, recent_teams_played, form_rating, won_against_star_team = data.form.get_recent_form(team_name)
    clean_sheet_ratio, goals_per_game, conceded_per_game = data.season_stats.get_season_stats(team_name)
        
    # Next game
    opp_team_name, home_away, prev_meetings = data.next_games.get_details(team_name)
    opp_form_rating = data.form.get_current_form_rating(opp_team_name)
    prediction, accuracy, results_accuracy = data.get_next_game_prediction(team_name)
    opp_team_name_hyphen = (opp_team_name.lower()[:-3]).replace(' ', '-') # Remove 'FC' from end
    opp_logo_url = data.get_logo_url(opp_team_name)
        
    table_snippet, team_table_idx = data.standings.get_table_snippet(team_name, season)

    params = Params(season=season, 
                    title=title, 
                    team_name=team_name, 
                    team_name_hyphen=team_name_hyphen, 
                    position=position, 
                    form=form, 
                    recent_teams_played=recent_teams_played, 
                    form_rating=form_rating, 
                    clean_sheet_ratio=clean_sheet_ratio, 
                    goals_per_game=goals_per_game, 
                    conceded_per_game=conceded_per_game, 
                    won_against_star_team=won_against_star_team, 
                    opp_team_name_hyphen=opp_team_name_hyphen, 
                    opp_form_rating=opp_form_rating, 
                    home_away=home_away, 
                    prev_meetings=prev_meetings, 
                    prediction=prediction, 
                    prediction_accuracy=accuracy, 
                    prediction_results_accuracy=results_accuracy, 
                    table_snippet=table_snippet, 
                    team_table_idx=team_table_idx, 
                    team_logo_url=team_logo_url, 
                    opp_logo_url=opp_logo_url)

    return params


@app.route("/liverpool")
@app.route("/manchester-city")
@app.route("/manchester-united")
@app.route("/chelsea")
@app.route("/leicester-city")
@app.route("/tottenham-hotspur")
@app.route("/wolverhampton-wanderers")
@app.route("/arsenal")
@app.route("/burnley")
@app.route("/southampton")
@app.route("/everton")
@app.route("/newcastle-united")
@app.route("/crystal-palace")
@app.route("/brighton-and-hove-albion")
@app.route("/west-ham-united")
@app.route("/aston-villa")
@app.route("/leeds-united")
@app.route("/norwich-city")
@app.route("/watford")
@app.route("/brentford")
# @app.route("/west-bromwich-albion")
# @app.route("/fulham")
def team():
    rule = request.url_rule
    # Get hypehenated team name from current URL
    team_name_hyphen = rule.rule[1:]
    params = get_params(team_name_hyphen)

    return render_template('team.html', params=params)


if __name__ == '__main__':
    data = Data(season)
    # Update data and graphs
    data.update_all(request_new=True, display_tables=False)

    app.run(host='0.0.0.0', debug=False)

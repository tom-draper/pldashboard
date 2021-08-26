from data import Data
from flask import Flask, render_template, request
from collections import namedtuple
from threading import Thread
from time import sleep

season = 2021

app = Flask(__name__)

Params = namedtuple('Params', ['season', 'title', 'team', 'form', 'season_stats', 'next_game', 'prediction', 'table_snippet'])


@app.route("/")
@app.route("/home")
def home():
    params = Params(None, 'Premier League', None, None, None, None, None, None)
    return render_template('home.html', params=params)



def get_team(title, team_name_hyphen):
    team_name = title + ' FC'
    team_logo_url = data.get_logo_url(team_name)
    position = data.standings.get_position(team_name, season)
    Team = namedtuple('Team', ['name', 'name_hyphen', 'position', 'logo_url'])
    return Team(team_name, team_name_hyphen, position, team_logo_url)

def get_form(team_name):
    form_str, recent_teams_played, rating, won_against_star_team = data.form.get_recent_form(team_name)
    Form = namedtuple('Form', ['form', 'recent_teams_played', 'rating', 'won_against_star_team'])
    return Form(form_str, recent_teams_played, rating, won_against_star_team)

def get_season_stats(team_name):
    clean_sheet_ratio, csr_position, goals_per_game, gpg_position, conceded_per_game, cpg_position = data.season_stats.get_season_stats(team_name)
    SeasonStats = namedtuple('SeasonStats', ['clean_sheet_ratio', 'csr_position', 'goals_per_game', 'gpg_position', 'conceded_per_game', 'cpg_position'])
    return SeasonStats(clean_sheet_ratio, csr_position, goals_per_game, gpg_position, conceded_per_game, cpg_position)

def get_next_game(team_name):
    opp_team_name, home_away, prev_meetings = data.next_games.get_details(team_name)
    opp_team_name_hyphen = (opp_team_name.lower()[:-3]).replace(' ', '-') # Remove 'FC' from end
    opp_form_rating = data.form.get_current_form_rating(opp_team_name)
    opp_logo_url = data.get_logo_url(opp_team_name)
    OppTeam = namedtuple('OppositionTeam', ['name', 'name_hyphen', 'form_rating', 'logo_url'])
    opp_team = OppTeam(opp_team_name, opp_team_name_hyphen, opp_form_rating, opp_logo_url)
    NextGame = namedtuple('NextGame', ['opp_team', 'home_away', 'prev_meetings'])
    return NextGame(opp_team, home_away, prev_meetings)

def get_prediction(team_name):
    score_prediction, accuracy, results_accuracy = data.predictor.get_next_game_prediction(team_name)
    Prediction = namedtuple('Prediction', ['score_prediction', 'accuracy', 'results_accuracy'])
    return Prediction(score_prediction, accuracy, results_accuracy)

def get_table_snippet(team_name):
    rows, team_table_idx = data.standings.get_table_snippet(team_name, season)
    TableSnippet = namedtuple('TableSnippet', ['rows', 'team_table_idx'])
    return TableSnippet(rows, team_table_idx)

def get_params(team_name_hyphen):
    title = team_name_hyphen.replace('-', ' ').title().replace('And', 'and')
    
    team = get_team(title, team_name_hyphen)
    form = get_form(team.name)
    season_stats = get_season_stats(team.name)
    next_game = get_next_game(team.name)
    prediction = get_prediction(team.name)
    table_snippet = get_table_snippet(team.name)

    params = Params(season, title, team, form, season_stats, next_game, prediction, table_snippet)

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


# class SharedData:
#     """ 
#     A synchronised wrapper for the Data class.
#     Stops the Flask server and accessing the HTML files at the same time"""

#     def __init__(self, season):
#         self.data = Data(season)
#         self.lock = Lock()
    
#     def update_all(self, request_new=True, display_tables=False):
#         self.data.update_all(request)
    

def thread_function(time=3600):
    while True:
        print(f'Sleeping: {time}s')
        sleep(time)
        data.update_all(request_new=True, display_tables=False)

data = Data(season)
data_updater_thread = Thread(target=thread_function, args=(3600,))
data.update_all(request_new=True, display_tables=False)
data_updater_thread.start()

if __name__ == '__main__':
    # data_updater_thread = Thread(target=thread_function, args=(3600,))
    # data.update_all(request_new=True, display_tables=False)
    # data_updater_thread.start()
    app.run(host='0.0.0.0', debug=False)

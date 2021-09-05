from data import Data
from flask import Flask, render_template, request
from collections import namedtuple
from threading import Thread
from time import sleep

season = 2021

app = Flask(__name__)


@app.route('/')
@app.route('/home')
def home():
    Params= namedtuple('Params', ['title'])
    params = Params('Premier League')
    return render_template('home.html', params=params)



def get_team(title: str, team_name_hyphen: str):
    team_name = title + ' FC'
    team_logo_url = data.get_logo_url(team_name)
    position = data.standings.get_position(team_name, season)
    Team = namedtuple('Team', ['name', 'name_hyphen', 'position', 'logo_url'])
    return Team(team_name, team_name_hyphen, position, team_logo_url)

def get_form(team_name: str):
    form_str, recent_teams_played, rating, won_against_star_team = data.form.get_recent_form(team_name)
    Form = namedtuple('Form', ['form', 'recent_teams_played', 'rating', 'won_against_star_team'])
    return Form(form_str, recent_teams_played, rating, won_against_star_team)

def get_season_stats(team_name: str):
    clean_sheet_ratio, csr_position, goals_per_game, gpg_position, conceded_per_game, cpg_position = data.season_stats.get_season_stats(team_name)
    SeasonStats = namedtuple('SeasonStats', ['clean_sheet_ratio', 'csr_position', 'goals_per_game', 'gpg_position', 'conceded_per_game', 'cpg_position'])
    return SeasonStats(clean_sheet_ratio, csr_position, goals_per_game, gpg_position, conceded_per_game, cpg_position)

def get_next_game(team_name: str):
    opp_team_name, home_away, prev_meetings = data.next_games.get_details(team_name)
    opp_team_name_hyphen = (opp_team_name.lower()[:-3]).replace(' ', '-') # Remove 'FC' from end
    opp_form_rating = data.form.get_current_form_rating(opp_team_name)
    opp_logo_url = data.get_logo_url(opp_team_name)
    OppTeam = namedtuple('OppTeam', ['name', 'name_hyphen', 'form_rating', 'logo_url'])
    opp_team = OppTeam(opp_team_name, opp_team_name_hyphen, opp_form_rating, opp_logo_url)
    NextGame = namedtuple('NextGame', ['opp_team', 'home_away', 'prev_meetings'])
    return NextGame(opp_team, home_away, prev_meetings)

def get_prediction(team_name: str):
    score_prediction = data.predictor.get_next_game_prediction(team_name)
    accuracy, results_accuracy = data.predictor.get_accuracy()
    Prediction = namedtuple('Prediction', ['score_prediction', 'accuracy', 'results_accuracy'])
    return Prediction(score_prediction, accuracy, results_accuracy)

def get_table_snippet(team_name: str):
    rows, team_table_idx = data.standings.get_table_snippet(team_name, season)
    TableSnippet = namedtuple('TableSnippet', ['rows', 'team_table_idx'])
    return TableSnippet(rows, team_table_idx)

def get_params(team_name_hyphen: str):
    title = team_name_hyphen.replace('-', ' ').title().replace('And', 'and')
    
    team = get_team(title, team_name_hyphen)
    form = get_form(team.name)
    season_stats = get_season_stats(team.name)
    next_game = get_next_game(team.name)
    prediction = get_prediction(team.name)
    table_snippet = get_table_snippet(team.name)
    Params = namedtuple('Params', ['season', 'title', 'team', 'form', 'season_stats', 'next_game', 'prediction', 'table_snippet'])

    params = Params(season, title, team, form, season_stats, next_game, prediction, table_snippet)

    return params

@app.route('/liverpool')
@app.route('/manchester-city')
@app.route('/manchester-united')
@app.route('/chelsea')
@app.route('/leicester-city')
@app.route('/tottenham-hotspur')
@app.route('/wolverhampton-wanderers')
@app.route('/arsenal')
@app.route('/burnley')
@app.route('/southampton')
@app.route('/everton')
@app.route('/newcastle-united')
@app.route('/crystal-palace')
@app.route('/brighton-and-hove-albion')
@app.route('/west-ham-united')
@app.route('/aston-villa')
@app.route('/leeds-united')
@app.route('/norwich-city')
@app.route('/watford')
@app.route('/brentford')
# @app.route('/west-bromwich-albion')
# @app.route('/fulham')
def team() -> str:
    rule = request.url_rule
    # Get hypehenated team name from current URL
    team_name_hyphen = rule.rule[1:]
    params = get_params(team_name_hyphen)

    return render_template('team.html', params=params)

def correct_result(scoreline1: str, scoreline2: str) -> bool:
    _, h1_str, _, a1_str, _ = scoreline1.split(' ')
    _, h2_str, _, a2_str, _ = scoreline2.split(' ')
    h1, a1, h2, a2 = map(int, [h1_str, a1_str, h2_str, a2_str])

    # If identical results (both a home win, a draw, or away win)
    if (h1 > a1 and h2 > a2) or (h1 == a1 and h2 == a2) or (h1 < a1 and h2 < a2):
        return True
    return False

def insert_predictions_colours(predictions: dict):
    for date in predictions.keys():
        for prediction in predictions[date]:
            if prediction['actual'] == None:
                prediction['colour'] = ''  # No colour
            elif prediction['prediction'] == prediction['actual']:
                prediction['colour'] = 'green'
            elif correct_result(prediction['prediction'], prediction['actual']):
                prediction['colour'] = 'yellow'
            else:
                prediction['colour'] = 'red'
    

@app.route('/predictions')
def predictions():
    predictions_dict = data.predictor.get_predictions()
    predictions_dict = dict(sorted(predictions_dict.items(), reverse=True))
    insert_predictions_colours(predictions_dict)
    
    accuracy, results_accuracy = data.predictor.get_accuracy()
    
    Params= namedtuple('Params', ['predictions_dict', 'accuracy', 'results_accuracy'])
    params = Params(predictions_dict, accuracy, results_accuracy)
    return render_template('predictions.html', params=params)

    

def thread_function(time=3600):
    while True:
        print(f'Updating data in {time} seconds...')
        sleep(time)
        data.update_all(request_new=True, display_tables=False)

data = Data(season)
data_updater_thread = Thread(target=thread_function, args=(7200,))
data.update_all(request_new=True, display_tables=False)
data_updater_thread.start()

if __name__ == '__main__':    
    app.run(host='0.0.0.0', debug=False)

import json
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Thread
from time import sleep

from flask import Flask, jsonify, render_template, request
from flask_compress import Compress
from pandas.core.frame import DataFrame

from updater import Updater
from utilities import Utilities

season = 2021

compress = Compress()
app = Flask(__name__)
compress.init_app(app)

utils = Utilities()


# ----------------------------- HOME PAGE --------------------------------------

@dataclass
class HomeParams:
    title: str


@app.route('/')
@app.route('/home')
def home() -> str:
    params = HomeParams('Premier League')
    return render_template('home.html', params=params)


@dataclass
class TeamNames:
    full_name: str
    name: str
    hyphenated: str


@dataclass
class Team:
    names: TeamNames
    position: int
    logo_url: str


@dataclass
class TableSnippet:
    rows: list
    team_table_idx: int


@dataclass
class Form:
    form: list[str]
    recent_teams_played: DataFrame
    rating: float
    won_against_star_team: list[str]


@dataclass
class Stat:
    ratio: float
    position: str  # Ordinal position e.g. '1st'


@dataclass
class SeasonStats:
    clean_sheets: Stat
    goals_per_game: Stat
    conceded_per_game: Stat


@dataclass
class OppTeam:
    names: TeamNames
    form_rating: float
    logo_url: str


@dataclass
class NextGame:
    opp_team: OppTeam
    home_away: str
    prev_meetings: list[tuple]


@dataclass
class Prediction:
    scoreline: str
    accuracy: float
    results_accuracy: float

# ------------------------------- TEAM PAGE ------------------------------------


@dataclass
class TeamParams:
    season: int
    team: Team
    form: Form
    season_stats: SeasonStats
    next_game: NextGame
    prediction: Prediction
    table_snippet: TableSnippet
    last_updated: str


def get_team(team_name_hyphen: str) -> Team:
    team_name = team_name_hyphen.replace('-', ' ').title().replace('And', 'and')
    team_name_full = team_name + ' FC'
    names = TeamNames(team_name_full, team_name, team_name_hyphen)

    team_logo_url = updater.data.logo_urls[team_name_full]
    position = updater.data.standings.get_position(team_name_full, season)
    return Team(names, position, team_logo_url)


def get_form(team_name: str) -> Form:
    form, teams_played, rating, won_against_star_team = updater.data.form.get_recent_form(team_name)
    # Replace boolean value with css tags
    won_against_star_team = ['star-team' if val else 'not-star-team' for val in won_against_star_team]
    # Replace team names with initials
    teams_played = [utils.convert_team_name_or_initials(team_name) for team_name in teams_played]
    return Form(form, teams_played, rating, won_against_star_team)


def get_season_stats(team_name: str) -> SeasonStats:
    clean_sheets, goals_per_game, conceded_per_game = updater.data.season_stats.get_season_stats(team_name)
    return SeasonStats(Stat(*clean_sheets), Stat(*goals_per_game), Stat(*conceded_per_game))


def get_next_game(team_name: str) -> NextGame:
    opp_team_name_full, at_home, prev_matches = updater.data.upcoming.get_details(team_name)
    opp_team_name = opp_team_name_full[:-3]  # Remove 'FC' from end
    opp_team_name_hyphen = (opp_team_name.lower()).replace(' ', '-')
    names = TeamNames(opp_team_name_full, opp_team_name, opp_team_name_hyphen)
    
    opp_form_rating = updater.data.form.get_current_form_rating(opp_team_name_full)
    opp_logo_url = updater.data.logo_urls[opp_team_name_full]
    opp_team = OppTeam(names, opp_form_rating, opp_logo_url)
    
    home_away = 'Home' if at_home else 'Away'
    return NextGame(opp_team, home_away, prev_matches)


def get_prediction(team_name: str) -> Prediction:
    scoreline = updater.data.upcoming._get_next_game_prediction_scoreline(team_name)
    accuracy, results_accuracy = updater.data.upcoming.predictions.get_accuracy()
    return Prediction(scoreline, accuracy, results_accuracy)


def get_table_snippet(team_name: str) -> TableSnippet:
    rows, team_table_idx = updater.data.standings.get_table_snippet(team_name, season)
    return TableSnippet(rows, team_table_idx)


def get_params(team_name_hyphen: str) -> TeamParams:
    team = get_team(team_name_hyphen)
    form = get_form(team.names.full_name)
    season_stats = get_season_stats(team.names.full_name)
    next_game = get_next_game(team.names.full_name)
    prediction = get_prediction(team.names.full_name)
    table_snippet = get_table_snippet(team.names.full_name)
    last_updated = updater.last_updated
    return TeamParams(season, team, form, season_stats, next_game, prediction, 
                      table_snippet, last_updated)


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
# @app.route('/bournemouth')
# @app.route('/huddersfield-town')
def team() -> str:
    if (rule := request.url_rule) is not None:
        # Get hypehenated team name from current URL
        team_name_hyphen = rule.rule[1:]
    params = get_params(team_name_hyphen)
    return render_template('team.html', params=params)


# ------------------------------ PREDICTIONS PAGE ------------------------------

@dataclass
class PredictionsParams:
    predictions: list
    accuracy: float
    results_accuracy: float
    last_updated: str


def extract_int_score(scoreline: str) -> tuple[int, int]:
    # Scoreline: "[home_team_initials] [home_goals] - [away_goals] [away_team_initials]"
    _, home_goals, _, away_goals, _ = scoreline.split(' ')
    return int(home_goals), int(away_goals)


def correct_result(ph, pa, ah, aa) -> bool:
    # If identical results (both a home win, draw, or away win)
    return (ph > pa and ah > aa) or (ph == pa and ah == aa) or (ph < pa and ah < aa)


def insert_predictions_colours(predictions: list):
    for pred in predictions:
        if pred['actual'] is None:
            pred['colour'] = ''  # No colour
        else:
            ph = pred['prediction']['homeGoals']
            pa = pred['prediction']['awayGoals']
            ah = pred['actual']['homeGoals']
            aa = pred['actual']['awayGoals']
            
            if ph == ah and pa == aa:
                pred['colour'] = 'green'  # Predicted perfectly
            elif correct_result(ph, pa, ah, aa):
                pred['colour'] = 'yellow'  # Predicted result
            else:
                pred['colour'] = 'red'  # Prediction failed

def insert_time(predictions: list):
    for pred in predictions:
        pred['time'] = pred['datetime'].strftime('%H:%M')

def group_by_date(predictions: dict) -> defaultdict:
    grouped_predictions = defaultdict(deque)
    
    for prediction in predictions:
        date = prediction['datetime'].strftime('%Y-%m-%d')
        grouped_predictions[date].appendleft(prediction)
        
    return grouped_predictions

@app.route('/predictions')
def predictions() -> str:
    predictions = updater.data.upcoming.predictions.get_predictions()
    
    insert_predictions_colours(predictions)
    insert_time(predictions)
    
    predictions = group_by_date(predictions)

    accuracy, results_accuracy = updater.data.upcoming.predictions.get_accuracy()

    last_updated = updater.last_updated

    params = PredictionsParams(predictions, accuracy, results_accuracy, last_updated)
    return render_template('predictions.html', params=params)


@app.route('/predictions/json')
def predictions_json() -> str:
    with open(f'data/predictions_{season}.json') as f:
        json_data = json.load(f)
    return jsonify(json_data)


# --------------------------------- DATA PAGE ----------------------------------

@dataclass
class TableParams:
    last_updated: str


@app.route('/tables')
@app.route('/data')
def tables() -> str:
    last_updated = updater.last_updated
    params = TableParams(last_updated)
    return render_template('tables.html', params=params)


def thread_function(time: int = 3600):
    while True:
        print(f'Refreshing data in {time} seconds...')
        sleep(time)
        print('Refreshing data...')
        updater.update_all()


updater = Updater(season)
data_updater_thread = Thread(target=thread_function, args=(1800,))
updater.update_all()
data_updater_thread.start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=False)
from dataclasses import dataclass
from threading import Thread
from time import sleep

from flask import Flask, render_template, request
from flask_compress import Compress
from pandas.core.frame import DataFrame

from updater import Updater

season = 2021

compress = Compress()
app = Flask(__name__)
compress.init_app(app)


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
class Team:
    name: str
    name_hyphen: str
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
class SeasonStats:
    clean_sheet_ratio: float
    csr_position: str  # Ordinal position e.g. '1st'
    goals_per_game: float
    gpg_position: str
    conceded_per_game: float
    cpg_position: str

@dataclass
class OppTeam:
    name: str
    name_hyphen: str
    form_rating: float
    logo_url: str

@dataclass
class NextGame:
    opp_team: OppTeam
    home_away: str
    prev_meetings: list[tuple]

@dataclass
class Prediction:
    score_prediction: tuple[str, str]
    accuracy: float
    results_accuracy: float

# ------------------------------- TEAM PAGE ------------------------------------

@dataclass
class TeamParams:
    season: int
    title: str
    team: Team
    form: Form
    season_stats: SeasonStats
    next_game: NextGame
    prediction: Prediction
    table_snippet: TableSnippet
    last_updated: str

def get_team(title: str, team_name_hyphen: str) -> Team:
    team_name = title + ' FC'
    team_logo_url = updater.logo_urls[team_name]
    position = updater.data.standings.get_position(team_name, season)

    return Team(team_name, team_name_hyphen, position, team_logo_url)

def get_form(team_name: str) -> Form:
    form_str, recent_teams_played, rating, won_against_star_team = updater.data.form.get_recent_form(team_name)

    return Form(form_str, recent_teams_played, rating, won_against_star_team)

def get_season_stats(team_name: str) -> SeasonStats:
    csr, csr_position, gpg, gpg_position, cpg, cpg_position= updater.data.season_stats.get_season_stats(team_name)

    return SeasonStats(csr, csr_position, gpg, gpg_position, cpg, cpg_position)

def get_next_game(team_name: str) -> NextGame:
    opp_team_name, home_away, prev_meetings = updater.data.upcoming.get_details(
        team_name)
    opp_team_name_hyphen = (opp_team_name.lower(
    )[:-3]).replace(' ', '-')  # Remove 'FC' from end
    opp_form_rating = updater.data.form.get_current_form_rating(opp_team_name)
    opp_logo_url = updater.logo_urls[opp_team_name]

    opp_team = OppTeam(opp_team_name, opp_team_name_hyphen, opp_form_rating, opp_logo_url)
    return NextGame(opp_team, home_away, prev_meetings)

def get_prediction(team_name: str) -> Prediction:
    score_prediction = updater.predictor.get_next_game_prediction(team_name)
    accuracy, results_accuracy = updater.predictor.get_accuracy()

    return Prediction(score_prediction, accuracy, results_accuracy)

def get_table_snippet(team_name: str) -> TableSnippet:
    rows, team_table_idx = updater.data.standings.get_table_snippet(
        team_name, season)

    return TableSnippet(rows, team_table_idx)

def get_params(team_name_hyphen: str) -> TeamParams:
    title = team_name_hyphen.replace('-', ' ').title().replace('And', 'and')

    team = get_team(title, team_name_hyphen)
    form = get_form(team.name)
    season_stats = get_season_stats(team.name)
    next_game = get_next_game(team.name)
    prediction = get_prediction(team.name)
    table_snippet = get_table_snippet(team.name)

    last_updated = updater.last_updated

    return TeamParams(season, title, team, form, season_stats, next_game, prediction, table_snippet, last_updated)

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
    if (rule := request.url_rule) != None:
        # Get hypehenated team name from current URL
        team_name_hyphen = rule.rule[1:]
    params = get_params(team_name_hyphen)

    return render_template('team.html', params=params)

# ------------------------------ PREDICTIONS PAGE ------------------------------

@dataclass
class PredictionsParams:
    predictions: dict
    accuracy: float
    results_accuracy: float
    last_updated: str

def extract_int_score(scoreline: str) -> tuple[int, int]:
    # Scoreline: [home_team_initials] [home_goals] - [away_goals] [away_team_initials]
    _, home_goals, _, away_goals, _ = scoreline.split(' ')
    return int(home_goals), int(away_goals) 


def correct_result(scoreline1: str, scoreline2: str) -> bool:
    h1, a1 = extract_int_score(scoreline1)
    h2, a2 = extract_int_score(scoreline2)

    # If identical results (both a home win, draw, or away win)
    return (h1 > a1 and h2 > a2) or (h1 == a1 and h2 == a2) or (h1 < a1 and h2 < a2)

def insert_predictions_colours(predictions: dict):
    for date in predictions.keys():
        for pred in predictions[date]:
            if pred['actual'] == None:
                pred['colour'] = ''  # No colour
            elif pred['prediction'] == pred['actual']:
                pred['colour'] = 'green'
            elif correct_result(pred['prediction'], pred['actual']):
                pred['colour'] = 'yellow'
            else:
                pred['colour'] = 'red'

@app.route('/predictions')
def predictions() -> str:
    predictions = updater.predictor.get_predictions()
    predictions = dict(sorted(predictions.items(), reverse=True))
    insert_predictions_colours(predictions)

    accuracy, results_accuracy = updater.predictor.get_accuracy()

    last_updated = updater.last_updated

    params = PredictionsParams(predictions, accuracy, results_accuracy, last_updated)
    return render_template('predictions.html', params=params)




def thread_function(time=3600):
    while True:
        print(f'Updating data in {time} seconds...')
        sleep(time)
        updater.update_all(request_new=True, display_tables=False)

updater = Updater(season)
data_updater_thread = Thread(target=thread_function, args=(3600,))
updater.update_all(request_new=False, display_tables=False)
data_updater_thread.start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=False)

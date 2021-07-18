from data import Data
from flask import Flask, render_template, request

season = 2021

class Params:
    def __init__(self, 
                 season=season, 
                 title=None, 
                 team_name=None, 
                 team_name_hyphenated=None, 
                 position=None, 
                 form=None, 
                 recent_teams_played=None, 
                 form_rating=None, 
                 clean_sheet_ratio=None, 
                 goals_per_game=None, 
                 conceded_per_game=None, 
                 won_against_star_team=None, 
                 team_playing_next_name_hypenated=None, 
                 team_playing_next_form_rating=None, 
                 team_playing_next_home_away=None, 
                 team_playing_prev_meetings=None, 
                 score_prediction=None, 
                 table_snippet=None, 
                 table_index_of_this_team=None):
        self.season = season
        self.title = title
        self.team_name = team_name
        self.team_name_hyphenated = team_name_hyphenated
        self.position = position
        self.form = form
        self.recent_teams_played = recent_teams_played
        self.form_rating = form_rating
        self.clean_sheet_ratio = clean_sheet_ratio
        self.goals_per_game = goals_per_game
        self.conceded_per_game = conceded_per_game
        self.won_against_star_team = won_against_star_team
        self.team_playing_next_name_hypenated = team_playing_next_name_hypenated
        self.team_playing_next_form_rating = team_playing_next_form_rating
        self.team_playing_next_home_away = team_playing_next_home_away
        self.team_playing_prev_meetings = team_playing_prev_meetings
        self.score_prediction = score_prediction
        self.table_snippet = table_snippet
        self.table_index_of_this_team = table_index_of_this_team

app = Flask(__name__)

@app.route("/")
@app.route("/home")
def home():
    params = Params(title='Premier League')
    return render_template('home.html', params=params)

def getTeamPageData(team_name_hyphenated):
    title = team_name_hyphenated.replace('-', ' ').title().replace('And', 'and')
    team_name = title + ' FC'
    # Get data values to display on team webpage
    position = data.standings.getPosition(team_name, season)
    form, recent_teams_played, form_rating, won_against_star_team = data.form.getRecentForm(team_name)
    clean_sheet_ratio, goals_per_game, conceded_per_game = data.season_stats.getSeasonStats(team_name)
    team_playing_next_name, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings, score_prediction = data.getNextGameDetails(team_name)
    table_snippet, table_index_of_this_team = data.standings.getTableSnippet(team_name, season)
    team_playing_next_name_hypenated = '-'.join(team_playing_next_name.lower().split(' ')[:-1])  # Remove 'FC' from end
    
    params = Params(season, title, team_name, team_name_hyphenated, position, form, recent_teams_played, form_rating, clean_sheet_ratio, goals_per_game, conceded_per_game, won_against_star_team, team_playing_next_name_hypenated, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings, score_prediction, table_snippet, table_index_of_this_team)
    
    return params

@app.route("/liverpool")
@app.route("/manchester-city")
@app.route("/manchester-united")
@app.route("/chelsea")
@app.route("/leicester-city")
@app.route("/tottenham-hotspur")
@app.route("/wolverhampton-wanderers")
@app.route("/arsenal")
@app.route("/sheffield-united")
@app.route("/burnley")
@app.route("/southampton")
@app.route("/everton")
@app.route("/newcastle-united")
@app.route("/crystal-palace")
@app.route("/brighton-and-hove-albion")
@app.route("/west-ham-united")
@app.route("/aston-villa")
@app.route("/leeds-united")
@app.route("/west-bromwich-albion")
@app.route("/fulham")
def team():
    rule = request.url_rule
    team_name_hyphenated = rule.rule[1:]  # Get hypehenated team name from current URL
    params = getTeamPageData(team_name_hyphenated)
        
    return render_template('team.html', params=params)



if __name__ == '__main__':
    data = Data(season)
    # Update data and graphs
    data.updateAll(request_new=True, display_tables=True)
    
    app.run(host='0.0.0.0', debug=False)
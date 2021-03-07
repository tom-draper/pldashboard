from data import Data
from flask import Flask, render_template, request
import time
from threading import Thread, Lock
app = Flask(__name__)


@app.route("/")
@app.route("/home")
def home():
    return render_template('home.html', team_name_hyphenated="None")

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
    team_name = team_name_hyphenated.replace('-', ' ').title().replace('And', 'and') + ' FC'
    
    position, form, recent_teams_played, form_rating, won_against_star_team, team_playing_next_name_hypenated, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings, table_snippet, table_index_of_this_team = data.get_team_page_data(team_name)
    print(position, form, recent_teams_played, form_rating, won_against_star_team, team_playing_next_name_hypenated, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings, table_snippet, table_index_of_this_team)
        
    return render_template('team.html', 
                           team_name_hyphenated=team_name_hyphenated,
                           position=position, 
                           form=form,
                           recent_teams_played=recent_teams_played,
                           team_playing_next_name_hypenated=team_playing_next_name_hypenated,
                           team_playing_next_form_rating=team_playing_next_form_rating,
                           team_playing_next_home_away=team_playing_next_home_away,
                           team_playing_prev_meetings=team_playing_prev_meetings,
                           won_against_star_team=won_against_star_team,
                           form_rating=form_rating,
                           table_snippet=table_snippet,
                           table_index_of_this_team=table_index_of_this_team)


class SharedData:
    def __init__(self, season):
        self.data = Data(season)
        self.lock = Lock()
    
    def get_team_page_data(self, team_name):
        self.lock.acquire()
        # Get data values to display on team webpage
        position = self.data.getPosition(team_name)
        form, recent_teams_played, form_rating, won_against_star_team = self.data.getRecentForm(team_name)
        team_playing_next_name, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings = self.data.getNextGame(team_name)
        team_playing_next_name_hypenated = '-'.join(team_playing_next_name.lower().split(' ')[:-1])  # Remove 'FC' from end
        table_snippet, table_index_of_this_team = self.data.getTableSnippet(team_name)
        self.lock.release()
        return position, form, recent_teams_played, form_rating, won_against_star_team, team_playing_next_name_hypenated, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings, table_snippet, table_index_of_this_team

    def updateAll(self):
        self.lock.acquire()
        self.data.updateAll(3, team_name=None, display_tables=False, display_graphs=False, request_new=False)
        self.lock.release()


def data_updater(data, time_interval):
    while True:
        time.sleep(time_interval)
        print("Updating data...")
        data.updateAll()



if __name__ == '__main__':
    # Refresh data and graphs
    data = SharedData(2020)
    data.updateAll()
    
    updater = Thread(target=data_updater, kwargs={'data': data, 'time_interval': 3600})
    # updater.start()
    
    # Begin web app
    app.run(host='0.0.0.0', debug=False)
    
    # updater.join()
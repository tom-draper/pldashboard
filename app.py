from refresh import DataRefresh
from flask import Flask, render_template, request
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

    # Get data values to display on team webpage
    position = r.data.getPosition(team_name)
    form = r.data.getForm(team_name)
    recent_teams_played = r.data.getRecentTeamsPlayed(team_name)
    form_rating = r.data.getCurrentFormRating(team_name)
    won_against_star_team = r.data.getWonAgainstStarTeam(team_name)
        
    team_playing_next_name = r.data.getNextTeamToPlay(team_name)
    team_playing_next_name_hypenated = '-'.join(team_playing_next_name.lower().split(' ')[:-1])  # Remove 'FC' from end
    team_playing_next_form_rating = r.data.getCurrentFormRating(team_playing_next_name)
    team_playing_next_home_away = r.data.getNextGameHomeAway(team_name)
    team_playing_prev_meetings = r.data.getPreviousMeetings(team_name)
    
    table_snippet, table_index_of_this_team = r.data.getTableSnippet(team_name)
        
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


if __name__ == '__main__':
    # Refresh data and graphs
    r = DataRefresh(2020)
    r.updateAll(3, team_name=None, display_tables=False, display_graphs=False, request_new=True)
    # Begin web app
    app.run(host='0.0.0.0', debug=False)
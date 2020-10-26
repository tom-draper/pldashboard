from data import Data
from flask import Flask, render_template, request
app = Flask(__name__)

season = 2020
data = Data(season)


@app.route("/")
@app.route("/home")
def hello():
    return render_template('home.html', team="None")


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
    
    team_name = rule.rule[1:]  # Get hypehenated team name from current URL
    full_team_name = team_name.replace('-', ' ').title().replace('And', 'and') + ' FC'

    # Get data values to display on team webpage
    position = data.getPosition(full_team_name)
    form = data.getForm(full_team_name)
    recent_teams_played = data.getRecentTeamsPlayed(full_team_name)
    form_rating = data.getCurrentFormRating(full_team_name)
    won_against_star_team = data.getWonAgainstStarTeam(full_team_name)
    table_snippet, table_css_styles = data.getTableSnippet(full_team_name)
    
    
    return render_template('team.html', 
                           team=team_name,
                           position=position, 
                           form=form,
                           recent_teams_played=recent_teams_played,
                           won_against_star_team=won_against_star_team,
                           form_rating=form_rating,
                           table_snippet=table_snippet,
                           table_css_styles=table_css_styles)


if __name__ == '__main__':
    data.updateAll(3, team=None, display_tables=False, display_graphs=False, request_new=True)
    app.run(debug=False)

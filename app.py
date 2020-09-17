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
    team_name = rule.rule[1:]
    
    position = data.standings.loc[team_name.replace('-', ' ').title().replace('And', 'and') + ' FC', f'{season}']['Position']
    
    form = data.form.loc[team_name.replace('-', ' ').title().replace('And', 'and') + ' FC']['Form']
    if form == None:
        form = []
    form = list(form) + ['None'] * (5 - len(form))  # Pad list
    
    recent_teams_played = data.form.loc[team_name.replace('-', ' ').title().replace('And', 'and') + ' FC']['Teams Played']
    
    form_rating = data.form.loc[team_name.replace('-', ' ').title().replace('And', 'and') + ' FC']['Current Form Rating %'].round(1)

    return render_template('team.html', team=team_name, position=position, form=form, recent_teams_played=recent_teams_played, form_rating=form_rating)


if __name__ == '__main__':
    data.updateAll(3, team=None, display_tables=False, display_graphs=False, request_new=True)
    app.run(debug=False)

    
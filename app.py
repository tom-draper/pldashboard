from flask import Flask, render_template, request
app = Flask(__name__)

@app.route("/")
@app.route("/home")
def hello():
    return render_template('home.html', team="None")

@app.route("/liverpool")
@app.route("/manchester-city")
@app.route("/manchester-united")
@app.route("/chelsea")
@app.route("/leicester")
@app.route("/spurs")
@app.route("/wovles")
@app.route("/arsenal")
@app.route("/sheffield-united")
@app.route("/burnley")
@app.route("/southampton")
@app.route("/everton")
@app.route("/newcastle")
@app.route("/crystal-palace")
@app.route("/brighton")
@app.route("/west-ham")
@app.route("/aston-villa")
@app.route("/leeds-united")
@app.route("/west-brom")
@app.route("/fulham")
def team():
    rule = request.url_rule
    team_name = rule.rule[1:]
    return render_template('team.html', team=team_name)


if __name__ == '__main__':
    app.run(debug=True)
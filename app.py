from flask import Flask, render_template
app = Flask(__name__)

@app.route("/")
@app.route("/home")
def hello():
    return render_template('home.html')

@app.route("/liverpool")
def liverpool():
    return render_template('team.html')

@app.route("/manchester-city")
def manchesterCity():
    return render_template('team.html')

@app.route("/manchester-united")
def manchesterUnited():
    return render_template('team.html')

@app.route("/chelsea")
def chelsea():
    return render_template('team.html')

if __name__ == '__main__':
    app.run(debug=True)
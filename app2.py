from flask import Flask, jsonify
from utilities import Utilities
from database import Database

season = 2021

app = Flask(__name__)

utils = Utilities()
database = Database()

@app.route('/teams')
def team() -> str:
    teams_data = database.get_teams_data()
    return jsonify(teams_data)

@app.route('/predictions')
def predictions() -> str:
    predictions = database.get_predictions()
    accuracy = database.get_prediction_accuracy()
    
    predictions_data = {
        'predictions': predictions,
        'accuracy': accuracy
    }
    
    return jsonify(predictions_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=False)

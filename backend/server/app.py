import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify
from flask_cors import CORS, cross_origin
from lib.database.database import Database

season = 2022

app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADER'] = 'Content-Type'

database = Database(season)

@app.route('/api/teams')
@cross_origin()
def team() -> str:
    teams_data = database.get_teams_data()
    return jsonify(teams_data)

@app.route('/api/predictions')
@cross_origin()
def predictions() -> str:
    predictions = database.get_predictions()
    accuracy = database.get_prediction_accuracy()
    
    predictions_data = {
        'predictions': predictions,
        'accuracy': accuracy
    }
    
    return jsonify(predictions_data)

if __name__ == '__main__':
    app.run(debug=False)
    # app.run(host='0.0.0.0', debug=False)

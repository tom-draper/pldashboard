from lib.database.database import Database
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import uvicorn
import os
import sys
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


season = 2022

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

database = Database(season)
cache = {
    'team': {
        'time': None, 
        'data': None
    }, 
    'predictions': {
        'time': None, 
        'data': None
    }
}


def recent_cache(date: datetime) -> bool:
    return (datetime.now() - date).total_seconds() < 30


@app.get('/api/teams')
async def team() -> str:
    print(cache)
    if cache['team']['data'] is not None and recent_cache(cache['team']['time']):
        teams_data = cache['team']['data']
    else:
        teams_data = await database.get_teams_data()
        cache['team']['data'] = teams_data
        cache['team']['time'] = datetime.now()
    return teams_data


@app.get('/api/predictions')
async def predictions() -> str:
    predictions = await database.get_predictions()
    return predictions


if __name__ == "__main__":
    uvicorn.run("server.app:app", reload=True)

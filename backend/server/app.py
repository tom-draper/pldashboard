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
    'teams_data': None,
    'last_requested': None
}


def in_last_n_mins(date: datetime, mins: int):
    return date > (datetime.now() - timedelta(minutes=1))

@app.get('/api/teams')
async def team() -> str:
    if cache['last_requested'] is not None and in_last_n_mins(cache['last_requested'], 1):
        return cache['teams_data']
    else:
        teams_data = await database.get_teams_data()
        cache['teams_data'] = teams_data
        cache['last_requested'] = datetime.now()
        return teams_data


@app.get('/api/predictions')
async def predictions() -> str:
    predictions = await database.get_predictions()
    return predictions


if __name__ == "__main__":
    uvicorn.run("server.app:app", reload=True)

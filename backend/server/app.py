from lib.database.database import Database
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import uvicorn
import os
import sys

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


@app.get('/api/teams')
async def team() -> str:
    teams_data = await database.get_teams_data()
    return teams_data


@app.get('/api/predictions')
async def predictions() -> str:
    predictions = await database.get_predictions()
    return predictions


if __name__ == "__main__":
    uvicorn.run("server.app:app", reload=True)

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime
from os.path import dirname, join

import requests
from lib.database.database import Database
from dotenv import load_dotenv
from timebudget import timebudget

from data import Data

from lib.utils.utilities import Utilities

utils = Utilities()

class Updater:
    def __init__(self, current_season: int):
        self.current_season = current_season
        self.data = Data(current_season)
        self.database = Database(current_season)

        # Import environment variables
        __file__ = 'updater.py'
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        self.url = os.getenv('URL')
        self.headers = {'X-Auth-Token': os.getenv('X_AUTH_TOKEN')}

        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 6
        self.star_team_threshold = 0.75  # Rating over 75% to be a star team

        # Store for new requested API data or old data from memory
        self.json_data = {'fixtures': {}, 'standings': {}}
        self.last_updated = None  # type: str

    # ----------------------------- DATA API -----------------------------------

    def fixtures_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url is not None:
            res = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                    headers=self.headers)
            
            code = res.status_code
            if code == 429 or code == 403:
                print('❌  Status:', code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', code)

            return res.json()['matches']
        else:
            # Read saved fixtures data
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def standings_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url is not None:
            res = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season),
                                    headers=self.headers)

            code = res.status_code
            if code == 429 or code == 403:
                print('❌  Status:', code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', code)

            return res.json()['standings'][0]['table']
        else:
            # Read standings data
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)
        
    def fetch_current_season(self, request_new: bool):
        # Fetch data from API (max this season and last season)
        self.json_data['fixtures'][self.current_season] = self.fixtures_data(self.current_season, request_new)
        self.json_data['standings'][self.current_season] = self.standings_data(self.current_season, request_new)
    
    def load_previous_fixtures(self, n_seasons: int):
        for i in range(1, n_seasons):
            season = self.current_season - i
            self.json_data['fixtures'][season] = self.fixtures_data(season, request_new=False)
            self.json_data['standings'][season] = self.standings_data(season, request_new=False)

    def fetch_json_data(self, n_seasons: int, request_new: bool = True):
        self.fetch_current_season(request_new)
        self.load_previous_fixtures(n_seasons)

        if request_new:
            self.last_updated = datetime.now()

    def save_data_to_json(self):
        """ Save current season fixtures and standings data in self.json_data to 
            json files. """
        for type in ('fixtures', 'standings'):
            with open(f'data/{type}_{self.current_season}.json', 'w') as f:
                json.dump(self.json_data[type][self.current_season], f)


    def _build_dataframes(self, n_seasons: int, display_tables: bool = False, 
                          update_db: bool = True):
        # Standings for the last [n_seasons] seasons
        self.data.standings.build(
            self.json_data, 
            self.data.team_names,
            self.current_season, 
            n_seasons, 
            display=display_tables
        )
        # Fixtures for the whole season for each team
        self.data.fixtures.build(
            self.json_data, 
            self.current_season, 
            display=display_tables
        )
        # Ratings for each team, based on last <no_seasons> seasons standings table
        self.data.team_ratings.build(
            self.data.standings, 
            self.current_season,
            self.games_threshold, 
            n_seasons,
            display=display_tables
        )
        # Calculated values to represent the personalised advantage each team has at home
        self.data.home_advantages.build(
            self.json_data, 
            self.current_season,
            self.home_games_threshold, 
            n_seasons,
            display=display_tables
        )
        # Calculated form values for each team for each matchday played so far
        self.data.form.build(
            self.data.fixtures, 
            self.data.team_ratings,
            self.current_season,
            self.star_team_threshold, 
            display=display_tables
        )
        # Season metrics
        self.data.season_stats.build(
            self.data.form, 
            display=display_tables
        )
        # Data about the opponent in each team's next game
        self.data.upcoming.build(
            self.json_data, 
            self.data.fixtures, 
            self.data.form, 
            self.data.home_advantages, 
            self.data.team_names, 
            self.current_season, 
            n_seasons, 
            display=display_tables,
            update_db=update_db
        )
    
    def save_team_data_to_database(self):
        team_data = self.data.to_dict()
        self.database.update_team_data(team_data)
        
    def get_logo_urls(self) -> dict[str, str]:
        data = self.json_data['standings'][self.current_season]

        logo_urls = {}
        for standings_row in data:
            team_name = utils.clean_full_team_name(standings_row['team']['name'])
            crest_url = standings_row['team']['crestUrl']
            logo_urls[team_name] = crest_url

        return logo_urls
        
    def build_dataframes(self, n_seasons, display_tables, update_db):
        self.data.last_updated = self.last_updated
        self.data.logo_urls = self.get_logo_urls()
        self.data.team_names = list(self.data.logo_urls.keys())
        # Build using stored data in self.json_data
        self._build_dataframes(n_seasons, display_tables, update_db)
    
    @timebudget
    def build_all(
            self, 
            n_seasons: int = 4, 
            display_tables: bool = False, 
            request_new: bool = True,
            update_db: bool = True
        ):
        try:
            self.fetch_json_data(n_seasons, request_new)
        except ValueError as e:
            print(e)
            print('🔁 Retrying with saved data...')
            request_new = False
            self.fetch_json_data(n_seasons, request_new)
            
        self.build_dataframes(n_seasons, display_tables, update_db)

        if request_new:
            print('💾 Saving new data as JSON files...')
            self.save_data_to_json()
            if update_db:
                print('💾 Saving new data to database...')
                self.save_team_data_to_database()
                # TODO: Save predictions to database...
                #self.database.update_predictions(predictions)


if __name__ == "__main__":
    # Build all dataframes and save to database
    updater = Updater(2022)
    updater.build_all(
        request_new=True, 
        display_tables=True, 
        update_db=True,
    )

import json
import os
from datetime import datetime
from os.path import dirname, join

import requests
from dotenv import load_dotenv
from timebudget import timebudget

from data import Data
from utilities import Utilities
from visualiser import Visualiser

utilities = Utilities()


class Updater:
    def __init__(self, current_season: int):
        self.current_season = current_season
        self.data = Data(current_season)
        self.visualiser = Visualiser()

        # Import environment variables
        __file__ = 'data.py'
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        self.url = os.getenv('URL')
        self.api = os.getenv('API')
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
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                    headers=self.headers)
            
            code = response.status_code
            if code== 429 or code == 403:
                print('❌  Status:', code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', code)

            return response.json()['matches']
        else:
            # Read saved fixtures data
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def standings_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url is not None:
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season),
                                    headers=self.headers)

            code = response.status_code
            if code == 429 or code == 403:
                print('❌  Status:', code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', code)

            return response.json()['standings'][0]['table']
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
            self.last_updated = datetime.now().strftime('Last updated: %Y-%m-%d %H:%M:%S')

    def save_data(self):
        """Save current season fixtures and standings data in self.json_data to 
        json files."""
        for type in ('fixtures', 'standings'):
            with open(f'data/{type}_{self.current_season}.json', 'w') as f:
                json.dump(self.json_data[type][self.current_season], f)

    def get_logo_urls(self) -> dict[str, str]:
        data = self.json_data['standings'][self.current_season]

        logo_urls = {}
        for standings_row in data:
            team_name = standings_row['team']['name'].replace('&', 'and')
            crest_url = standings_row['team']['crestUrl']
            logo_urls[team_name] = crest_url

        return logo_urls

    def update_dataframes(self, n_seasons: int, display_tables: bool = False):
        # Standings for the last [n_seasons] seasons
        self.data.standings.update(self.json_data, self.data.team_names,
                                   self.current_season, n_seasons, display=display_tables)
        # Fixtures for the whole season for each team
        self.data.fixtures.update(self.json_data, self.current_season, display=display_tables)
        # Ratings for each team, based on last <no_seasons> seasons standings table
        self.data.team_ratings.update(self.data.standings, self.current_season,
                                      self.games_threshold, n_seasons, display=display_tables)
        # Calculated values to represent the personalised advantage each team has at home
        self.data.home_advantages.update(self.json_data, self.current_season,
                                         self.home_games_threshold, n_seasons,
                                         display=display_tables)
        # Calculated form values for each team for each matchday played so far
        self.data.form.update(self.data.fixtures, self.data.standings, 
                              self.data.team_ratings, self.star_team_threshold, 
                              display=display_tables)
        # Season metrics
        self.data.season_stats.update(self.data.form, display=display_tables)
        # Data about the opponent in each team's next game
        self.data.upcoming.update(self.json_data, self.data.fixtures, self.data.form, 
                                  self.data.home_advantages, self.data.team_names, 
                                  self.current_season, n_seasons, display=display_tables)
        
        

    def save_tables(self):
        self.data.standings._save_to_html()
        self.data.fixtures._save_to_html()
        self.data.team_ratings._save_to_html()
        self.data.home_advantages._save_to_html()
        self.data.form._save_to_html()
        self.data.upcoming._save_to_html()
        self.data.season_stats._save_to_html()
    
    def update_data(self, n_seasons, display_tables):
        self.data.logo_urls = self.get_logo_urls()
        self.data.team_names = self.data.logo_urls.keys()
        # Using stored data in self.json_data
        self.update_dataframes(n_seasons, display_tables)
    
    @timebudget
    def update_all(self, n_seasons: int = 4, team_name: str = '', 
                   display_tables: bool = False, display_graphs: bool = False, 
                   request_new: bool = True):
        try:
            self.fetch_json_data(n_seasons, request_new)
        except ValueError as e:
            print(e)
            print('🔁 Retrying with saved data...')
            request_new = False
            self.fetch_json_data(n_seasons, request_new)

        self.update_data(n_seasons, display_tables)

        if request_new:
            print('💾 Saving new data as JSON files...')
            self.save_data()
            print('💾 Saving tables as HTML files...')
            self.save_tables()
            # Use dataframes to update all graph HTML files
            self.visualiser.update(self.data.fixtures, self.data.team_ratings,
                                   self.data.home_advantages, self.data.form,
                                   display_graphs=display_graphs, team=team_name)


if __name__ == "__main__":
    # Update all dataframes
    updater = Updater(2021)
    updater.update_all(request_new=True, team_name='Liverpool FC', display_tables=True, display_graphs=False)

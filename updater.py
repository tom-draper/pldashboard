from datetime import datetime
import json
import os
from os.path import dirname, join

import requests
from dotenv import load_dotenv
from timebudget import timebudget

from data import Data
from visualiser import Visualiser
from predictor import Predictor
from utilities import Utilities

utilities = Utilities()


class Updater:
    def __init__(self, current_season: int):
        self.season = current_season

        self.data = Data()
        self.predictor = Predictor(current_season)
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
        self.home_games_threshold = 4
        self.star_team_threshold = 0.75  # Rating over 75% to be a star team

        # Store for new requested API data or old data from memory
        self.json_data = {'fixtures': {}, 'standings': {}}
        self.last_updated = ''

    # ----------------------------- DATA API -----------------------------------

    def fixtures_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url != None:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                    headers=self.headers)
            
            if response.status_code == 429 or response.status_code == 403:
                print('❌  Status:', response.status_code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', response.status_code)

            return response.json()['matches']
        else:
            # Read saved fixtures data
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def standings_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url != None:
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season),
                                    headers=self.headers)

            if response.status_code == 429 or response.status_code == 403:
                print('❌  Status:', response.status_code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', response.status_code)

            return response.json()['standings'][0]['table']
        else:
            # Read standings data
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)
        
    def fetch_current_season(self, request_new):
        # Fetch data from API (max this season and last season)
        self.json_data['fixtures'][self.season] = self.fixtures_data(self.season, request_new)
        self.json_data['standings'][self.season] = self.standings_data(self.season, request_new)
    
    def load_previous_fixtures(self, n_seasons):
        for i in range(1, n_seasons):
            season = self.season - i
            self.json_data['fixtures'][season] = self.fixtures_data(season, request_new=False)

    def fetch_data(self, n_seasons: int, request_new: bool = True):
        self.fetch_current_season(request_new)
        self.load_previous_fixtures(n_seasons)

        if request_new:
            self.last_updated = datetime.now().strftime('Last updated: %d-%m-%y %H:%M:%S')

    def save_data(self):
        for data_type in self.json_data.keys():
            for season, data in self.json_data[data_type].items():
                with open(f'data/{data_type}_{season}.json', 'w') as json_file:
                    json.dump(data, json_file)

    def get_logo_urls(self) -> dict[str, str]:
        data = self.json_data['standings'][self.season]

        logo_urls = {}
        for standings_row in data:
            team_name = standings_row['team']['name'].replace('&', 'and')
            crest_url = standings_row['team']['crestUrl']
            logo_urls[team_name] = crest_url

        return logo_urls

    def update_all_dataframes(self, n_seasons, display_tables: bool = False):
        # Standings for the last [n_seasons] seasons
        self.data.standings.update(self.json_data,
                                   self.logo_urls.keys(),  # Current season team names
                                   self.season,
                                   n_seasons,
                                   display=display_tables)
        # Fixtures for the whole season for each team
        self.data.fixtures.update(self.json_data,
                                  self.season,
                                  display=display_tables)
        # Ratings for each team, based on last <no_seasons> seasons standings table
        self.data.team_ratings.update(self.data.standings,
                                      self.season,
                                      self.games_threshold,
                                      n_seasons,
                                      display=display_tables)
        # Calculated values to represent the personalised advantage each team has at home
        self.data.home_advantages.update(self.json_data,
                                         self.season,
                                         self.home_games_threshold,
                                         n_seasons,
                                         display=display_tables)
        # Calculated form values for each team for each matchday played so far
        self.data.form.update(self.data.fixtures,
                              self.data.team_ratings,
                              self.star_team_threshold,
                              display=display_tables)
        # Snapshots of a teams table position and match results for each matchday played so far
        self.data.position_over_time.update(self.data.fixtures,
                                            self.data.standings,
                                            display=display_tables)
        # Data about the opponent in each team's next game
        self.data.upcoming.update(self.json_data,
                                  self.data.fixtures,
                                  self.logo_urls.keys(),  # Current season team names
                                  self.season,
                                  n_seasons,
                                  display=display_tables)
        # Season metrics
        self.data.season_stats.update(self.data.position_over_time,
                                      display=display_tables)

    def save_tables(self):
        self.data.standings.save_to_html()
        self.data.fixtures.save_to_html()
        self.data.team_ratings.save_to_html()
        self.data.home_advantages.save_to_html()
        self.data.form.save_to_html()
        self.data.position_over_time.save_to_html()
        self.data.upcoming.save_to_html()
        self.data.season_stats.save_to_html()

    def update_predictions(self):
        self.predictor.update(self.data.fixtures,
                              self.data.form,
                              self.data.upcoming,
                              self.data.home_advantages)
    


    @timebudget
    def update_all(self, n_seasons: int = 3, team_name: str = '', display_tables: bool = False,
                   display_graphs: bool = False, request_new: bool = True):
        try:
            self.fetch_data(n_seasons, request_new)
        except ValueError as e:
            print(e)
            print('🔄 Retrying with saved data...')
            request_new = False
            self.fetch_data(n_seasons, request_new)

        self.logo_urls = self.get_logo_urls()
        # Update using stored json data
        self.update_all_dataframes(n_seasons, display_tables)
        self.update_predictions()

        if request_new or True:
            print('💾 Saving new data as JSON files...')
            self.save_data()
            print('💾 Saving tables as HTML files...')
            self.save_tables()
            # Use dataframes to update all graph HTML files
            self.visualiser.update_all(self.data.fixtures,
                                       self.data.team_ratings,
                                       self.data.home_advantages,
                                       self.data.form,
                                       self.data.position_over_time,
                                       display_graphs=display_graphs,
                                       team=team_name)


if __name__ == "__main__":
    # Update all dataframes
    updater = Updater(2021)
    updater.update_all(request_new=True, team_name='Liverpool FC', display_tables=True, display_graphs=False)

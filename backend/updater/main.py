import json
import logging
import os
import sys
from datetime import datetime
from os.path import dirname, join

import requests
from dotenv import load_dotenv
from timebudget import timebudget
from src.data import Data
from src.dataframes import Fantasy
from src.fmt import clean_full_team_name

# To access database module in parent folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.database import Database


class Updater:
    def __init__(self, current_season: int):
        self.current_season = current_season
        self.data = Data()
        self.fantasy_data = Fantasy()
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
        # self.star_team_threshold = 0.75  # Rating over 75% to be a star team

        # Store for new requested API data or old data from memory
        self.json_data = {'fixtures': {}, 'standings': {}, 'fantasy': {}}
        self.last_updated = None  # type: str

    # ----------------------------- DATA API -----------------------------------

    def fetch_fixtures_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url is not None:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                    headers=self.headers)

            code = response.status_code
            if code == 429 or code == 403:
                logging.info(f'❌  Status: {code}')
                raise ValueError('❌ ERROR: Data request failed')
            else:
                logging.info(f'✔️  Status: {code}')

            return response.json()['matches']
        else:
            # Read saved fixtures data
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def fetch_standings_data(self, season: int, request_new: bool = True) -> dict:
        if request_new and self.url is not None:
            response = requests.get(self.url.replace('/v2', '/v4') + 'competitions/PL/standings/?season={}'.format(season),
                                    headers=self.headers)

            code = response.status_code
            if code == 429 or code == 403:
                logging.info(f'❌  Status: {code}')
                raise ValueError('❌ ERROR: Data request failed')
            else:
                logging.info(f'✔️  Status: {code}')

            return response.json()['standings'][0]['table']
        else:
            # Read standings data
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def fetch_fantasy_data(self, season: int, request_new: bool = True) -> dict:
        if request_new:
            response = requests.get('https://fantasy.premierleague.com/api/bootstrap-static/')

            code = response.status_code
            if code == 429 or code == 403:
                logging.info(f'❌  Status: {code}')
                raise ValueError('❌ ERROR: Data request failed')
            else:
                logging.info(f'✔️  Status: {code}')

            return response.json()
        else:
            # Read saved fixtures data
            with open(f'data/fantasy_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def fetch_current_season(self, request_new: bool):
        # Fetch data from API (max this season and last season)
        self.json_data['fixtures'][self.current_season] = self.fetch_fixtures_data(self.current_season, request_new)
        self.json_data['standings'][self.current_season] = self.fetch_standings_data(self.current_season, request_new)
        self.json_data['fantasy'][self.current_season] = self.fetch_fantasy_data(self.current_season, request_new)

    def load_previous_fixtures(self, n_seasons: int):
        for i in range(1, n_seasons):
            season = self.current_season - i
            self.json_data['fixtures'][season] = self.fetch_fixtures_data(
                season, request_new=False)
            self.json_data['standings'][season] = self.fetch_standings_data(
                season, request_new=False)

    def fetch_json_data(self, n_seasons: int, request_new: bool = True):
        self.fetch_current_season(request_new)
        self.load_previous_fixtures(n_seasons)

        if request_new:
            self.data.last_updated = datetime.now()

    def save_data_to_json(self):
        """ Save current season fixtures and standings data in self.json_data to 
            json files. """
        for type in ('fixtures', 'standings', 'fantasy'):
            with open(f'data/{type}_{self.current_season}.json', 'w') as f:
                json.dump(self.json_data[type][self.current_season], f)

    def build_dataframes(self, n_seasons: int, display_tables: bool = False):
        # Standings for the last [n_seasons] seasons
        self.data.standings.build(
            self.json_data,
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
            self.json_data,
            self.data.team_ratings,
            self.current_season,
            display=display_tables
        )
        # Data about the opponent in each team's next game
        self.data.upcoming.build(
            self.json_data,
            self.data.fixtures,
            self.data.form,
            self.data.team_ratings,
            self.data.home_advantages,
            self.current_season,
            n_seasons,
            display=display_tables
        )
        self.fantasy_data.build(self.json_data)

    def save_team_data_to_db(self):
        team_data = self.data.to_dict()
        self.database.update_team_data(team_data, self.current_season)

    def save_fantasy_data_to_db(self):
        fantasy_data = self.fantasy_data.to_dict()
        self.database.update_fantasy_data(fantasy_data)

    def save_predictions_to_db(self):
        predictions = self.data.upcoming.get_predictions()
        actual_scores = self.data.fixtures.get_actual_scores_new()
        self.database.update_predictions(predictions, actual_scores)
        self.database.update_actual_scores(actual_scores)

    def get_logo_urls(self) -> dict[str, str]:
        data = self.json_data['standings'][self.current_season]

        logo_urls = {}
        for standings_row in data:
            team_name = clean_full_team_name(standings_row['team']['name'])
            crest_url = standings_row['team']['crestUrl']
            logo_urls[team_name] = crest_url

        return logo_urls

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
            logging.error(e)
            logging.info('🔁 Retrying with local backup data...')
            request_new = False
            self.fetch_json_data(n_seasons, request_new)

        self.build_dataframes(n_seasons, display_tables)

        if request_new:
            logging.info('💾 Saving new team data to local backup...')
            self.save_data_to_json()
            if update_db:
                logging.info('💾 Saving new team data to database...')
                self.save_team_data_to_db()
                logging.info('💾 Saving new fantasy data to database...')
                self.save_fantasy_data_to_db()
                logging.info('💾 Saving predictions to database...')
                self.save_predictions_to_db()


def run(display_tables: bool = False, request_new: bool = True, update_db: bool = True):
    updater = Updater(2023)
    updater.build_all(
        display_tables=display_tables,
        request_new=request_new,
        update_db=update_db
    )


def run_production():
    timebudget.set_quiet()
    logging.basicConfig(level=logging.CRITICAL,
                        format='%(asctime)s :: %(levelname)s :: %(message)s')
    run()


def run_development():
    logging.basicConfig(level=logging.DEBUG,
                        format='%(asctime)s :: %(levelname)s :: %(message)s')
    run(display_tables=True, update_db=True, request_new=True)


if __name__ == "__main__":
    run_development()

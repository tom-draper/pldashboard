import logging
from collections import defaultdict
from datetime import datetime

import pandas as pd
from dataframes.df import DF
from lib.utils.utilities import Utilities
from pandas import DataFrame
from timebudget import timebudget

utils = Utilities()


class Fixtures(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'fixtures')

    @staticmethod
    def _inc_avg_scored_conceded(
        avg_scored: float,
        avg_conceded: float,
        score: dict[str, int], 
        at_home: bool
    ):
        if at_home:
            avg_scored += score['homeGoals']
            avg_conceded += score['awayGoals']
        else:
            avg_scored += score['awayGoals']
            avg_conceded += score['homeGoals']

        return avg_scored, avg_conceded

    def get_avg_result(self, team_name: str) -> tuple[float, float]:
        avg_scored = 0
        avg_conceded = 0
        total = 0
        for matchday_no in self.df.columns.unique(level=0):
            if self.df.at[team_name, (matchday_no, 'status')] == 'FINISHED':
                at_home = self.df.at[team_name, (matchday_no, 'atHome')]
                score = self.df.at[team_name, (matchday_no, 'score')]
                avg_scored, avg_conceded = self._inc_avg_scored_conceded(
                    avg_scored, avg_conceded, score, at_home)
                total += 1

        if total > 0:
            avg_scored = avg_scored / total
            avg_conceded = avg_conceded / total

        return avg_scored, avg_conceded

    def get_actual_scores_new(self) -> dict[tuple[str, str], dict[str, int]]:
        # To contain a tuple for all actual scores so far this season
        actual_scores = {}

        for matchday_no in range(1, 39):
            matchday = self.df[matchday_no]

            # If whole column is SCHEDULED, skip
            if not all(matchday['status'] == 'SCHEDULED'):
                for team_name, row in matchday.iterrows():
                    if row['status'] == 'FINISHED':
                        if row['atHome']:
                            home_name = team_name
                            away_name = row['team']
                        else:
                            home_name = row['team']
                            away_name = team_name
                        home_initials = utils.convert_team_name_or_initials(
                            home_name)
                        away_initials = utils.convert_team_name_or_initials(
                            away_name)

                        actual_scores[f'{home_initials} vs {away_initials}'] = row['score']

        return actual_scores

    @staticmethod
    def _insert_team_row(
        matchday: int,
        match: dict,
        team_names: list[str],
        home_team: bool
    ):
        date = datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ")

        if home_team:
            team_name = utils.clean_full_team_name(match['homeTeam']['name'])
            opp_team_name = utils.clean_full_team_name(
                match['awayTeam']['name'])
        else:
            team_name = utils.clean_full_team_name(match['awayTeam']['name'])
            opp_team_name = utils.clean_full_team_name(
                match['homeTeam']['name'])

        if match['score']['fullTime']['homeTeam'] is not None:
            score = {
                'homeGoals': match['score']['fullTime']['homeTeam'],
                'awayGoals': match['score']['fullTime']['awayTeam']
            }
        else:
            score = None

        matchday[(match['matchday'], 'date')].append(date)
        matchday[(match['matchday'], 'atHome')].append(home_team)
        matchday[(match['matchday'], 'team')].append(opp_team_name)
        matchday[(match['matchday'], 'status')].append(match['status'])
        matchday[(match['matchday'], 'score')].append(score)
        team_names.append(team_name)

    @timebudget
    def build(self, json_data: dict, season: int, display: bool = False):
        """ Builds a dataframe containing the past and future fixtures for the 
            current season (matchday 1 to 38) and inserts it into the fixtures 
            class variable.

            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ------------------------------------------
            |           [MATCHDAY NUMBER]            |
            ------------------------------------------
            | date | atHome | team  | status | score |

            MATCHDAY NUMBER: all matchday numbers from 1 to 38.
            date: datetime value for the day a match is scheduled for or taken 
                place on
            atHome: whether the team is playing that match at home or away, 
                either True or False
            team: the name of the opposition team
            status: the current status of that match, either 'FINISHED', 'IN PLAY' 
                or 'SCHEDULED'
            score: the score of that game, either 'X - Y' if status is 'FINISHED'
                or None if status is 'SCHEDULED' or 'IN-PLAY'

        Args:
            json_data dict: the json data storage used to build the dataframe
            season int: the year of the current season
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        logging.info('🛠️  Building fixtures dataframe... ')

        data = json_data['fixtures'][season]

        team_names = []  # type: list[str]
        team_names_index = []  # Specific order of team names to be dataframe index
        matchday = defaultdict(lambda: [])  # type: dict[tuple[int, str], list]
        matchdays = []  # type: list[DataFrame]
        prev_matchday = 0
        for match in sorted(data, key=lambda x: x['matchday']):
            # If moved on to data for the next matchday, or
            if prev_matchday < match['matchday']:
                # Package matchday dictionary into dataframe to concatenate into main fixtures dataframe
                df_matchday = pd.DataFrame(matchday)
                df_matchday.index = team_names

                matchday = defaultdict(lambda: [])
                # If just finished matchday 1 data, take team name list order as main fixtures dataframe index
                if prev_matchday == 1:
                    team_names_index = team_names[:]
                matchdays.append(df_matchday)

                prev_matchday = match['matchday']
                team_names = []

            self._insert_team_row(matchday, match, team_names, True)
            self._insert_team_row(matchday, match, team_names, False)

        # Add last matchday (38) dataframe to list
        df_matchday = pd.DataFrame(matchday)
        df_matchday.index = team_names
        matchdays.append(df_matchday)

        fixtures = pd.concat(matchdays, axis=1)

        fixtures.index = team_names_index
        fixtures.columns.names = ('matchday', None)
        fixtures.index.name = 'team'

        if display:
            print(fixtures)

        self.df = fixtures

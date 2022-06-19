from collections import defaultdict
from datetime import datetime

import pandas as pd
from timebudget import timebudget
from pandas import DataFrame
from utils.utilities import Utilities

from dataframes.df import DF

utils = Utilities()

class Fixtures(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'fixtures')

    def get_n_games_played(self, team_name: str) -> int:
        return (self.df.loc[team_name, (slice(None), 'Status')] == 'FINISHED').values.sum()

    @staticmethod
    def _inc_avg_scored_conceded(
        avg_scored: float,
        avg_conceded: float,
        h: int,
        a: int,
        at_home: bool
    ):
        if at_home:
            avg_scored += h
            avg_conceded += a
        else:
            avg_conceded += h
            avg_scored += a

        return avg_scored, avg_conceded

    def get_avg_result(self, team_name: str) -> tuple[float, float]:
        avg_scored = 0
        avg_conceded = 0
        total = 0
        for matchday_no in self.df.columns.unique(level=0):
            if self.df.at[team_name, (matchday_no, 'Status')] == 'FINISHED':
                at_home = self.df.at[team_name, (matchday_no, 'AtHome')]
                score = self.df.at[team_name, (matchday_no, 'Score')]
                h, a = utils.extract_int_score(score)
                avg_scored, avg_conceded = self._inc_avg_scored_conceded(
                    avg_scored, avg_conceded, h, a, at_home)
                total += 1

        avg_scored = avg_scored / total
        avg_conceded = avg_conceded / total

        return avg_scored, avg_conceded

    @staticmethod
    def _insert_home_team_row(matchday: dict, match: dict, team_names: list[str]):
        score = None
        if match['score']['fullTime']['homeTeam'] is not None:
            score = f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}"

        matchday[(match["matchday"], 'Date')].append(
            datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ"))
        matchday[(match["matchday"], 'AtHome')].append(True)
        matchday[(match["matchday"], 'Team')].append(
            match['awayTeam']['name'].replace('&', 'and'))
        matchday[(match["matchday"], 'Status')].append(match['status'])
        matchday[(match["matchday"], 'Score')].append(score)
        team_names.append(match['homeTeam']['name'].replace('&', 'and'))

    @staticmethod
    def _insert_away_team_row(matchday: dict, match: dict, team_names: list[str]):
        score = None
        if match['score']['fullTime']['homeTeam'] is not None:
            score = f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}"

        matchday[(match["matchday"], 'Date')].append(
            datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ"))
        matchday[(match["matchday"], 'AtHome')].append(False)
        matchday[(match["matchday"], 'Team')].append(
            match['homeTeam']['name'].replace('&', 'and'))
        matchday[(match["matchday"], 'Status')].append(match['status'])
        matchday[(match["matchday"], 'Score')].append(score)
        team_names.append(match['awayTeam']['name'].replace('&', 'and'))

    @staticmethod
    def _insert_team_row(
        matchday: int,
        match: dict,
        team_names: list[str],
        home_team: bool
    ):
        date = datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ")

        if home_team:
            team_name = match['homeTeam']['name'].replace('&', 'and')
            opp_team_name = match['awayTeam']['name'].replace('&', 'and')
        else:
            team_name = match['awayTeam']['name'].replace('&', 'and')
            opp_team_name = match['homeTeam']['name'].replace('&', 'and')

        score = None
        if match['score']['fullTime']['homeTeam'] is not None:
            score = f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}"

        matchday[(match['matchday'], 'Date')].append(date)
        matchday[(match['matchday'], 'AtHome')].append(home_team)
        matchday[(match['matchday'], 'Team')].append(opp_team_name)
        matchday[(match['matchday'], 'Status')].append(match['status'])
        matchday[(match['matchday'], 'Score')].append(score)
        team_names.append(team_name)

    @timebudget
    def build(self, json_data: dict, season: int, display: bool = False):
        """ Builds a dataframe containing the past and future fixtures for the 
            current season (matchday 1 to 38) and inserts it into the fixtures 
            class variable.

            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ---------------------------------------------
            |             Matchday Number]              |
            ---------------------------------------------
            | Date | AtHome | Team  | Status  | Score |

            Matchday [X]: where X is integers from 1 to 38
            Date: datetime value for the day a match is scheduled for or taken 
                place on
            AtHome: whether the team is playing that match at home or away, 
                either True or False
            Team: the name of the opposition team
            Status: the current status of that match, either 'FINISHED', 'IN PLAY' 
                or 'SCHEDULED'
            Score: the score of that game, either 'X - Y' if status is 'FINISHED'
                or None if status is 'SCHEDULED' or 'IN-PLAY'

        Args:
            json_data dict: the json data storage used to build the dataframe
            season int: the year of the current season
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building fixtures dataframe... ')

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
        fixtures.columns.names = ("Matchday", None)
        fixtures.index.name = 'Team'

        if display:
            print(fixtures)

        self.df = fixtures

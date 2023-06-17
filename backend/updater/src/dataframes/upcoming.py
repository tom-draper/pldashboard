import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from pandas import DataFrame
from src.data import Fixtures, Form, HomeAdvantages, TeamRatings
from src.dataframes.df import DF
from src.fmt import clean_full_team_name, convert_team_name_or_initials
from timebudget import timebudget


class Upcoming(DF):
    def __init__(
            self, current_season, d: DataFrame = DataFrame()):
        super().__init__(d, 'upcoming')
        from src.predictions.predictions import Predictions
        self.predictions = Predictions(current_season)

    def get_predictions(self) -> dict[str, dict]:
        """ Extracts a predictions dictionary from the dataframe including 
            prediction details for each team about their upcoming game.

            predictions = {
                team_name: {
                    'date': date (datetime)
                    'homeInitials': three letter capital initials (str),
                    'awayInitials': three letter capital initials (str),
                    'prediction': {
                        'homeGoals': expected goals (float)
                        'awayGoals': expected goals (float)
                    }
                }
            }
        """
        # If predictions haven't been added to dataframe, skip (season is over)
        if ('predictions', 'homeGoals') not in self.df:
            return {}

        predictions: dict[str, dict[str, datetime |
                                    str | dict[str, float]]] = {}
        for team, row in self.df.iterrows():
            if row[('atHome', '')]:
                home_initials = team
                away_initials = row[('nextTeam', '')]
            else:
                home_initials = row[('nextTeam', '')]
                away_initials = team

            predictions[team] = {
                'date': row[('date', '')].to_pydatetime(),
                'homeInitials': convert_team_name_or_initials(home_initials),
                'awayInitials': convert_team_name_or_initials(away_initials),
                'prediction': {
                    'homeGoals': row[('prediction', 'homeGoals')],
                    'awayGoals': row[('prediction', 'awayGoals')]
                }
            }

        return predictions

    def _next_matchday(
        self,
        team_name: str,
        fixtures: Fixtures
    ) -> int:
        """Scan through list of fixtures to find the next game that is scheduled."""
        # Arbitrary initial future date that will always be greater than any possible matchday date
        future = datetime.now() + timedelta(days=365)
        matchday = {'date': future, 'matchday': None}
        now = datetime.now()
        for matchday_no in fixtures.df.columns.unique(level=0):
            date = fixtures.df.at[team_name, (matchday_no, 'date')]
            scheduled = fixtures.df.at[team_name,
                                       (matchday_no, 'status')] == 'SCHEDULED'
            if scheduled and now < date < matchday['date']:
                matchday['date'] = date
                matchday['matchday'] = matchday_no
        return matchday['matchday']

    def _get_next_game(
        self,
        team_name: str,
        fixtures: Fixtures
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        date = None  # type: Optional[str]
        next_team = None  # type: Optional[str]
        at_home = None  # type: Optional[str]

        next_matchday = self._next_matchday(team_name, fixtures)
        if next_matchday is not None:
            date = fixtures.df.at[team_name, (next_matchday, 'date')]
            next_team = fixtures.df.at[team_name, (next_matchday, 'team')]
            at_home = fixtures.df.at[team_name, (next_matchday, 'atHome')]

        return date, next_team, at_home

    @staticmethod
    def _game_result_tuple(match: dict) -> tuple[str, str]:
        home_score = match['score']['fullTime']['homeTeam']
        away_score = match['score']['fullTime']['awayTeam']
        if home_score == away_score:
            return ('drew', 'drew')
        elif home_score > away_score:
            return ('won', 'lost')
        else:
            return ('lost', 'won')

    def _append_prev_match(
        self,
        next_games: dict,
        home_team: str,
        away_team: str,
        home_goals: int,
        away_goals: int,
        date: str,
        result: tuple[str, str]
    ):
        # From the perspective from the home team
        # If this match's home team has their next game against this match's away team
        if next_games[home_team]['nextTeam'] == away_team:
            prev_match = {'date': date,
                          'homeTeam': home_team,
                          'awayTeam': away_team,
                          'homeGoals': home_goals,
                          'awayGoals': away_goals,
                          'result': result[0]}
            next_games[home_team]['prevMatches'].append(prev_match)

        if next_games[away_team]['nextTeam'] == home_team:
            prev_match = {'date': date,
                          'homeTeam': home_team,
                          'awayTeam': away_team,
                          'homeGoals': home_goals,
                          'awayGoals': away_goals,
                          'result': result[1]}
            next_games[away_team]['prevMatches'].append(prev_match)

    @staticmethod
    def _ord(n: int) -> str:
        return str(n) + ("th" if 4 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th"))

    def _readable_date(self, date: datetime) -> str:
        dt = datetime.strptime(date[:10], "%Y-%m-%d")
        day = self._ord(dt.day)
        return day + dt.date().strftime(' %B %Y')

    @staticmethod
    def _sort_prev_matches_by_date(next_games: dict):
        for _, row in next_games.items():
            row['prevMatches'] = sorted(
                row['prevMatches'], key=lambda x: x['date'], reverse=True)

    def _append_season_prev_matches(
        self,
        next_games: dict,
        json_data: dict,
        season: int,
        team_names: list[str]
    ):
        if team_names is None:
            raise ValueError(
                '❌ [ERROR] Cannot build upcoming dataframe: Teams names list empty')

        data = json_data['fixtures'][season]

        for match in data:
            if match['status'] == 'FINISHED':
                home_team = clean_full_team_name(
                    match['homeTeam']['name'])  # type: str
                away_team = clean_full_team_name(
                    match['awayTeam']['name'])  # type: str

                if home_team in team_names and away_team in team_names:
                    home_goals = match['score']['fullTime']['homeTeam']
                    away_goals = match['score']['fullTime']['awayTeam']
                    date = match['utcDate']
                    result = self._game_result_tuple(match)
                    self._append_prev_match(
                        next_games,
                        home_team,
                        away_team,
                        home_goals,
                        away_goals,
                        date,
                        result
                    )

    def _merge_predictions_into_upcoming(self, upcoming: DataFrame,
                                         predictions: DataFrame) -> DataFrame:
        upcoming = upcoming.rename(columns={column: (column, '')
                                            for column in upcoming.columns.tolist()})
        upcoming.columns = pd.MultiIndex.from_tuples(upcoming.columns)
        upcoming = pd.concat([upcoming, predictions], axis=1)
        return upcoming

    def build(
        self,
        json_data: dict,
        fixtures: Fixtures,
        form: Form,
        team_ratings: TeamRatings,
        home_advantages: HomeAdvantages,
        season: int,
        n_seasons: int = 3,
        display: bool = False,
    ):
        """ Assigns self.df a dataframe for details about the next game each team 
            has to play.

            Rows: the 20 teams participating in the current season
            Columns:
            ----------------------------------------------------------------------------
            | date | nextGame | atHome | prevMatches | prediction | detailedPrediction |

            date: the datetime of the upcoming match.
            nextGame: name of the opposition team in a team's next game
            atHome: whether the team is playing the next match at home or away, 
                either True or False
            prevMatches: list of previous match dictionaries containing the 
                date, home team, away team, home goals, away goals, match result 
                for each recorded previous match between the two teams.
            prediction: a {'homeGoals': X, 'awayGoals': Y} dictionary holding the
                predicted integer goals for each team
            detailedPrediction: a {'homeGoals': X, 'awayGoals': Y} dictionary holding the
                predicted float goals for each team

        Args:
            json_dict dict: the json data storage used to build the dataframe.
            fixtures Fixtures: a completed dataframe containing past and future
                fixtures for each team within the current season.
            form Form: a completed dataframe containing a snapshot of information
                regarding each team's form after each completed matchday.
            home_advantages HomeAdvantages: a completed dataframe containing the
                quantified home advantage each team recieves.
            team_names list: a list of the 20 teams participating in the current 
                season.
            season int: the year of the current season.
            n_seasons (int, optional): number of seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        logging.info('🛠️  Building upcoming dataframe... ')

        d = {}  # type: dict[str, dict[str, Optional[str] | list]]
        team_names = fixtures.df.index.to_list()
        for team_name in team_names:
            date, next_team, at_home = self._get_next_game(team_name, fixtures)
            d[team_name] = {
                'date': date,
                'nextTeam': next_team,
                'atHome': at_home,
                'prevMatches': []
            }

        for i in range(n_seasons):
            self._append_season_prev_matches(
                d, json_data, season-i, team_names)

        # Format previous meeting dates as long, readable str
        self._sort_prev_matches_by_date(d)

        upcoming = pd.DataFrame.from_dict(d, orient='index')

        if form.get_current_matchday() < 38:
            # Generate and insert new predictions for upcoming games
            # predictions = self.predictions.build(form, upcoming, team_ratings, home_advantages)
            predictions = self.predictions.build(
                fixtures, form, upcoming, home_advantages)
            upcoming = self._merge_predictions_into_upcoming(
                upcoming, predictions) 

        upcoming.index.name = 'team'
        
        from src.predictions.predict_v2 import Predictor
        predictor = Predictor(json_data, fixtures, form, team_ratings, home_advantages, season, n_seasons)
        predictor.predict_score("Arsenal", "Nottingham Forest")

        if display:
            print(upcoming)

        self.df = upcoming

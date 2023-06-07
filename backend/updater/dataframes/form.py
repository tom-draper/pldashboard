import logging
import math

import pandas as pd
from dataframes.team_ratings import TeamRatings
from dataframes.df import DF
from lib.utils.utilities import Utilities
from pandas import DataFrame
from timebudget import timebudget

utils = Utilities()


class Form(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'form')

    def get_prev_matchday(self, current_season: int) -> int:
        current_season = self.get_current_season()
        return self._get_matchday(current_season, n_back=1)

    def get_current_matchday(self, current_season: int = None) -> int:
        if current_season is None:
            current_season = self.get_current_season()
        return self._get_matchday(current_season, n_back=0)

    def get_current_season(self) -> int:
        return max(self.df.columns.unique(level=0))

    def get_current_form_rating(self, team_name: str) -> float:
        current_season = self.get_current_season()
        current_matchday = self.get_current_matchday(current_season)
        matchday = self._get_last_played_matchday(
            current_matchday, current_season, team_name)
        return self._get_form_rating(team_name, matchday, current_season, 5)

    def get_long_term_form_rating(self, team_name: str) -> float:
        current_season = self.get_current_season()
        current_matchday = self.get_current_matchday(current_season)
        matchday = self._get_last_played_matchday(
            current_matchday, current_season, team_name)
        return self._get_form_rating(team_name, matchday, current_season, 10)

    def _get_last_played_matchday(self, current_matchday: int, current_season: int, team_name: str) -> int | None:
        matchday = current_matchday
        while matchday > 0 and self.df.at[team_name, (current_season, matchday, 'score')] is None:
            matchday -= 1
        return matchday

    def _get_form_rating(self, team_name: str, matchday: int, current_season: int, n_games: int) -> float:
        if matchday < 1 or matchday > 38:
            return 0

        rating = 50.0
        if matchday is not None:
            rating = (
                self.df.at[team_name, (current_season, matchday, f'formRating{n_games}')] * 100).round(1)
        return rating

    def _get_matchday(self, season: int, n_back: int = 0) -> int:
        current_matchday = 0
        matchdays = self.df[season].columns.unique(level=0)
        if len(matchdays) != 0:
            current_matchday = matchdays[-(n_back+1)]
        return current_matchday

    @staticmethod
    def _get_points(gd: int) -> int:
        if gd > 0:
            return 3
        elif gd == 0:
            return 1
        else:
            return 0

    @staticmethod
    def _get_gd(score: str, at_home: bool) -> int:
        if at_home:
            return score['homeGoals'] - score['awayGoals']
        else:
            return score['awayGoals'] - score['homeGoals']

    @staticmethod
    def _calc_form_rating(
        team_ratings: TeamRatings,
        teams_played: list[str],
        form_str: str,
        gds: list[int]
    ) -> float:
        form_rating = 0.5  # Default percentage, moves up or down based on performance
        if form_str is not None:  # If games have been played this season
            for i, opp_team in enumerate(teams_played):
                # Convert opposition team initials to their name
                opp_team_rating = 0
                if opp_team in team_ratings.df.index:
                    opp_team_rating = team_ratings.df.at[opp_team,
                                                         'totalRating']

                # Increment form score based on rating of the team they've won, drawn or lost against
                form_rating += (opp_team_rating / len(form_str)) * gds[i]

        form_rating = min(max(0, form_rating), 1)  # Cap rating
        return form_rating

    def _insert_position_columns(self, df: DataFrame):
        seasons = df.columns.unique(level=0).tolist()
        for season in seasons:
            played_matchdays = df[season].columns.unique(level=0).tolist()
            for matchday in played_matchdays:
                df.sort_values(by=[(season, matchday, 'cumPoints'),
                                   (season, matchday, 'cumGD')],
                               ascending=False,
                               inplace=True)
                df[(season, matchday, 'position')] = list(range(1, 21))

    def _fill_teams_missing_matchday(self, form: DataFrame):
        """Fill in missing essential matchday data with copies from previous matchday."""
        current_season = max(form.columns.unique(level=0))
        matchdays = list(sorted(form[current_season].columns.unique(level=0)))
        teams = form[current_season].index.values
        essential_cols = ('cumGD', 'cumPoints', 'form5',
                          'form10', 'formRating5', 'formRating10')
        for matchday in matchdays:
            if form[current_season][matchday].isnull().values.any():
                for team in teams:
                    value = form.at[team, (current_season, matchday, 'team')]
                    if type(value) is float and math.isnan(value):
                        # Team does not have a completed match in this matchday (postponed etc.)
                        prev_matchday = matchday - 1
                        while prev_matchday not in matchdays:
                            prev_matchday -= 1
                        for col in essential_cols:
                            form.at[team, (current_season, matchday, col)
                                    ] = form.at[team, (current_season, prev_matchday, col)]

    def _clean_dataframe(self, form: DataFrame, matchday_nos: list[int]) -> DataFrame:
        # Drop columns used for working
        form = form.drop(columns=['points'], level=1)
        form = form.reindex(sorted(form.columns.values), axis=1)
        form = form.sort_values(
            by=[(max(matchday_nos), 'formRating5')], ascending=False)
        return form

    @staticmethod
    def _init_dict(d: dict, team: str):
        if team not in d:
            d[team] = {}

    @staticmethod
    def _get_form_char(gd: int):
        if gd > 0:
            return 'W'
        elif gd < 0:
            return 'L'
        else:
            return 'D'

    def _last_n_played_matchdays(self, d: dict, team: str, current_season: int,
                                 N: int) -> list[int]:
        played_matchdays = []
        for matchday in range(38, 0, -1):
            if (current_season, matchday, 'team') in d[team]:
                played_matchdays.append(matchday)
            if len(played_matchdays) >= N:
                break

        played_matchdays.reverse()

        return played_matchdays

    def calc_form_rating(self, d: dict, team_ratings: TeamRatings, team: str,
                         current_season: int, length: int) -> float:
        played_matchdays = self._last_n_played_matchdays(
            d, team, current_season, length)
        teams_played = [d[team][(current_season, matchday, 'team')]
                        for matchday in played_matchdays]
        gds = [d[team][(current_season, matchday, 'gD')]
               for matchday in played_matchdays]
        form_str = d[team][(
            current_season, played_matchdays[-1], f'form{length}')]
        form_rating = self._calc_form_rating(
            team_ratings, teams_played, form_str, gds)
        return form_rating

    def _insert_form_rating(self, d: dict, team_ratings: TeamRatings, team: str,
                            season: int, matchday: int, length: int):
        form_rating = self.calc_form_rating(
            d, team_ratings, team, season, length)
        d[team][(season, matchday, f'formRating{length}')] = form_rating

    def _insert_form_string(self, d: dict, team: str, gd: int, season: int,
                            matchday: int, length: int):
        col_heading = f'form{length}'
        form_char = self._get_form_char(gd)  # W, L or D for matchday

        prev_matchday = matchday - 1
        while prev_matchday > 0 and (season, prev_matchday, col_heading) not in d[team]:
            prev_matchday -= 1

        if prev_matchday > 0:
            form_str = d[team][(season, prev_matchday,
                                col_heading)] + form_char
            if len(form_str) > length:
                # Crop string to length
                form_str = form_str[len(form_str)-length:]
        else:
            form_str = form_char

        d[team][(season, matchday, col_heading)] = form_str

    @staticmethod
    def _prev_matchday(d: dict, team: str, matchday: int, season: int) -> int:
        prev_matchday = matchday - 1
        while (season, prev_matchday, 'team') not in d[team] and prev_matchday >= 0:
            prev_matchday -= 1
        return prev_matchday

    def _insert_team_matchday(self, d: dict, match: dict, team_ratings: TeamRatings, season: int, home_team: bool):
        if home_team:
            team = utils.clean_full_team_name(match['homeTeam']['name'])
            opp_team = utils.clean_full_team_name(match['awayTeam']['name'])
        else:
            team = utils.clean_full_team_name(match['awayTeam']['name'])
            opp_team = utils.clean_full_team_name(match['homeTeam']['name'])

        self._init_dict(d, team)

        matchday = match['matchday']
        prev_matchday = self._prev_matchday(d, team, matchday, season)

        d[team][(season, matchday, 'team')] = opp_team
        d[team][(season, matchday, 'date')] = match['utcDate']
        d[team][(season, matchday, 'atHome')] = home_team

        score = {
            'homeGoals': match["score"]["fullTime"]["homeTeam"],
            'awayGoals': match["score"]["fullTime"]["awayTeam"]
        }
        d[team][(season, matchday, 'score')] = score

        gd = self._get_gd(score, home_team)
        points = self._get_points(gd)
        d[team][(season, matchday, 'gD')] = gd
        d[team][(season, matchday, 'cumGD')] = gd
        d[team][(season, matchday, 'cumPoints')] = points
        if prev_matchday > 0:
            d[team][(season, matchday, 'cumGD')
                    ] += d[team][(season, prev_matchday, 'cumGD')]
            d[team][(season, matchday, 'cumPoints')
                    ] += d[team][(season, prev_matchday, 'cumPoints')]

        self._insert_form_string(d, team, gd, season, matchday, 5)
        self._insert_form_string(d, team, gd, season, matchday, 10)

        self._insert_form_rating(d, team_ratings, team, season, matchday, 5)
        self._insert_form_rating(d, team_ratings, team, season, matchday, 10)

    @timebudget
    def build(
        self,
        json_data: dict,
        team_ratings: TeamRatings,
        season: int,
        n_seasons: int = 4,
        display: bool = False
    ):
        """ Assigns self.df to a dataframe containing the form data for each team
            for the matchdays played in the current season.

            Rows: the 20 teams participating in the current season.
            Columns (multi-index):
            ------------------------------------------------------------------------------------------------------------------
            |                                                  [MATCHDAY NUMBER]                                             |
            |----------------------------------------------------------------------------------------------------------------|
            | date | team | score | gD | points | position | form5 | form10 | formRating5 | formRating10 | cumGD | cumPoints |

            [MATCHDAY NUMBER]: the matchdays numbers that have been played.
            date: the datetime of the team's game played on that matchday.
            team str: the initials of the opposition team played on that matchday.
            score str: the score 'X - Y' of the game played on that matchday.
            gD int: the positive or negative goal difference achieved on that 
                matchday from the perspective of the team (row).
            points int: the points achieved on that matchday from the perspective 
                of the team (row).
            position int: the league standings position held on that matchday
            form5 str: the form string up to the last 5 games (e.g. WWLDW) with the
                most recent result on the far left. String can take characters
                W, L, D or N (none - game not played).
            form10: the form string up to the last 10 games (e.g. WWLDDLWLLW) with 
                the most recent result on the far left. String can take characters
                W, L, D or N (none - game not played).
            formRating5 float: the calculated form rating based on the results of
                up to the last 5 games.
            formRating10 float: the calculated form rating based on the results of
                up to the last 5 games.
            cumGD: the cumulative GD achieved across the current matchday
                and all matchdays prior.
            cumPoints: the cumulative points acquired across the current matchday
                and all matchdays prior.

        Args:
            fixtures Fixtures: a completed dataframe containing past and future
                fixtures for each team within the current season
            team_ratings TeamRatings: a completed dataframe filled with long-term
                ratings for each team
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        logging.info('🛠️  Building form dataframe... ')
        teams = set()
        d = {}
        for i in range(n_seasons):
            for match in json_data['fixtures'][season-i]:
                if i == 0:
                    teams.add(utils.clean_full_team_name(
                        match['homeTeam']['name']))
                    teams.add(utils.clean_full_team_name(
                        match['awayTeam']['name']))
                if match['status'] == 'FINISHED':
                    self._insert_team_matchday(
                        d, match, team_ratings, season-i, True)
                    self._insert_team_matchday(
                        d, match, team_ratings, season-i, False)

        form = pd.DataFrame.from_dict(d, orient='index')

        # Drop teams not in current season
        form = form.drop(index=form.index.difference(teams), axis=0)

        self._fill_teams_missing_matchday(form)

        self._insert_position_columns(form)

        form = form.sort_index(axis=1)

        if display:
            print(form)

        self.df = form

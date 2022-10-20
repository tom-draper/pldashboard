import logging
from collections import defaultdict
import math
from typing import Iterable

import numpy as np
import pandas as pd
from lib.utils.utilities import Utilities
from pandas import DataFrame
from timebudget import timebudget

from dataframes.df import DF
from dataframes.fixtures import Fixtures
from dataframes.team_ratings import TeamRatings

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

    def _get_matchday(self, season, n_back=0):
        current_matchday = 0
        matchdays = self.df[season].columns.unique(level=0)
        if len(matchdays) != 0:
            current_matchday = matchdays[-(n_back+1)]
        return current_matchday

    @staticmethod
    def _get_points(gd: int) -> int:
        if gd > 0:
            pts = 3
        elif gd == 0:
            pts = 1
        else:
            pts = 0
        return pts

    @staticmethod
    def _get_gd(score: str, at_home: bool) -> int:
        home, away = utils.extract_int_score(score)
        gd = home - away if at_home else away - home
        return gd

    @staticmethod
    def _append_to_from_str(form_str: list, home: int, away: int, at_home: bool):
        if home == away:
            result = 'D'
        elif (at_home and home > away) or (not at_home and home < away):
            result = 'W'
        elif (at_home and home < away) or (not at_home and home > away):
            result = 'L'
        form_str.append(result)

    @staticmethod
    def _get_idx(lst: list[any], val: any):
        idx = None
        for i, v in enumerate(lst):
            if v == val:
                idx = i
                break
        return idx

    def _build_form_str(self, form, team, last_n_matchday_nos):
        form_str = []
        for n in reversed(last_n_matchday_nos):
            score = form.at[team, (n, 'score')]
            if score is not None:
                home, away = utils.extract_int_score(score)
                at_home = form.at[team, (n, 'atHome')]
                self._append_to_from_str(form_str, home, away, at_home)
            else:
                form_str.append('N')

        return ''.join(form_str)

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

    def _get_form_matchday_range_values(
        self,
        form: DataFrame,
        team_name: str,
        column_name: str,
        matchday_ns: list[int]
    ) -> list:
        col_headings = [(matchday, column_name) for matchday in matchday_ns]
        values = [form.at[team_name, col] for col in col_headings]
        return values

    @staticmethod
    def _get_played_matchdays(fixtures: Fixtures) -> list[int]:
        status = fixtures.df.loc[:, (slice(None), 'status')]
        # Remove cols for matchdays that haven't played yet
        status = status.loc[:, (status == 'FINISHED').any()]
        matchday_nos = sorted(list(status.columns.get_level_values(0)))
        return matchday_nos
    
    def _insert_cum_gd_pts(self, d, gd, pts, matchday_no, teams_matchdays, idx):
        cum_gd = gd
        cum_pts = pts
        if idx > 0:
            prev_gd = d[(teams_matchdays[idx-1], 'cumGD')][-1]
            prev_pts = d[(teams_matchdays[idx-1], 'cumPoints')][-1]
            cum_gd = gd + prev_gd
            cum_pts = pts + prev_pts
        d[(matchday_no, 'cumGD')].append(cum_gd)
        d[(matchday_no, 'cumPoints')].append(cum_pts)

    def _insert_gd_pts(self, d, team, matchday_no, form, teams_matchdays, idx):
        gd = 0
        pts = 0
        if form.at[team, (matchday_no, 'score')] is not None:
            at_home = form.at[team, (matchday_no, 'atHome')]
            gd = self._get_gd(form.at[team, (matchday_no, 'score')], at_home)
            pts = self._get_points(gd)
        d[(matchday_no, 'gD')].append(gd)
        d[(matchday_no, 'points')].append(pts)

        self._insert_cum_gd_pts(d, gd, pts, matchday_no, teams_matchdays, idx)

    def _insert_position_columns(self, df, all_matchdays):
        for matchday_no in all_matchdays:
            df.sort_values(by=[(matchday_no, 'cumPoints'),
                               (matchday_no, 'cumGD')],
                           ascending=False,
                           inplace=True)
            df[matchday_no, 'position'] = list(range(1, 21))

    def _insert_position_columns_new(self, df: DataFrame):
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
        essential_cols = ('cumGD', 'cumPoints', 'form5', 'form10', 'formRating5', 'formRating10')
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
                            form.at[team, (current_season, matchday, col)] = form.at[team, (current_season, prev_matchday, col)]

    def _insert_form(self, d, form, team_ratings, team, matchday_no, teams_matchdays, idx, N):
        # Get last idx of matchday that has been played
        while idx >= 0 and form.at[team, (teams_matchdays[idx], 'score')] is None:
            idx -= 1

        # Insert form string for last N games
        last_n_matchday_nos = teams_matchdays[max(0, idx-N+1):idx+1]
        form_str = self._build_form_str(form, team, last_n_matchday_nos)
        d[(matchday_no, 'form' + str(N))].append(form_str)

        # Insert form rating for last N games
        gds = [d[(md, 'gD')][-1] for md in last_n_matchday_nos]
        teams_played = self._get_form_matchday_range_values(
            form, team, 'team', last_n_matchday_nos)
        form_rating = self._calc_form_rating(
            team_ratings, teams_played, form_str, gds)
        d[(matchday_no, 'formRating' + str(N))].append(form_rating)

    def _form_columns(
        self,
        form: DataFrame,
        team_ratings: TeamRatings,
    ):
        all_matchdays = set(form.columns.get_level_values(0).unique())
        columns = ['gD', 'points', 'cumGD', 'cumPoints', 'starTeam',
                   'form5', 'formRating5', 'form10', 'formRating10']

        d = defaultdict(lambda: [])
        for team, row in form.iterrows():
            teams_matchdays = row[(slice(None), 'date')
                                  ][row[(slice(None), 'score')] != None]
            # Matchdays sorted by date played
            teams_matchdays = teams_matchdays.sort_values(
                inplace=False).index.values

            for idx, matchday_no in enumerate(teams_matchdays):
                self._insert_gd_pts(d, team, matchday_no,
                                    form, teams_matchdays, idx)
                self._insert_form(d, form, team_ratings, team,
                                  matchday_no, teams_matchdays, idx, 5)
                self._insert_form(d, form, team_ratings, team,
                                  matchday_no, teams_matchdays, idx, 10)

            # Fill in any empty (non-played) matchdays
            for matchday_no in all_matchdays - set(teams_matchdays):
                for col in columns:
                    d[(matchday_no, col)].append(np.nan)

        df = pd.DataFrame.from_dict(d)
        df.index = form.index

        self._insert_position_columns(df, all_matchdays)

        return df

    def _fill_null_values(self, form: DataFrame) -> DataFrame:
        return form

    def _prev_none_null_matchday(self, matchday: int, matchdays: Iterable[int]) -> int:
        prev_matchday = matchday - 1
        while prev_matchday not in matchdays and prev_matchday > 0:
            prev_matchday -= 1

        if prev_matchday == 0:
            prev_matchday = None

        return prev_matchday

    def _fill_null_matchdays(self, form: DataFrame) -> DataFrame:
        for season in form.columns.unique(level=0):
            matchdays = set(form[season].columns.unique(level=0))
            for matchday in range(max(matchdays)):
                if matchday not in matchdays and matchday > 1:
                    # Copy over previous matchday values
                    prev_matchday = self._prev_none_null_matchday(
                        matchday, matchdays)
                    for col in form[season][prev_matchday].columns.unique():
                        form[(season, matchday, col)] = form[(
                            season, prev_matchday, col)]
        return form

    def fill_null(self, form: DataFrame):
        form = self._fill_null_matchdays(form)
        form = self._fill_null_values(form)
        return form

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

        score = f'{match["score"]["fullTime"]["homeTeam"]} - {match["score"]["fullTime"]["awayTeam"]}'
        d[team][(season, matchday, 'score')] = score

        gd = self._get_gd(score, home_team)
        points = self._get_points(gd)
        d[team][(season, matchday, 'gD')] = gd
        d[team][(season, matchday, 'cumGD')] = gd
        d[team][(season, matchday, 'cumPoints')] = points
        if prev_matchday > 0:
            d[team][(season, matchday, 'cumGD')] += d[team][(season, prev_matchday, 'cumGD')]
            d[team][(season, matchday, 'cumPoints')] += d[team][(season, prev_matchday, 'cumPoints')]

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

        self._insert_position_columns_new(form)

        form = form.sort_index(axis=1)

        if display:
            print(form)

        self.df = form

from collections import defaultdict

import numpy as np
import pandas as pd
from pandas import DataFrame
from timebudget import timebudget
from lib.utils.utilities import Utilities

from dataframes.df import DF
from dataframes.fixtures import Fixtures
from dataframes.team_ratings import TeamRatings

utils = Utilities()


class Form(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'form')

    def get_prev_matchday(self):
        return self._get_matchday(n_back=1)

    def get_current_matchday(self):
        return self._get_matchday(n_back=0)

    def get_current_form_rating(self, team_name: str):
        current_matchday = self.get_current_matchday()
        matchday = self._get_last_played_matchday(current_matchday, team_name)
        return self._get_form_rating(team_name, matchday, 5)

    def get_long_term_form_rating(self, team_name: str):
        current_matchday = self.get_current_matchday()
        matchday = self._get_last_played_matchday(current_matchday, team_name)
        return self._get_form_rating(team_name, matchday, 10)

    def _get_last_played_matchday(self, current_matchday: int, team_name: str) -> int | None:
        matchday = current_matchday
        while matchday > 0 and self.df.at[team_name, (matchday, 'score')] is None:
            matchday -= 1
        return matchday
    
    def _get_form_rating(self, team_name: str, matchday: int, n_games: int) -> float:
        if matchday < 1 or matchday > 38:
            return 0
        
        rating = 50.0
        if matchday is not None:
            rating = (
                self.df.at[team_name, (matchday, f'formRating{n_games}')] * 100).round(1)
        return rating

    def _get_matchday_range_values(
        self,
        team_name: str,
        column_name: str,
        matchday_ns: list[int]
    ) -> list[bool]:
        col_headings = [(matchday, column_name) for matchday in matchday_ns]
        values = [self.df.at[team_name, col] for col in col_headings]
        return values

    def _get_matchday(self, n_back=0):
        current_matchday = 0
        matchdays = self.df.columns.unique(level=0)
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
            n_games = len(form_str)
            for idx, result in enumerate(form_str):
                # Convert opposition team initials to their name
                opp_team = teams_played[idx]
                opp_team_rating = team_ratings.df.at[opp_team, 'totalRating']
                # max_team_rating = team_ratings.df['TotalRating'].iloc[0]
                gd = abs(gds[idx])

                # Increment form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    form_rating += (opp_team_rating / n_games) * gd
                elif result == 'L':
                    form_rating -= (opp_team_rating / n_games) * gd

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
            teams_matchdays = row[(slice(None), 'date')][row[(slice(None), 'score')] != None]
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

    def _clean_dataframe(self, form: DataFrame, matchday_nos: list[int]) -> DataFrame:
        # Drop columns used for working
        form = form.drop(columns=['points'], level=1)
        form = form.reindex(sorted(form.columns.values), axis=1)
        form = form.sort_values(
            by=[(max(matchday_nos), 'formRating5')], ascending=False)
        return form
    
    def build_new(self, json_data: dict, season: int):
        for match in json_data['fixtures'][season]:
            print(match['status'], match['utcDate'], match['homeTeam']['name'], match['awayTeam']['name'], match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'])

    @timebudget
    def build(
        self,
        fixtures: Fixtures,
        team_ratings: TeamRatings,
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
            cumPoints: the cumulative points aquired across the current matchday
                and all matchdays prior.

        Args:
            fixtures Fixtures: a completed dataframe containing past and future
                fixtures for each team within the current season
            team_ratings TeamRatings: a completed dataframe filled with long-term
                ratings for each team
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building form dataframe... ')
        self._check_dependencies(fixtures, team_ratings)

        matchday_nos = self._get_played_matchdays(fixtures)
        
        form = fixtures.df[matchday_nos].drop(columns=['status'], level=1)
        
        if len(matchday_nos) > 0:
            form_rows = self._form_columns(form, team_ratings)
            form = pd.concat([form, form_rows], axis=1)

            form = self._clean_dataframe(form, matchday_nos)

        if display:
            print(form)

        self.df = form

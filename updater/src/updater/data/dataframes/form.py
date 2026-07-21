from typing import Optional

import numpy as np
import pandas as pd
from pandas import DataFrame
from updater.fmt import clean_full_team_name
from updater.timing import timed

from updater.data.dataframes.df import DF
from updater.data.dataframes.team_ratings import TeamRatings
from updater.data.raw_data import RawData


class Form(DF):
    def __init__(self, d: Optional[DataFrame] = None):
        super().__init__(d, "form")

    def get_current_matchday(self, current_season: Optional[int] = None):
        if current_season is None:
            current_season = self.get_current_season()
        return self._get_matchday(current_season, n_back=0)

    def get_current_season(self):
        return max(self.df.columns.unique(level=0))

    def get_current_form_rating(self, team: str):
        current_season = self.get_current_season()
        current_matchday = self.get_current_matchday(current_season)
        matchday = self._get_last_played_matchday(
            current_matchday, current_season, team
        )
        return self._get_form_rating(team, matchday, current_season, 5)

    def get_long_term_form_rating(self, team: str):
        current_season = self.get_current_season()
        current_matchday = self.get_current_matchday(current_season)
        matchday = self._get_last_played_matchday(
            current_matchday, current_season, team
        )
        return self._get_form_rating(team, matchday, current_season, 10)

    def _get_last_played_matchday(
        self, current_matchday: int, current_season: int, team: str
    ):
        matchday = current_matchday
        while (
            matchday > 0
            and self.df.at[team, (current_season, matchday, "score")] is None
        ):
            matchday -= 1
        return matchday

    def _get_form_rating(
        self, team: str, matchday: int, current_season: int, n_games: int
    ):
        if matchday < 1 or matchday > 38:
            return 0

        rating = (
            self.df.at[team, (current_season, matchday, f"formRating{n_games}")] * 100
        ).round(1)
        return rating

    def _get_matchday(self, season: int, n_back: int = 0):
        current_matchday = 0
        matchdays = self.df[season].columns.unique(level=0)
        if len(matchdays) != 0:
            current_matchday = matchdays[-(n_back + 1)]
        return current_matchday

    @staticmethod
    def _get_points(gd: int):
        if gd > 0:
            return 3
        elif gd == 0:
            return 1
        return 0

    @staticmethod
    def _get_gd(score: str, at_home: bool):
        if at_home:
            return score["homeGoals"] - score["awayGoals"]
        return score["awayGoals"] - score["homeGoals"]

    @staticmethod
    def _calc_form_rating(
        team_ratings: TeamRatings,
        teams_played: list[str],
        form_str: str,
        gds: list[int],
    ):
        form_rating = 0.5  # Default percentage, moves up or down based on performance

        if form_str is None:
            return form_rating

        ratings = team_ratings.total_ratings()
        for i, opposition in enumerate(teams_played):
            # Convert opposition team initials to their name
            opposition_rating = ratings.get(opposition, 0)

            # Increment form score based on rating of the team they've won, drawn or lost against
            form_rating += (opposition_rating / len(form_str)) * gds[i]

        form_rating = min(max(0, form_rating), 1)  # Cap rating
        return form_rating

    def _insert_position_columns(self, df: DataFrame):
        # League position is decided by cumulative points, then goal difference.
        # Pull both fields out of the (very wide) frame once here: doing a
        # MultiIndex lookup per season/matchday instead made this the single
        # most expensive step of the whole build.
        cum_points = df.xs("cumPoints", level=2, axis=1)
        cum_gd = df.xs("cumGD", level=2, axis=1)
        if cum_points.empty:
            return df

        # Rank every season/matchday in one pass. Transposed so each row is a
        # single season/matchday and the sort runs along the team axis.
        points = -cum_points.to_numpy(dtype=float).T
        goal_diff = -cum_gd.to_numpy(dtype=float).T

        # lexsort takes its *last* key as primary, so points decide the order
        # and goal difference breaks ties. Both are negated to sort descending;
        # NaN still sorts last either way, matching the previous
        # sort_values(..., na_position="last") behaviour.
        order = np.lexsort((goal_diff, points), axis=-1)

        # Invert the ordering: position 1 goes to the team sorted first.
        positions = np.empty_like(order)
        np.put_along_axis(
            positions, order, np.arange(1, order.shape[-1] + 1), axis=-1
        )

        position_df = DataFrame(
            positions.T,
            index=cum_points.index,
            columns=pd.MultiIndex.from_tuples(
                [(season, matchday, "position") for season, matchday in cum_points.columns]
            ),
        )
        return pd.concat([df, position_df], axis=1)

    def _fill_teams_missing_matchday(self, form: DataFrame):
        """Carry values forward for teams with no completed match in a matchday.

        A team with a postponed or unplayed game has no cumulative or form
        values for that matchday, so the previous matchday's are carried
        forward. Those cells are exactly the ones the build left empty, so a
        forward fill along the matchday axis (done per field) achieves this in
        one vectorised pass: only the empty cells are filled, and teams that
        played keep their real values.
        """
        current_season = max(form.columns.unique(level=0))
        essential_cols = (
            "cumGD",
            "cumPoints",
            "form5",
            "form10",
            "formRating5",
            "formRating10",
        )

        for field in essential_cols:
            # This field's current-season columns, in matchday order so the fill
            # carries earlier matchdays forward into later ones.
            field_cols = sorted(
                (
                    col
                    for col in form.columns
                    if col[0] == current_season and col[2] == field
                ),
                key=lambda col: col[1],
            )
            if len(field_cols) > 1:
                block = form.loc[:, field_cols]
                form.loc[:, field_cols] = block.ffill(axis=1).to_numpy()

    def _clean_dataframe(self, form: DataFrame, matchday_nos: list[int]):
        # Drop columns used for working
        form = form.drop(columns=["points"], level=1)
        form = form.reindex(sorted(form.columns.values), axis=1)
        form = form.sort_values(
            by=[(max(matchday_nos), "formRating5")], ascending=False
        )
        return form

    @staticmethod
    def _get_form_char(gd: int):
        if gd > 0:
            return "W"
        elif gd < 0:
            return "L"
        return "D"

    def _last_n_played_matchdays(self, d: dict, team: str, current_season: int, N: int):
        played_matchdays = []
        for matchday in range(38, 0, -1):
            if (current_season, matchday, "team") in d[team]:
                played_matchdays.append(matchday)
            if len(played_matchdays) >= N:
                break

        played_matchdays.reverse()
        return played_matchdays

    def calc_form_rating(
        self,
        d: dict,
        team_ratings: TeamRatings,
        team: str,
        current_season: int,
        matchdays: list[int],
        length: int,
    ):
        # played_matchdays = self._last_n_played_matchdays(
        # d, team, current_season, length)
        played_matchdays = matchdays[-min(length, len(matchdays)) :]
        teams_played = [
            d[team][(current_season, matchday, "team")] for matchday in played_matchdays
        ]
        gds = [
            d[team][(current_season, matchday, "gD")] for matchday in played_matchdays
        ]
        form_str = d[team][(current_season, played_matchdays[-1], f"form{length}")]
        form_rating = self._calc_form_rating(team_ratings, teams_played, form_str, gds)
        return form_rating

    def _insert_form_rating(
        self,
        d: dict,
        team_ratings: TeamRatings,
        team: str,
        season: int,
        ordered_matchdays: list[int],
        length: int,
    ):
        form_rating = self.calc_form_rating(
            d, team_ratings, team, season, ordered_matchdays, length
        )
        matchday = ordered_matchdays[-1]
        d[team][(season, matchday, f"formRating{length}")] = form_rating

    def _insert_form_string(
        self,
        d: dict,
        team: str,
        gd: int,
        season: int,
        ordered_matchdays: list[int],
        length: int,
    ):
        col_heading = f"form{length}"
        form_char = self._get_form_char(gd)  # W, L or D for matchday

        if len(ordered_matchdays) > 1:
            prev_matchday = ordered_matchdays[-2]
            form_str = d[team][(season, prev_matchday, col_heading)] + form_char
            if len(form_str) > length:
                # Cap string at given length
                form_str = form_str[len(form_str) - length :]
        else:
            form_str = form_char

        matchday = ordered_matchdays[-1]
        d[team][(season, matchday, col_heading)] = form_str

    @staticmethod
    def _prev_matchday(d: dict, team: str, matchday: int, season: int):
        prev_matchday = matchday - 1
        while (season, prev_matchday, "team") not in d[team] and prev_matchday >= 0:
            prev_matchday -= 1
        if prev_matchday < 0:
            prev_matchday = None
        return prev_matchday

    def _ordered_played_matchdays(self, d: dict, team: str, season: int):
        played_matchdays: list[tuple[int, str]] = []
        for matchday in range(1, 39):
            if (season, matchday, "date") in d[team]:
                played_matchdays.append((matchday, d[team][(season, matchday, "date")]))

        # Sort by date
        played_matchdays.sort(key=lambda x: x[1])

        # Collect ordered matchday numbers to return
        ordered_matchdays: list[int] = []
        for matchday in played_matchdays:
            ordered_matchdays.append(matchday[0])
        return ordered_matchdays

    def _insert_team_matchday(
        self,
        d: dict,
        match: dict,
        team_ratings: TeamRatings,
        season: int,
        home_team: bool,
    ):
        if home_team:
            team = clean_full_team_name(match["homeTeam"]["name"])
            opposition = clean_full_team_name(match["awayTeam"]["name"])
        else:
            team = clean_full_team_name(match["awayTeam"]["name"])
            opposition = clean_full_team_name(match["homeTeam"]["name"])

        if team not in d:
            d[team] = {}

        matchday = match["matchday"]

        d[team][(season, matchday, "team")] = opposition
        d[team][(season, matchday, "date")] = match["utcDate"]
        d[team][(season, matchday, "atHome")] = home_team

        home_goals = (
            match["score"]["fullTime"]["home"]
            if "home" in match["score"]["fullTime"]
            else match["score"]["fullTime"]["homeTeam"]
        )
        away_goals = (
            match["score"]["fullTime"]["away"]
            if "away" in match["score"]["fullTime"]
            else match["score"]["fullTime"]["awayTeam"]
        )

        score = {
            "homeGoals": home_goals,
            "awayGoals": away_goals,
        }
        d[team][(season, matchday, "score")] = score

        gd = self._get_gd(score, home_team)
        points = self._get_points(gd)
        d[team][(season, matchday, "gD")] = gd
        d[team][(season, matchday, "points")] = points

        ordered_matchdays = self._ordered_played_matchdays(d, team, season)
        self._insert_form_string(d, team, gd, season, ordered_matchdays, 5)
        self._insert_form_string(d, team, gd, season, ordered_matchdays, 10)

        self._insert_form_rating(d, team_ratings, team, season, ordered_matchdays, 5)
        self._insert_form_rating(d, team_ratings, team, season, ordered_matchdays, 10)

    def _insert_cumulative(self, d: dict, season: int):
        # Insert cumulative by taking previous numerical matchday, rather than
        # previous played game by date due to matchday number on x-axis of points
        # and played graphs
        for team in d.keys():
            for matchday in range(1, 39):
                team_matchday = d[team]
                # Skip if matchday not played
                if (season, matchday, "points") not in team_matchday:
                    continue

                points = team_matchday[(season, matchday, "points")]
                gd = team_matchday[(season, matchday, "gD")]

                prev_cum_points = 0
                prev_cum_gd = 0
                if matchday > 1:
                    prev_matchday = self._prev_matchday(d, team, matchday, season)
                    prev_cum_points = d[team][(season, prev_matchday, "cumPoints")]
                    prev_cum_gd = d[team][(season, prev_matchday, "cumGD")]

                team_matchday[(season, matchday, "cumPoints")] = (
                    prev_cum_points + points
                )
                team_matchday[(season, matchday, "cumGD")] = prev_cum_gd + gd

    @staticmethod
    def _init_missing_teams(d: dict, teams: list[str]):
        for team in teams:
            if team not in d:
                d[team] = {(2023, 1, "team"): np.nan}

    @timed
    def build(
        self,
        raw_data: RawData,
        team_ratings: TeamRatings,
        season: int,
        num_seasons: int = 4,
        display: bool = False,
    ):
        """Assigns self.df to a DataFrame containing the form data for each team
            for the matchdays played in the current season.

            Rows: the 20 teams participating in the current season.
            Columns (multi-index):
            ------------------------------------------------------------------------------------------------------------------
            |                                                      [SEASON]                                                  |
            ------------------------------------------------------------------------------------------------------------------
            |                                                  [MATCHDAY NUMBER]                                             |
            |----------------------------------------------------------------------------------------------------------------|
            | date | team | score | gD | points | position | form5 | form10 | formRating5 | formRating10 | cumGD | cumPoints |

            [SEASON]: the starting year (YYYY) of the Premier League season.
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
            fixtures Fixtures: a completed DataFrame containing past and future
                fixtures for each team within the current season
            team_ratings TeamRatings: a completed DataFrame filled with long-term
                ratings for each team
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        d = {}
        teams = set()
        for i in range(num_seasons):
            for match in raw_data.fixtures[season - i]:
                if i == 0:
                    # Build list of teams in current season
                    teams.add(clean_full_team_name(match["homeTeam"]["name"]))
                    teams.add(clean_full_team_name(match["awayTeam"]["name"]))
                if match["status"] == "FINISHED":
                    self._insert_team_matchday(d, match, team_ratings, season - i, True)
                    self._insert_team_matchday(
                        d, match, team_ratings, season - i, False
                    )

            # Create cumulative points and goal difference fields now points for
            # all matchdays entered
            self._insert_cumulative(d, season - i)

        self._init_missing_teams(d, teams)

        form = pd.DataFrame.from_dict(d, orient="index")

        # Drop teams not in current season
        form = form.drop(index=form.index.difference(teams), axis=0)

        self._fill_teams_missing_matchday(form)

        form = self._insert_position_columns(form)

        form = form.sort_index(axis=1)

        if display:
            print(form)

        self.df = form

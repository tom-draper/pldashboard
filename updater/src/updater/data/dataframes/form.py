from typing import Optional

import numpy as np
import pandas as pd
from pandas import DataFrame
from updater.fmt import clean_full_team_name, get_full_time_goals
from timebudget import timebudget

from .df import DF
from .team_ratings import TeamRatings


class Form(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "form")

    def get_prev_matchday(self, current_season: Optional[int] = None):
        if current_season is None:
            current_season = self.get_current_season()
        return self._get_matchday(current_season, n_back=1)

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
        ratings: dict[str, float],
        teams_played: list[str],
        form_str: str,
        gds: list[int],
    ):
        form_rating = 0.5  # Default percentage, moves up or down based on performance

        if form_str is None:
            return form_rating

        n = len(form_str)
        for opposition, gd in zip(teams_played, gds):
            form_rating += (ratings.get(opposition, 0) / n) * gd

        form_rating = min(max(0, form_rating), 1)  # Cap rating
        return form_rating

    def _insert_position_columns(self, df: DataFrame):
        seasons = df.columns.unique(level=0).tolist()
        position_data = {}

        for season in seasons:
            played_matchdays = df[season].columns.unique(level=0).tolist()
            for matchday in played_matchdays:
                points = df[(season, matchday, "cumPoints")].to_numpy(dtype=float, na_value=0)
                gd = df[(season, matchday, "cumGD")].to_numpy(dtype=float, na_value=0)
                order = np.lexsort((-gd, -points))
                positions = np.empty(len(order), dtype=int)
                positions[order] = np.arange(1, len(order) + 1)
                position_data[(season, matchday, "position")] = pd.Series(
                    positions, index=df.index, name=(season, matchday, "position")
                )

        if position_data:
            position_df = pd.DataFrame(position_data)
            df = pd.concat([df, position_df], axis=1)

        return df

    def _fill_teams_missing_matchday(self, form: DataFrame):
        """Fill in missing essential matchday data with forward-fill from previous matchday."""
        current_season = max(form.columns.unique(level=0))
        matchdays = sorted(form[current_season].columns.unique(level=0))
        essential_cols = (
            "cumGD",
            "cumPoints",
            "form5",
            "form10",
            "formRating5",
            "formRating10",
        )
        for col in essential_cols:
            col_keys = [
                (current_season, md, col)
                for md in matchdays
                if (current_season, md, col) in form.columns
            ]
            if col_keys:
                form[col_keys] = form[col_keys].ffill(axis=1)

    @staticmethod
    def _get_form_char(gd: int):
        if gd > 0:
            return "W"
        elif gd < 0:
            return "L"
        return "D"

    def _insert_form_rating(
        self,
        ratings: dict[str, float],
        matchday_data: dict[str, object],
        teams_played: list[str],
        gds: list[int],
        length: int,
    ):
        form_rating = self._calc_form_rating(
            ratings,
            teams_played[-length:],
            matchday_data[f"form{length}"],
            gds[-length:],
        )
        matchday_data[f"formRating{length}"] = form_rating

    def _insert_form_string(
        self,
        matchday_data: dict[str, object],
        previous_form: str,
        gd: int,
        length: int,
    ):
        form_char = self._get_form_char(gd)  # W, L or D for matchday
        form_str = f"{previous_form}{form_char}"[-length:] if previous_form else form_char
        matchday_data[f"form{length}"] = form_str

    def _insert_team_matchday(
        self,
        d: dict,
        match: dict,
        ratings: dict[str, float],
        team_state: dict[str, list],
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
        if season not in d[team]:
            d[team][season] = {}

        matchday = match["matchday"]
        matchday_data = {
            "team": opposition,
            "date": match["utcDate"],
            "atHome": home_team,
        }
        d[team][season][matchday] = matchday_data

        home_goals, away_goals = get_full_time_goals(match["score"]["fullTime"])

        score = {"homeGoals": home_goals, "awayGoals": away_goals}
        matchday_data["score"] = score

        gd = self._get_gd(score, home_team)
        matchday_data["gD"] = gd
        matchday_data["points"] = self._get_points(gd)

        state = team_state.setdefault(team, {"teams_played": [], "gds": [], "form5": "", "form10": ""})
        state["teams_played"].append(opposition)
        state["gds"].append(gd)

        self._insert_form_string(matchday_data, state["form5"], gd, 5)
        self._insert_form_string(matchday_data, state["form10"], gd, 10)
        state["form5"] = matchday_data["form5"]
        state["form10"] = matchday_data["form10"]

        self._insert_form_rating(
            ratings,
            matchday_data,
            state["teams_played"],
            state["gds"],
            5,
        )
        self._insert_form_rating(
            ratings,
            matchday_data,
            state["teams_played"],
            state["gds"],
            10,
        )

    @staticmethod
    def _compute_cumulative(form: DataFrame, seasons: list[int]) -> DataFrame:
        """Compute cumulative points and GD using vectorised cumsum.

        Uses matchday number ordering (not date ordering) for the x-axis of
        cumulative points/GD graphs. NaN cells (team didn't play that matchday)
        are skipped by cumsum and left as NaN to be forward-filled later by
        _fill_teams_missing_matchday. Returns a new DataFrame with cumulative
        columns added (avoids fragmentation from column-by-column assignment).
        """
        all_cum: dict[tuple, pd.Series] = {}
        for season_val in seasons:
            if season_val not in form.columns.get_level_values(0):
                continue
            season_data = form[season_val]
            matchday_nos = sorted(season_data.columns.unique(level=0))

            for stat, cum_stat in [("points", "cumPoints"), ("gD", "cumGD")]:
                stat_cols = [
                    (season_val, md, stat)
                    for md in matchday_nos
                    if stat in season_data[md].columns
                ]
                if not stat_cols:
                    continue
                stat_df = form[stat_cols].copy()
                stat_df.columns = [c[1] for c in stat_cols]
                # skipna=True (default): NaN skipped in running sum, NaN kept where team didn't play
                cum_df = stat_df.cumsum(axis=1)
                for md in stat_df.columns:
                    all_cum[(season_val, md, cum_stat)] = cum_df[md]

        if not all_cum:
            return form
        return pd.concat([form, pd.DataFrame(all_cum, index=form.index)], axis=1)

    @staticmethod
    def _init_missing_teams(d: dict, teams: list[str], season: int):
        for team in teams:
            if team not in d:
                d[team] = {season: {1: {"team": np.nan}}}

    @staticmethod
    def _flatten_dict(d: dict) -> dict:
        """Flatten nested d[team][season][matchday][col] to d[team][(season, matchday, col)]
        for DataFrame construction."""
        return {
            team: {
                (s, md, col): val
                for s, season_data in team_data.items()
                for md, md_data in season_data.items()
                for col, val in md_data.items()
            }
            for team, team_data in d.items()
        }

    @timebudget
    def build(
        self,
        json_data: dict,
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
                most recent result on the far left.
            form10: the form string up to the last 10 games (e.g. WWLDDLWLLW) with
                the most recent result on the far left.
            formRating5 float: the calculated form rating based on the results of
                up to the last 5 games.
            formRating10 float: the calculated form rating based on the results of
                up to the last 10 games.
            cumGD: the cumulative GD achieved across the current matchday and all prior.
            cumPoints: the cumulative points acquired across the current matchday and all prior.

        Args:
            json_data dict: the json data storage used to build the DataFrame.
            team_ratings TeamRatings: a completed DataFrame filled with long-term
                ratings for each team.
            season int: the year of the current season.
            num_seasons int: number of seasons to include. Defaults to 4.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        # Pre-compute ratings lookup to avoid repeated pandas .at[] calls in the loop
        ratings: dict[str, float] = (
            team_ratings.df["total"].to_dict()
            if team_ratings.df is not None and not team_ratings.df.empty
            else {}
        )

        # d[team][season][matchday][col] = value
        d: dict[str, dict[int, dict[int, dict[str, object]]]] = {}
        teams: set[str] = set()
        for i in range(num_seasons):
            season_year = season - i
            season_team_state: dict[str, dict[str, list | str]] = {}
            for match in sorted(json_data["fixtures"][season_year], key=lambda x: x["utcDate"]):
                if i == 0:
                    teams.add(clean_full_team_name(match["homeTeam"]["name"]))
                    teams.add(clean_full_team_name(match["awayTeam"]["name"]))
                if match["status"] == "FINISHED":
                    self._insert_team_matchday(
                        d, match, ratings, season_team_state, season_year, True
                    )
                    self._insert_team_matchday(
                        d, match, ratings, season_team_state, season_year, False
                    )

        self._init_missing_teams(d, teams, season)

        form = pd.DataFrame.from_dict(self._flatten_dict(d), orient="index")

        # Drop teams not in current season
        form = form.drop(index=form.index.difference(teams), axis=0)

        # Vectorised cumulative points and GD (must run before _fill_teams_missing_matchday)
        seasons = list(range(season, season - num_seasons, -1))
        form = self._compute_cumulative(form, seasons)

        self._fill_teams_missing_matchday(form)

        form = self._insert_position_columns(form)

        form = form.sort_index(axis=1)

        if display:
            print(form)

        self.df = form

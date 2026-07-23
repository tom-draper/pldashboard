from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from pandas import DataFrame

from updater.data.dataframes.df import DF
from updater.data.dataframes.fixtures import Fixtures
from updater.data.dataframes.form import Form
from updater.data.dataframes.home_advantages import HomeAdvantages
from updater.data.dataframes.team_ratings import TeamRatings
from updater.data.raw_data import RawData, full_time_goals
from updater.fmt import clean_full_team_name, convert_team_name_or_initials
from updater.predictions.form_predictor import FormPredictor
from updater.predictions.scoreline import Scoreline


class Upcoming(DF):
    def __init__(self, d: Optional[DataFrame] = None):
        super().__init__(d, "upcoming")

    def get_predictions(self):
        """Extracts a predictions dictionary from the DataFrame including
        prediction details for each team about their upcoming game.

        predictions = {
            [team]: {
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
        predictions: dict[str, dict[str, datetime | str | dict[str, float]]] = {}

        # If predictions haven't been added to DataFrame, skip (season is over)
        if "prediction" in self.df and self.df["prediction"].isnull().all():
            return predictions

        for team, row in self.df.iterrows():
            if row["atHome"]:
                home_initials = convert_team_name_or_initials(team)
                away_initials = convert_team_name_or_initials(row["team"])
            else:
                home_initials = convert_team_name_or_initials(row["team"])
                away_initials = convert_team_name_or_initials(team)

            predictions[team] = {
                "date": row["date"].to_pydatetime(),
                "homeInitials": home_initials,
                "awayInitials": away_initials,
                "prediction": {
                    "homeGoals": row["prediction"].home_goals,
                    "awayGoals": row["prediction"].away_goals,
                },
            }

        return predictions

    @staticmethod
    def _next_matchday_by_team(fixtures: Fixtures):
        """Find each team's next scheduled matchday.

        Returns:
            dict[str, Optional[int]]: team -> next matchday number, or None.

        Pulling the date and status fields out of the wide fixtures frame once
        avoids a per-team-per-matchday MultiIndex lookup (20 x 38 x 3 of them).
        """
        dates = fixtures.df.xs("date", level=1, axis=1)
        statuses = fixtures.df.xs("status", level=1, axis=1)

        matchday_nos = [c for c in dates.columns if isinstance(c, int)]
        now = datetime.now()
        # Arbitrary initial future date that will always be greater than any
        # possible matchday date
        future = now + timedelta(days=365)

        next_matchday: dict[str, Optional[int]] = {}
        for team in fixtures.df.index:
            team_dates = dates.loc[team]
            team_statuses = statuses.loc[team]

            best_date = future
            best_matchday = None
            for matchday_no in matchday_nos:
                status = team_statuses[matchday_no]
                if status != "SCHEDULED" and status != "TIMED":
                    continue
                date = team_dates[matchday_no]
                if now < date < best_date:
                    best_date = date
                    best_matchday = matchday_no
            next_matchday[team] = best_matchday

        return next_matchday

    def _get_next_game(self, team: str, fixtures: Fixtures, next_matchday: Optional[int]):
        date: Optional[str] = None
        opposition: Optional[str] = None
        at_home: Optional[str] = None

        if next_matchday is not None:
            date = fixtures.df.at[team, (next_matchday, "date")]
            opposition = fixtures.df.at[team, (next_matchday, "team")]
            at_home = fixtures.df.at[team, (next_matchday, "atHome")]

        return date, opposition, at_home

    @staticmethod
    def _sort_prev_matches_by_date(next_games: dict):
        for _, row in next_games.items():
            row["prevMatches"] = sorted(
                row["prevMatches"], key=lambda x: x["date"], reverse=True
            )

    @staticmethod
    def _init_prev_matches(team_names: list[str]):
        prev_matches: dict[str, list[dict[str, datetime | Scoreline]]] = {}
        for team in team_names:
            prev_matches[team] = []
        return prev_matches

    def _get_season_prev_matches(
        self, next_games: dict, raw_data: RawData, season: int, teams: list[str]
    ):
        if teams is None:
            raise ValueError("Cannot build upcoming DataFrame: Teams names list empty.")

        season_fixtures = raw_data.fixtures[season]

        prev_matches: dict[str, datetime | Scoreline] = self._init_prev_matches(teams)
        for match in season_fixtures:
            if match["status"] != "FINISHED":
                continue

            home_team = clean_full_team_name(match["homeTeam"]["name"])
            away_team = clean_full_team_name(match["awayTeam"]["name"])

            if home_team not in teams or away_team not in teams:
                continue

            home_goals, away_goals = full_time_goals(match)

            date = match["utcDate"]

            # From the perspective from the home team
            # If this match's home team has their next game against this match's away team
            home_team_next_opposition = next_games[home_team]["team"]
            if home_team_next_opposition == away_team:
                prev_matches[home_team].append(
                    {
                        "date": date,
                        "result": Scoreline(
                            home_goals, away_goals, home_team, away_team
                        ),
                    }
                )

            away_team_next_opposition = next_games[away_team]["team"]
            if away_team_next_opposition == home_team:
                prev_matches[away_team].append(
                    {
                        "date": date,
                        "result": Scoreline(
                            home_goals, away_goals, home_team, away_team
                        ),
                    }
                )

        return prev_matches

    def _merge_predictions_into_upcoming(
        self, upcoming: DataFrame, predictions: DataFrame
    ):
        upcoming = upcoming.rename(
            columns={column: (column, "") for column in upcoming.columns.tolist()}
        )
        upcoming.columns = pd.MultiIndex.from_tuples(upcoming.columns)
        upcoming = pd.concat([upcoming, predictions], axis=1)
        return upcoming

    def _calc_next_game_predictions(self, predictor: FormPredictor, upcoming: DataFrame):
        next_game_predictions: list[dict[str, int]] = []
        next_game_predictions_cache: dict[tuple[str, str], Scoreline] = {}
        for team, row in upcoming.iterrows():
            opponent = row["team"]
            at_home = row["atHome"]

            if opponent is None or at_home is None:
                next_game_predictions.append(None)
                continue

            home_team = team if at_home else opponent
            away_team = opponent if at_home else team
            if (home_team, away_team) in next_game_predictions_cache:
                prediction = next_game_predictions_cache[(home_team, away_team)]
            else:
                prediction = predictor.predict_score(home_team, away_team)
                next_game_predictions_cache[(home_team, away_team)] = prediction
            next_game_predictions.append(prediction)
        return next_game_predictions

    def _init_teams(self, fixtures: Fixtures):
        d: dict[str, dict[str, Optional[str] | list]] = {}
        teams = fixtures.df.index.to_list()
        next_matchdays = self._next_matchday_by_team(fixtures)
        for team in teams:
            date, opposition, at_home = self._get_next_game(
                team, fixtures, next_matchdays[team]
            )
            d[team] = {
                "date": date,
                "team": opposition,
                "atHome": at_home,
                "prevMatches": [],
            }
        return d

    def build(
        self,
        raw_data: RawData,
        fixtures: Fixtures,
        form: Form,
        team_ratings: TeamRatings,
        home_advantages: HomeAdvantages,
        season: int,
        num_seasons: int = 3,
        display: bool = False,
    ):
        """Assigns self.df a DataFrame for details about the next game each team
            has to play.

            Rows: the 20 teams participating in the current season
            Columns:
            -------------------------------------------------------
            | date | team | atHome | prevMatches | prediction |

            date: the datetime of the upcoming match.
            team: name of the opposition team in a team's next game.
            atHome: whether the team is playing the next match at home or away,
                either True or False.
            prevMatches: list of previous match dictionaries containing the
                date, home team, away team, home goals, away goals, match result
                for each recorded previous match between the two teams.
            prediction: a Scoreline object containing predicted integer goals
                for each team.
        Args:
            json_dict dict: the json data storage used to build the DataFrame.
            fixtures Fixtures: a completed DataFrame containing past and future
                fixtures for each team within the current season.
            form Form: a completed DataFrame containing a snapshot of information
                regarding each team's form after each completed matchday.
            home_advantages HomeAdvantages: a completed DataFrame containing the
                quantified home advantage each team receives.
            season int: the year of the current season.
            num_seasons (int, optional): number of seasons to include. Defaults to 3.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        d = self._init_teams(fixtures)

        teams = fixtures.df.index.to_list()
        for i in range(num_seasons):
            prev_matches = self._get_season_prev_matches(
                d, raw_data, season - i, teams
            )
            for team, matches in prev_matches.items():
                d[team]["prevMatches"].extend(matches)

        self._sort_prev_matches_by_date(d)

        upcoming = pd.DataFrame.from_dict(d, orient="index")
        upcoming.index.name = "team"

        predictor = FormPredictor(
            raw_data,
            fixtures,
            form,
            team_ratings,
            home_advantages,
            season,
            num_seasons,
        )
        next_game_predictions = self._calc_next_game_predictions(predictor, upcoming)
        upcoming["prediction"] = next_game_predictions

        if display:
            print(upcoming)

        self.df = upcoming

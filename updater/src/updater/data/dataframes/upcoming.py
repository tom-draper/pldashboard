from datetime import datetime
from typing import Optional

import pandas as pd
from pandas import DataFrame
from updater.fmt import clean_full_team_name, convert_team_name_or_initials, get_full_time_goals
from updater.predictions.predictor import Predictor
from updater.predictions.scoreline import Scoreline

from .df import DF
from .fixtures import Fixtures
from .form import Form
from .home_advantages import HomeAdvantages
from .team_ratings import TeamRatings


class Upcoming(DF):
    def __init__(self, d: DataFrame = DataFrame()):
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

    def _all_next_matchdays(self, fixtures: Fixtures) -> pd.Series:
        """Vectorised: find each team's next scheduled matchday in one pass."""
        now = datetime.now()
        matchday_nos = sorted(
            md for md in fixtures.df.columns.unique(level=0) if isinstance(md, int)
        )
        status_df = (
            fixtures.df.loc[:, pd.IndexSlice[matchday_nos, "status"]]
            .droplevel(1, axis=1)
        )
        date_df = (
            fixtures.df.loc[:, pd.IndexSlice[matchday_nos, "date"]]
            .droplevel(1, axis=1)
        )
        is_valid = status_df.isin(["SCHEDULED", "TIMED"]) & (date_df > now)
        # idxmin returns the column (matchday) with the earliest valid date;
        # NaN for teams with no upcoming game
        return date_df.where(is_valid).idxmin(axis=1, skipna=True)

    def _get_season_prev_matches(
        self, next_games: dict, json_data: dict, season: int, teams: list[str]
    ):
        if teams is None:
            raise ValueError("Cannot build upcoming DataFrame: Teams names list empty.")

        season_fixtures = json_data["fixtures"][season]

        prev_matches: dict[str, list] = {team: [] for team in teams}
        for match in season_fixtures:
            if match["status"] != "FINISHED":
                continue

            home_team = clean_full_team_name(match["homeTeam"]["name"])
            away_team = clean_full_team_name(match["awayTeam"]["name"])

            if home_team not in teams or away_team not in teams:
                continue

            home_goals, away_goals = get_full_time_goals(match["score"]["fullTime"])

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

    def _calc_next_game_predictions(self, predictor: Predictor, upcoming: DataFrame):
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
        next_matchdays = self._all_next_matchdays(fixtures)
        for team in teams:
            next_matchday = next_matchdays.get(team)
            # idxmin returns NaN (float) when all candidates are NaN
            if next_matchday is None or (
                isinstance(next_matchday, float) and pd.isna(next_matchday)
            ):
                next_matchday = None
            date = None
            opposition = None
            at_home = None
            if next_matchday is not None:
                date = fixtures.df.at[team, (next_matchday, "date")]
                opposition = fixtures.df.at[team, (next_matchday, "team")]
                at_home = fixtures.df.at[team, (next_matchday, "atHome")]
            d[team] = {
                "date": date,
                "team": opposition,
                "atHome": at_home,
                "prevMatches": [],
            }
        return d

    def build(
        self,
        json_data: dict,
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
                d, json_data, season - i, teams
            )
            for team, matches in prev_matches.items():
                d[team]["prevMatches"].extend(matches)

        for row in d.values():
            row["prevMatches"].sort(key=lambda x: x["date"], reverse=True)

        upcoming = pd.DataFrame.from_dict(d, orient="index")
        upcoming.index.name = "team"

        predictor = Predictor(
            json_data,
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

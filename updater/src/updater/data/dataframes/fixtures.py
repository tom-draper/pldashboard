from typing import Optional
from collections import defaultdict
from datetime import datetime

import pandas as pd
from pandas import DataFrame
from updater.fmt import clean_full_team_name, convert_team_name_or_initials
from timebudget import timebudget

from .df import DF
from updater.data.raw_data import RawData


class Fixtures(DF):
    def __init__(self, d: Optional[DataFrame] = None):
        super().__init__(d, "fixtures")

    @staticmethod
    def _inc_avg_scored_conceded(
        avg_scored: float, avg_conceded: float, score: dict[str, int], at_home: bool
    ):
        if at_home:
            avg_scored += score["homeGoals"]
            avg_conceded += score["awayGoals"]
        else:
            avg_scored += score["awayGoals"]
            avg_conceded += score["homeGoals"]

        return avg_scored, avg_conceded

    def get_avg_result(self, team: str):
        avg_scored = 0.0
        avg_conceded = 0.0
        total = 0.0
        for matchday_no in self.df.columns.unique(level=0):
            if self.df.at[team, (matchday_no, "status")] != "FINISHED":
                continue
            at_home = self.df.at[team, (matchday_no, "atHome")]
            score = self.df.at[team, (matchday_no, "score")]
            avg_scored, avg_conceded = self._inc_avg_scored_conceded(
                avg_scored, avg_conceded, score, at_home
            )
            total += 1

        if total > 0:
            avg_scored = avg_scored / total
            avg_conceded = avg_conceded / total

        return avg_scored, avg_conceded

    def get_actual_scores(self):
        # To contain a tuple for all actual scores so far this season
        actual_scores: dict[tuple[str, str], dict[str, int]] = {}

        for matchday_no in range(1, 39):
            matchday = self.df[matchday_no]

            # If whole column is SCHEDULED, skip
            if all(matchday["status"] == "SCHEDULED") or all(matchday["status"] == "TIMED"):
                continue

            for team, row in matchday.iterrows():
                if row["status"] != "FINISHED":
                    continue
                if row["atHome"]:
                    home_name = team
                    away_name = row["team"]
                else:
                    home_name = row["team"]
                    away_name = team
                home_initials = convert_team_name_or_initials(home_name)
                away_initials = convert_team_name_or_initials(away_name)

                actual_scores[f"{home_initials} vs {away_initials}"] = row["score"]

        return actual_scores

    @staticmethod
    def _insert_team_row(
        columns: dict[tuple[int, str], dict[str, object]],
        match: dict,
        home_team: bool,
    ):
        """Record one team's view of a match into the column store.

        Values are keyed by team name rather than appended positionally, so the
        DataFrame is assembled by label in one pass instead of building a frame
        per matchday and concatenating 38 of them.
        """
        # Trailing 'Z' is stripped rather than parsed so the result stays naive,
        # matching the previous strptime("...%SZ") behaviour. fromisoformat is
        # ~25x faster and this runs once per team per match.
        date = datetime.fromisoformat(match["utcDate"][:-1])

        if home_team:
            team = clean_full_team_name(match["homeTeam"]["name"])
            opposition = clean_full_team_name(match["awayTeam"]["name"])
        else:
            team = clean_full_team_name(match["awayTeam"]["name"])
            opposition = clean_full_team_name(match["homeTeam"]["name"])

        # Data API v4 renamed 'homeTeam' to 'home'
        full_time = match["score"]["fullTime"]
        home_goals = full_time["home"] if "home" in full_time else full_time["homeTeam"]
        away_goals = full_time["away"] if "away" in full_time else full_time["awayTeam"]
        if home_goals is not None:
            score = {
                "homeGoals": home_goals,
                "awayGoals": away_goals,
            }
        else:
            score = None

        matchday_no = match["matchday"]
        columns[(matchday_no, "date")][team] = date
        columns[(matchday_no, "atHome")][team] = home_team
        columns[(matchday_no, "team")][team] = opposition
        columns[(matchday_no, "status")][team] = match["status"]
        columns[(matchday_no, "score")][team] = score

    @timebudget
    def build(self, raw_data: RawData, season: int, display: bool = False):
        """ Builds a DataFrame containing the past and future fixtures for the
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
            raw_data dict: the json data storage used to build the DataFrame
            season int: the year of the current season
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        data = raw_data.fixtures[season]

        # Column store keyed by (matchday, field) -> {team: value}. Sorting the
        # matches by matchday keeps the resulting column order matchday-ordered.
        columns: dict[tuple[int, str], dict[str, object]] = defaultdict(dict)
        for match in sorted(data, key=lambda x: x["matchday"]):
            self._insert_team_row(columns, match, True)
            self._insert_team_row(columns, match, False)

        fixtures = pd.DataFrame(columns)
        fixtures.columns = pd.MultiIndex.from_tuples(
            fixtures.columns, names=("matchday", None)
        )
        fixtures.index.name = "team"
        fixtures.sort_index(inplace=True)

        if display:
            print(fixtures)

        self.df = fixtures

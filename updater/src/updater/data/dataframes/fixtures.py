from collections import defaultdict
from datetime import datetime

import pandas as pd
from pandas import DataFrame
from updater.fmt import clean_full_team_name, convert_team_name_or_initials, get_full_time_goals
from timebudget import timebudget

from .df import DF


class Fixtures(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "fixtures")

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
        matchday: int, match: dict, teams: list[str], home_team: bool
    ):
        date = datetime.strptime(match["utcDate"], "%Y-%m-%dT%H:%M:%SZ")

        if home_team:
            team = clean_full_team_name(match["homeTeam"]["name"])
            opposition = clean_full_team_name(match["awayTeam"]["name"])
        else:
            team = clean_full_team_name(match["awayTeam"]["name"])
            opposition = clean_full_team_name(match["homeTeam"]["name"])

        home_goals, away_goals = get_full_time_goals(match["score"]["fullTime"])
        if home_goals is not None:
            score = {
                "homeGoals": home_goals,
                "awayGoals": away_goals,
            }
        else:
            score = None

        matchday[(match["matchday"], "date")].append(date)
        matchday[(match["matchday"], "atHome")].append(home_team)
        matchday[(match["matchday"], "team")].append(opposition)
        matchday[(match["matchday"], "status")].append(match["status"])
        matchday[(match["matchday"], "score")].append(score)
        teams.append(team)

    @timebudget
    def build(self, json_data: dict, season: int, display: bool = False):
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
            score: the score of that game as {'homeGoals': int, 'awayGoals': int}
                if status is 'FINISHED', or None otherwise

        Args:
            json_data dict: the json data storage used to build the DataFrame
            season int: the year of the current season
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        data = json_data["fixtures"][season]

        teams_by_matchday: dict[int, list[str]] = defaultdict(list)
        matchday_data: dict[int, dict[tuple[int, str], list]] = defaultdict(
            lambda: defaultdict(list)
        )
        matchdays: list[DataFrame] = []
        for match in data:
            current_matchday = match["matchday"]
            current_matchday_data = matchday_data[current_matchday]
            current_teams = teams_by_matchday[current_matchday]
            self._insert_team_row(current_matchday_data, match, current_teams, True)
            self._insert_team_row(current_matchday_data, match, current_teams, False)

        teams_index = teams_by_matchday.get(1, [])[:]
        for current_matchday in sorted(matchday_data):
            df_matchday = pd.DataFrame(matchday_data[current_matchday])
            df_matchday.index = teams_by_matchday[current_matchday]
            matchdays.append(df_matchday)

        fixtures = pd.concat(matchdays, axis=1)

        fixtures.index = teams_index
        fixtures.columns.names = ("matchday", None)
        fixtures.index.name = "team"
        fixtures.sort_index(inplace=True)

        if display:
            print(fixtures)

        self.df = fixtures

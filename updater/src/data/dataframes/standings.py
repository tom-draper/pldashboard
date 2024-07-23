import pandas as pd
from pandas import DataFrame
from src.format import clean_full_team_name
from timebudget import timebudget

from .df import DF


class Standings(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "standings")

    @staticmethod
    def get_team_names(json_data: dict, season: int):
        data = json_data["standings"][season]
        teams = [clean_full_team_name(row["team"]["name"]) for row in data]
        return teams

    def _season_standings(self, json_data: dict, current_teams: list[str], season: int):
        data = json_data["standings"][season]
        df = pd.DataFrame.from_dict(data)

        # Rename teams to their team name
        teams = self.get_team_names(json_data, season) 
        df = df.drop(columns=["form", "team"])
        df.index = teams

        col_headings = [
            "position",
            "played",
            "won",
            "drawn",
            "lost",
            "points",
            "gF",
            "gA",
            "gD",
        ]
        df.columns = pd.MultiIndex.from_product([[season], col_headings])

        df = df.drop(index=df.index.difference(current_teams))

        return df

    @staticmethod
    def clean_dataframe(standings: DataFrame):
        standings = standings.fillna(0).astype(int)
        standings.index.name = "team"
        standings.columns.names = ("Season", None)
        return standings

    @timebudget
    def build(
        self, json_data: dict, season: int, num_seasons: int = 3, display: bool = False
    ):
        """ Assigns self.df to a DataFrame containing all table standings for
            each season from current season to season [num_seasons] years ago.

            Rows: the 20 teams participating in the current season, ordered ascending
                by the team's position in the current season
            Columns (multi-index):
            -----------------------------------------------------------------
            |                         [SEASON YEAR]                         |
            |---------------------------------------------------------------|
            | position | played | won | draw | lost | gF | gA | gD | points |

            [SEASON YEAR]: 4-digit year values that a season began, from current
                season to season num_seasons ago
            position: unique integer from 1 to 20 depending on the table position
                the team holds in the season
            played: the number of games the team has played in the season.
            won: the number of games the team has won in the season.
            drawn: the number of games the team has drawn in the season.
            lost: the number of games the team has lost in the season.
            gF: goals for - the number of goals the team has scored in this season.
            gA: goals against - the number of games the team has lost in the season.
            gD: the number of games the team has lost in the season.
            points: the points acquired by the team.

        Args:
            json_data dict: the json data storage used to build the DataFrame.
            season: the year of the current season.
            num_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        standings = pd.DataFrame()

        teams = self.get_team_names(json_data, season)

        # Loop from current season to the season 2 years ago
        for n in range(num_seasons):
            season_standings = self._season_standings(json_data, teams, season - n)
            standings = pd.concat((standings, season_standings), axis=1)

        standings = self.clean_dataframe(standings)

        if display:
            print(standings)

        self.df = standings

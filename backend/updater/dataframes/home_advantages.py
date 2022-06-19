from collections import defaultdict

import pandas as pd
from timebudget import timebudget
from pandas import DataFrame

from dataframes.df import DF


class HomeAdvantages(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'home_advantages')

    @staticmethod
    def _home_advantages_for_season(d: defaultdict, data: dict, season: int):
        for match in data:
            if match['score']['winner'] is not None:
                home_team = match['homeTeam']['name'].replace('&', 'and')
                away_team = match['awayTeam']['name'].replace('&', 'and')
                home_goals = match['score']['fullTime']['homeTeam']
                away_goals = match['score']['fullTime']['awayTeam']
                if home_goals > away_goals:
                    # Home team wins
                    d[home_team][(season, 'Home', 'Wins')] += 1
                    d[away_team][(season, 'Away', 'Loses')] += 1
                elif home_goals < away_goals:
                    # Away team wins
                    d[home_team][(season, 'Home', 'Loses')] += 1
                    d[away_team][(season, 'Away', 'Wins')] += 1
                else:
                    # Draw
                    d[home_team][(season, 'Home', 'Draws')] += 1
                    d[away_team][(season, 'Away', 'Draws')] += 1

    @staticmethod
    def _create_season_home_advantage_col(
        home_advantages: DataFrame,
        season: int
    ):
        played_at_home = home_advantages[season]['Home']['Wins'] \
            + home_advantages[season]['Home']['Draws'] \
            + home_advantages[season]['Home']['Loses']
        home_advantages[season, 'Home', 'Played'] = played_at_home

        # Percentage wins at home = total wins at home / total games played at home
        win_ratio_at_home = home_advantages[season]['Home']['Wins'] / \
            played_at_home
        home_advantages[season, 'Home', 'WinRatio'] = win_ratio_at_home

        played = played_at_home \
            + home_advantages[season]['Away']['Wins'] \
            + home_advantages[season]['Away']['Draws'] \
            + home_advantages[season]['Away']['Loses']
        home_advantages[season, 'Overall', 'Played'] = played

        # Percentage wins = total wins / total games played
        win_ratio = (home_advantages[season]['Home']['Wins']
                     + home_advantages[season]['Away']['Wins']) / played
        home_advantages[season, 'Overall', 'WinRatio'] = win_ratio

        # Home advantage = percentage wins at home - percentage wins
        home_advantage = win_ratio_at_home - win_ratio
        home_advantages[season, 'HomeAdvantage', ''] = home_advantage

    @staticmethod
    def _create_total_home_advantage_col(
        home_advantages: DataFrame,
        season: int,
        threshold: float
    ):
        home_advantages_cols = home_advantages.iloc[:, home_advantages.columns.get_level_values(
            1) == 'HomeAdvantage']
        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[season]['Home']['Played'] <= threshold).all():
            print(f"Current season excluded from home advantages calculation -> all teams must have played {threshold} home games.")
            # Drop this current seasons column (start from previous season)
            home_advantages_cols = home_advantages_cols.drop(
                season, level=0, axis=1)

        # Drop pandemic year (anomaly, no fans, data shows neutral home advantage)
        if (2020, 'HomeAdvantage', '') in list(home_advantages_cols.columns):
            home_advantages_cols = home_advantages_cols.drop(
                (2020, 'HomeAdvantage', ''), axis=1)

        home_advantages = home_advantages.sort_index(axis=1)
        home_advantages['TotalHomeAdvantage'] = home_advantages_cols.mean(
            axis=1).fillna(0)
        home_advantages = home_advantages.sort_values(
            by='TotalHomeAdvantage', ascending=False)

        return home_advantages

    @staticmethod
    def _row_template(
        season: int,
        no_seasons: int
    ) -> dict[tuple[int, str, str], int]:
        template = {}
        for i in range(no_seasons):
            template.update({(season-i, 'Home', 'Wins'):  0,
                             (season-i, 'Home', 'Draws'): 0,
                             (season-i, 'Home', 'Loses'): 0,
                             (season-i, 'Away', 'Wins'):  0,
                             (season-i, 'Away', 'Draws'): 0,
                             (season-i, 'Away', 'Loses'): 0})
        return template

    @staticmethod
    def _clean_dataframe(home_advantages: DataFrame, current_season_teams: list[str]) -> DataFrame:
        home_advantages = home_advantages.drop(
            columns=['Wins', 'Loses', 'Draws'], level=2)
        home_advantages = home_advantages.loc[current_season_teams]
        home_advantages.columns.names = ('Season', None, None)
        home_advantages.index.name = 'Team'
        return home_advantages

    @staticmethod
    def get_season_teams(season_fixtures_data):
        current_season_teams = set()
        for match in season_fixtures_data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')
            current_season_teams.add(home_team)
            current_season_teams.add(away_team)
        return current_season_teams

    @timebudget
    def build(
        self,
        json_data: dict,
        season: int,
        threshold: float,
        no_seasons: int = 3,
        display: bool = False
    ):
        """ Assigns self.df a dataframe containing team's home advantage data 
            for each season with a combined total home advantage value.

            Rows: the 20 teams participating in the current season, ordered descending 
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------
            |                     [SEASON YEAR]                     | TotalHomeAdvantage |
            |-------------------------------------------------------|--------------------|
            |       Home        |      Overall      | HomeAdvantage |                    |
            |-------------------|-------------------|---------------|                    |
            | Played | WinRatio | Played | WinRatio |               |                    |

            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago.
            Played: the number of games played in the season.
            WinsRatio: the win ratio of all games played in the season.
            HomeAdvantage: the difference between the ratio of games won at home 
                and the ratio of games won in total for a given season year.
            TotalHomeAdvantage: combined home advantages value from all seasons 
               in the table: the average home wins ratio / wins ratio.

        Args:
            json_data dict: the json data storage used to build the dataframe
            season int: the year of the current season
            threshold float: the minimum number of home games played to incorporate
                a season's home advantage calculation for all teams into the 
                Total Home Advantage value
            no_seasons (int, optional): number of seasons to include. 
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building home advantages dataframe... ')

        d = defaultdict(lambda: self._row_template(season, no_seasons))
        for i in range(no_seasons):
            data = json_data['fixtures'][season-i]
            self._home_advantages_for_season(d, data, season-i)

        home_advantages = pd.DataFrame.from_dict(d, orient='index')
        home_advantages = home_advantages.fillna(0).astype(int)

        # Calculate home advantages for each season
        for i in range(no_seasons):
            self._create_season_home_advantage_col(home_advantages, season-i)

        # Create the final overall home advantage value for each team
        home_advantages = self._create_total_home_advantage_col(
            home_advantages, season, threshold)

        # Remove working columns
        current_season_teams = self.get_season_teams(
            json_data['fixtures'][season])
        home_advantages = self._clean_dataframe(
            home_advantages, current_season_teams)

        if display:
            print(home_advantages)

        self.df = home_advantages

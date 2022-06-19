import pandas as pd
from pandas import DataFrame
from timebudget import timebudget

from dataframes.df import DF


class Standings(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'standings')

    def get_position(self, team_name: str, season: int) -> DataFrame:
        return self.df.at[team_name, (season, 'Position')]

    def get_table_snippet(
        self,
        team_name: str,
        season: int
    ) -> tuple[list[tuple[int, str, int, int]], int]:
        team_df_idx = self.df.index.get_loc(team_name)

        # Get range of table the snippet should cover
        # Typically 3 teams below + 3 teams above, unless near either end of the table
        low_idx = team_df_idx - 3
        high_idx = team_df_idx + 4
        if low_idx < 0:
            # Add overflow amount to the high_idx to ensure 7 teams
            overflow = low_idx
            high_idx -= low_idx  # Subtracting a negative
            low_idx = 0
        if high_idx > self.df.shape[0] - 1:
            # Subtract overflow amount from the low_idx to ensure 7 teams
            overflow = high_idx - (self.df.shape[0])
            low_idx -= overflow
            high_idx = self.df.shape[0]

        rows = self.df.iloc[low_idx:high_idx]
        team_names = rows.index.values.tolist()
        # Remove 'FC' from end of each team name (nicer to display)
        team_names = list(map(lambda name: ' '.join(
            name.split(' ')[:-1]), team_names))
        # Get new index of this team, relative to section of rows dataframe
        team_idx = rows.index.get_loc(team_name)

        # Only keep relevant columns
        rows = rows[season][['Position', 'GD', 'Points']]

        # List of table rows: [ [pos, name, gd, points] ... ]
        table_snippet = rows.values.tolist()
        # Add the team names into position 1 of each table row
        for row_list, team_name in zip(table_snippet, team_names):
            row_list.insert(1, team_name)

        return table_snippet, team_idx

    @staticmethod
    def _fill_rows_from_data(data: dict) -> dict[str, dict[str, int]]:
        df_rows = {}  # type: dict[str, dict[str, int]]
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')
            # Init teams if doesn't already exits
            for team in [home_team, away_team]:
                if team not in df_rows:
                    df_rows[team] = {'Position': None, 'Played': 0, 'Won': 0, 
                                     'Drawn': 0, 'Lost': 0, 'GF': 0, 'GA': 0,
                                     'GD': 0, 'Points': 0}

            if match['status'] == 'FINISHED':
                home_goals = match['score']['fullTime']['homeTeam']
                away_goals = match['score']['fullTime']['awayTeam']

                # Increment Played
                df_rows[home_team]['Played'] += 1
                df_rows[away_team]['Played'] += 1
                # Add GF
                df_rows[home_team]['GF'] += home_goals
                df_rows[away_team]['GF'] += away_goals
                # Add GA
                df_rows[home_team]['GA'] += away_goals
                df_rows[away_team]['GA'] += home_goals

                # Record result and points
                if home_goals > away_goals:  # Home team win
                    df_rows[home_team]['Won'] += 1
                    df_rows[away_team]['Lost'] += 1
                    # Points
                    df_rows[home_team]['Points'] += 3
                elif home_goals < away_goals:
                    df_rows[home_team]['Lost'] += 1
                    df_rows[away_team]['Won'] += 1
                    # Points
                    df_rows[away_team]['Points'] += 3
                else:  # Draw
                    df_rows[home_team]['Drawn'] += 1
                    df_rows[away_team]['Drawn'] += 1
                    # Points
                    df_rows[home_team]['Points'] += 1
                    df_rows[away_team]['Points'] += 1

        return df_rows

    @staticmethod
    def _add_gd_col(df_rows: dict):
        for team in df_rows.keys():
            df_rows[team]['GD'] = df_rows[team]['GF'] - df_rows[team]['GA']

    @staticmethod
    def _add_position_col(df_rows: dict):
        for idx, team in enumerate(df_rows.keys()):
            # Position is index as they have been sorted by points
            df_rows[team]['Position'] = idx + 1

    def _season_standings_from_fixtures(
        self,
        json_data: dict,
        team_names: list[str],
        season: int
    ) -> DataFrame:
        """Slower alternative to _season_standings"""
        data = json_data['fixtures'][season]

        df_rows = self._fill_rows_from_data(data)
        self._add_gd_col(df_rows)

        # Sort rows by Points, then GD, then GF
        df_rows = dict(sorted(df_rows.items(), key=lambda v: [
                       v[1]['Points'], v[1]['GD'], v[1]['GF']], reverse=True))
        # Use df sorted by points to insert table position
        self._add_position_col(df_rows)

        df = pd.DataFrame.from_dict(df_rows, orient='index')
        col_headings = ['Position', 'Played', 'Won',
                        'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']
        df.columns = pd.MultiIndex.from_product([[season], col_headings])

        # Drop any rows with columns not in the current season
        df = df.drop(df[~df.index.isin(team_names)].index)
        return df

    @staticmethod
    def _season_standings(
        json_data: dict,
        current_teams: list[str],
        season: int
    ) -> DataFrame:
        data = json_data['standings'][season]
        df = pd.DataFrame(data)

        # Rename teams to their team name
        team_names = [name.replace('&', 'and') for name in [
            df['team'][x]['name'] for x in range(len(df))]]
        df = df.drop(columns=['form', 'team'])
        df.index = team_names

        # Move points column to the end
        points_col = df.pop('points')
        df.insert(8, 'points', points_col)
        col_headings = ['Position', 'Played', 'Won',
                        'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']
        df.columns = pd.MultiIndex.from_product([[season], col_headings])

        df = df.drop(index=df.index.difference(current_teams))
        return df

    @timebudget
    def build(
        self,
        json_data: dict,
        team_names: list[str],
        season: int,
        no_seasons: int = 3,
        display: bool = False
    ):
        """ Assigns self.df to a dataframe containing all table standings for 
            each season from current season to season [no_seasons] years ago.

            Rows: the 20 teams participating in the current season, ordered ascending 
                by the team's position in the current season 
            Columns (multi-index):
            -----------------------------------------------------------------
            |                         [SEASON YEAR]                         |
            |---------------------------------------------------------------|
            | Position | Played | Won | Draw | Lost | GF | GA | GD | Points | 

            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago
            Position: unique integer from 1 to 20 depending on the table position 
                the team holds in the season
            Played: the number of games the team has played in the season.
            Won: the number of games the team has won in the season.
            Drawn: the number of games the team has drawn in the season.
            Lost: the number of games the team has lost in the season.
            GF: goals for - the number of goals the team has scored in this season.
            GA: goals against - the number of games the team has lost in the season.
            GD: the number of games the team has lost in the season.
            Points: the points aquired by the team.

        Args:
            json_data dict: the json data storage used to build the dataframe
            team_names list: the team names of the teams within the current season
            season: the year of the current season
            no_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building standings dataframe...')

        # Check for dependencies
        if not team_names:
            raise ValueError(
                '❌ [ERROR] Cannot build standings dataframe: Team names list not available')

        standings = pd.DataFrame()

        # Loop from current season to the season 2 years ago
        for n in range(no_seasons):
            season_standings = self._season_standings(
                json_data, team_names, season - n)
            standings = pd.concat((standings, season_standings), axis=1)

        standings = standings.fillna(0).astype(int)
        standings.index.name = 'Team'
        standings.columns.names = ('Season', None)

        if display:
            print(standings)

        self.df = standings

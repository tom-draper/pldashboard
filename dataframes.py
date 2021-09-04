from typing import List, Tuple, Optional
import pandas as pd
from pandas.core.frame import DataFrame


class DF:
    def __init__(self, d: dict):
        self.df = pd.DataFrame(d)
    
    def __str__(self):
        return str(self.df)


class Fixtures(DF):
    def __init__(self, d: dict):
        super().__init__(d)
    
class Form(DF):
    def __init__(self, d: dict):
        super().__init__(d)
    
    def get_current_matchday(self) -> Optional[int]:
        current_matchday = None
        if len(self.df.columns) > 0:
            current_matchday = list(self.df.columns.unique(level=0))[-1]
        return current_matchday

    def get_prev_matchday(self) -> int:
        prev_matchday = None
        if len(self.df.columns) > 0:
            prev_matchday = list(self.df.columns.unique(level=0))[-2]
        return prev_matchday
    
    def n_should_have_played(self, current_matchday: int, maximum: int) -> int:
        n_should_have_played = maximum
        if current_matchday < maximum:
            n_should_have_played = current_matchday
        return n_should_have_played

    def not_played_current_matchday(self, recent_games: List[str], current_matchday: int) -> bool:
        n_should_have_played = self.n_should_have_played(current_matchday, 5)
        return len(recent_games) != n_should_have_played

    def get_form(self, team_name: str) -> List[str]:
        form = []
        current_matchday = self.get_current_matchday()
        if current_matchday:
            form = self.df[current_matchday].loc[team_name]['Form']
                    
            if self.not_played_current_matchday(form, current_matchday):
                # Use previous matchday's form
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                form = self.df[previous_matchday].loc[team_name]['Form']
            if form == None:
                form = []
            else:
                form = list(form)
            form = form + ['None'] * (5 - len(form))  # Pad list

        return form

    def get_recent_teams_played(self, team_name: str) -> pd.DataFrame:
        recent_teams_played = pd.DataFrame()
        current_matchday= self.get_current_matchday()
        
        if current_matchday:
            recent_teams_played = self.df[current_matchday].loc[team_name]['TeamsPlayed']
            
            if self.not_played_current_matchday(recent_teams_played, current_matchday):
                # Use previous matchday's games played list
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                recent_teams_played = self.df[previous_matchday].loc[team_name]['TeamsPlayed']
                
        return recent_teams_played
    
    def get_current_form_rating(self, team_name: str) -> float:
        rating = 0        
        current_matchday = self.get_current_matchday()

        if current_matchday:
            latest_teams_played = self.df[current_matchday].loc[team_name]['TeamsPlayed']
            matchday = current_matchday

            if self.not_played_current_matchday(latest_teams_played, current_matchday):
                # Use previous matchday data
                matchday = self.get_prev_matchday()
            rating = (self.df[matchday].loc[team_name]['FormRating'] * 100).round(1)
            
        return rating
    
    def get_won_against_star_team(self, team_name: str) -> List[str]:
        won_against_star_team = []  # type: List[str]
        current_matchday = self.get_current_matchday()
        
        if current_matchday:
            won_against_star_team = self.df[current_matchday].loc[team_name]['WonAgainstStarTeam']
            
            if self.not_played_current_matchday(won_against_star_team, current_matchday):
                # Use previous matchday data
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                won_against_star_team = self.df[previous_matchday].loc[team_name]['Won Against Star Team']
                
            # Replace boolean values with CSS tag for super win image
            won_against_star_team = ['star-team' if x else 'not-star-team' for x in won_against_star_team]
        return won_against_star_team

    def get_recent_form(self, team_name: str) -> Tuple[List[str], DataFrame, float, List[bool]]:
        form_str = self.get_form(team_name)  # List of five 'W', 'D' or 'L'
        recent_teams_played = self.get_recent_teams_played(team_name)
        rating = self.get_current_form_rating(team_name)
        won_against_star_team = self.get_won_against_star_team(team_name)
        return form_str, recent_teams_played, rating, won_against_star_team

class Standings(DF):
    def __init__(self, d: dict):
        super().__init__(d)
        
    def get_position(self, team_name: str, season: int) -> pd.DataFrame:
        return self.df.loc[team_name, season]['Position']
    
    def get_table_snippet(self, team_name: str, season: int) -> Tuple[List[Tuple[int, str, int, int]], int]:
        team_df_idx = self.df.index.get_loc(team_name)
        
        # Get range of table the snippet should cover
        # Typically 3 teams below + 3 teams above, unless near either end of the table
        low_idx = team_df_idx-3
        high_idx = team_df_idx+4
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
        team_names = list(map(lambda name: ' '.join(name.split(' ')[:-1]), team_names))
        # Get new index of this team, relative to section of rows dataframe
        team_idx = rows.index.get_loc(team_name)

        # Only keep relevant columns
        rows = rows[season][['Position', 'GD', 'Points']]
        
        # List of table rows: [ [pos, name, gd, points] ... ]
        table_snippet = rows.values.tolist()
        # Add the team name into position 1 of each table row
        for row_list, team_name in zip(table_snippet, team_names):
            row_list.insert(1, team_name)
                    
        return table_snippet, team_idx

class NextGames(DF):
    def __init__(self, d: DataFrame):
        super().__init__(d)
    
    def get_opposition(self, team_name: str) -> str:
        return self.df['NextTeam'].loc[team_name]
    
    def get_previous_meetings(self, team_name: str):
        return self.df.loc[team_name]['PreviousMeetings']
    
    def get_home_away(self, team_name: str):
        return self.df['HomeAway'].loc[team_name]

    def get_details(self, team_name: str) -> Tuple[str, bool or None, List]:
        opp_team_name = ''
        home_away = None
        prev_meetings = []

        if not self.df.empty:
            # If season not finished
            opp_team_name = self.get_opposition(team_name)
            home_away = self.get_home_away(team_name)
            prev_meetings = self.get_previous_meetings(team_name)
            
        return opp_team_name, home_away, prev_meetings


class SeasonStats(DF):
    def __init__(self, d: dict):
        super().__init__(d)
    
    def format_position(self, position: int) -> str:
        j = position % 10
        k = position % 100
        position_str = str(position)
        
        if j == 1 and k != 11:
            return position_str + 'st'
        if j == 2 and k != 12:
            return position_str + 'nd'
        if j == 3 and k != 13:
            return position_str + 'rd'
        return position_str + 'th'
    
    def get_stat(self, team_name: str, col_heading: str, ascending: bool) -> Tuple[float, str]:
        stat = self.df[col_heading][team_name]
        position = self.df[col_heading].sort_values(ascending=ascending).index.get_loc(team_name) + 1
        position = self.format_position(position)
        return stat, position
    
    def get_season_stats(self, team_name: str) -> Tuple[float, str, float, str, float, str]:
        clean_sheet_ratio, csr_position = self.get_stat(team_name, 'CleanSheetRatio', False)
        goals_per_game, gpg_position = self.get_stat(team_name, 'GoalsPerGame', False)
        conceded_per_game, cpg_position = self.get_stat(team_name, 'ConcededPerGame', True)
        
        return clean_sheet_ratio, csr_position, goals_per_game, gpg_position, conceded_per_game, cpg_position

class TeamRatings(DF):
    def __init__(self, d: dict):
        super().__init__(d)

class PositionOverTime(DF):
    def __init__(self, d: dict):
        super().__init__(d)

class HomeAdvantages(DF):
    def __init__(self, d: dict):
        super().__init__(d)

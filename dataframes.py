from typing import List, Tuple
import pandas as pd


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
    
    def get_current_matchday(self) -> List:
        current_matchday = None
        # Returns "Matchday X"
        if len(self.df.columns) > 0:
            current_matchday = list(self.df.columns.unique(level=0))[-1]
        return current_matchday

    def get_form(self, team_name: str) -> List:
        form = []
        current_matchday = self.get_current_matchday()
        if current_matchday:
            form = self.df[current_matchday].loc[team_name]['Form']
                    
            # If team hasn't yet played in current matchday, use previous matchday's form
            if len(form.replace(',', '')) != 5 and current_matchday != 'Matchday 1':
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                form = self.df[previous_matchday].loc[team_name]['Form']
            
            if form == None:
                form = []
            else:
                form = list(form.replace(',', ''))
            form = form + ['None'] * (5 - len(form))  # Pad list

        return form

    def get_recent_teams_played(self, team_name: str) -> pd.DataFrame:
        recent_teams_played = pd.DataFrame()
        current_matchday = self.get_current_matchday()
        
        if current_matchday:
            recent_teams_played = self.df[current_matchday].loc[team_name]['Teams Played']
            
            if len(recent_teams_played) != 5 and current_matchday != 'Matchday 1':
                # Use previous matchday's games played list
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                recent_teams_played = self.df[previous_matchday].loc[team_name]['Teams Played']
                
        return recent_teams_played
    
    def get_current_form_rating(self, team_name: str) -> float:
        rating = 0        
        current_matchday = self.get_current_matchday()

        if current_matchday:
            latest_teams_played = self.df[current_matchday].loc[team_name]['Teams Played']
            matchday = current_matchday
            # If played in current gameweek, 5 teams played
            # If not yet played in current gameweek, 4 teams played
            # If team hasn't yet played this matchday use previous matchday data
            # TODO: NEEDS FIXING
            if len(latest_teams_played) == 4 and current_matchday != 'Matchday 4':
                matchday = list(self.df.columns.unique(level=0))[-2]
            rating = self.df[matchday].loc[team_name]['Form Rating %'].round(1)
            
        return rating
    
    def get_won_against_star_team(self, team_name: str) -> List[bool]:
        won_against_star_team = []
        current_matchday = self.get_current_matchday()
        
        if current_matchday:
            won_against_star_team = self.df[current_matchday].loc[team_name]['Won Against Star Team']
            
            # If team hasn't yet played this matchday use previous matchday data
            # TODO: NEEDS FIXING
            if len(won_against_star_team) == 4 and current_matchday != 'Matchday 4':
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                won_against_star_team = self.df[previous_matchday].loc[team_name]['Won Against Star Team']
                
            # Replace boolean values with CSS tag for super win image
            won_against_star_team = ["star-team" if x else "not-star-team" for x in won_against_star_team]
        return won_against_star_team

    def get_recent_form(self, team_name: str) -> Tuple[List[str], List[str], float, List[bool]]:
        form = self.get_form(team_name)  # List of five 'W', 'D' or 'L'
        recent_teams_played = self.get_recent_teams_played(team_name)
        form_rating = self.get_current_form_rating(team_name)
        won_against_star_team = self.get_won_against_star_team(team_name)
        return form, recent_teams_played, form_rating, won_against_star_team

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
    def __init__(self, d: dict):
        super().__init__(d)
    
    def get_opposition(self, team_name: str) -> str:
        return self.df['Next Game'].loc[team_name]
    
    def get_previous_meetings(self, team_name: str):
        return self.df.loc[team_name]['Previous Meetings']
    
    def get_home_away(self, team_name: str):
        return self.df['HomeAway'].loc[team_name]


class SeasonStats(DF):
    def __init__(self, d: dict):
        super().__init__(d)
    
    def get_clean_sheet_ratio(self, team_name: str) -> int:
        return self.df['Clean Sheet Ratio'][team_name]

    def get_goals_per_game(self, team_name: str) -> int:
        return self.df['Goals Per Game'][team_name]

    def get_conceded_per_game(self, team_name: str) -> int:
        return self.df['Conceded Per Game'][team_name]
    
    def get_season_stats(self, team_name: str) -> Tuple[float, float, float]:
        clean_sheet_ratio = self.get_clean_sheet_ratio(team_name)
        goals_per_game = self.get_goals_per_game(team_name)
        conceded_per_game = self.get_conceded_per_game(team_name)
        return clean_sheet_ratio, goals_per_game, conceded_per_game

class TeamRatings(DF):
    def __init__(self, d: dict):
        super().__init__(d)

class PositionOverTime(DF):
    def __init__(self, d: dict):
        super().__init__(d)

class HomeAdvantages(DF):
    def __init__(self, d: dict):
        super().__init__(d)
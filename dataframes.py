from typing import List, Tuple
import pandas as pd


class DF:
    def __init__(self, d):
        self.df = pd.DataFrame(d)
    
    def __str__(self):
        return str(self.df)


class Fixtures(DF):
    def __init__(self, d):
        super().__init__(d)
    
class Form(DF):
    def __init__(self, d):
        super().__init__(d)
    
    def getCurrentMatchday(self) -> List:
        # Returns "Matchday X"
        return list(self.df.columns.unique(level=0))[-1]

    def getForm(self, team_name: str) -> List:
        latest_matchday = self.getCurrentMatchday()
        form = self.df[latest_matchday].loc[team_name]['Form']
                
        # If team hasn't yet played in current matchday, use previous matchday's form
        if len(form.replace(',', '')) != 5:
            previous_matchday = list(self.form.df.columns.unique(level=0))[-2]
            form = self.df[previous_matchday].loc[team_name]['Form']
        
        if form == None:
            form = []
        else:
            form = list(form.replace(',', ''))
        form = form + ['None'] * (5 - len(form))  # Pad list
        return form

    def getRecentTeamsPlayed(self, team_name: str) -> pd.DataFrame:
        latest_matchday = self.getCurrentMatchday()
        latest_teams_played = self.df[latest_matchday].loc[team_name]['Teams Played']
        
        if len(latest_teams_played) == 5:
            # If team has already played this game week
            return latest_teams_played
        else:
            # Use previous matchday's games played list
            previous_matchday = list(self.df.columns.unique(level=0))[-2]
            return self.df[previous_matchday].loc[team_name]['Teams Played']
    
    def getCurrentFormRating(self, team_name: str) -> List:
        matchday = self.getCurrentMatchday()# Latest matchday
        latest_teams_played = self.df[matchday].loc[team_name]['Teams Played']
        
        # If team hasn't yet played this matchday use previous matchday data
        if len(latest_teams_played) != 5:
            matchday = list(self.df.columns.unique(level=0))[-2]
        
        return self.df[matchday].loc[team_name]['Form Rating %'].round(1)
    
    def getWonAgainstStarTeam(self, team_name: str) -> List[bool]:
        latest_matchday = self.getCurrentMatchday()
        won_against_star_team = self.df[latest_matchday].loc[team_name]['Won Against Star Team']
        
        # If team hasn't yet played this matchday use previous matchday data
        if len(won_against_star_team) != 5:
            previous_matchday = list(self.df.columns.unique(level=0))[-2]
            won_against_star_team = self.df[previous_matchday].loc[team_name]['Won Against Star Team']
            
        # Replace boolean values with CSS tag for super win image
        won_against_star_team = ["star-team" if x else "not-star-team" for x in won_against_star_team]
        return won_against_star_team

    def getRecentForm(self, team_name: str) -> Tuple[List[str], List[str], float, List[bool]]:
        form = self.getForm(team_name)  # List of five 'W', 'D' or 'L'
        recent_teams_played = self.getRecentTeamsPlayed(team_name)
        form_rating = self.getCurrentFormRating(team_name)
        won_against_star_team = self.getWonAgainstStarTeam(team_name)
        return form, recent_teams_played, form_rating, won_against_star_team

class Standings(DF):
    def __init__(self, d):
        super().__init__(d)
        
    def getPosition(self, team_name: str, season: int) -> pd.DataFrame:
        return self.df.loc[team_name, f'{season}']['Position']
    
    def getTableSnippet(self, team_name: str, season: int) -> Tuple[List[Tuple[int, str, int, int]], int]:
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
        rows = rows[f'{season}'][['Position', 'GD', 'Points']]
        
        # List of table rows: [ [pos, name, gd, points] ... ]
        table_snippet = rows.values.tolist()
        # Add the team name into position 1 of each table row
        for row_list, team_name in zip(table_snippet, team_names):
            row_list.insert(1, team_name)
                    
        return table_snippet, team_idx

class NextGames(DF):
    def __init__(self, d):
        super().__init__(d)
    
    def getOpposition(self, team_name: str) -> str:
        return self.df['Next Game'].loc[team_name]
    
    def getPreviousMeetings(self, team_name: str):
        return self.df.loc[team_name]['Previous Meetings']
    
    def getHomeAway(self, team_name: str):
        return self.df['HomeAway'].loc[team_name]

class SeasonStats(DF):
    def __init__(self, d):
        super().__init__(d)
    
    def getCleanSheetRatio(self, team_name: str) -> int:
        return self.df['Clean Sheet Ratio'][team_name]

    def getGoalsPerGame(self, team_name: str) -> int:
        return self.df['Goals Per Game'][team_name]

    def getConcededPerGame(self, team_name: str) -> int:
        return self.df['Conceded Per Game'][team_name]
    
    def getSeasonStats(self, team_name: str) -> Tuple[float, float, float]:
        clean_sheet_ratio = self.getCleanSheetRatio(team_name)
        goals_per_game = self.getGoalsPerGame(team_name)
        conceded_per_game = self.getConcededPerGame(team_name)
        return clean_sheet_ratio, goals_per_game, conceded_per_game

class TeamRatings(DF):
    def __init__(self, d):
        super().__init__(d)

class PositionOverTime(DF):
    def __init__(self, d):
        super().__init__(d)

class HomeAdvantages(DF):
    def __init__(self, d):
        super().__init__(d)
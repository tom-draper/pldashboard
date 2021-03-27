import os
from os.path import join, dirname
from dotenv import load_dotenv
import pandas as pd
from collections import deque
from collections import defaultdict
from timebudget import timebudget
import numpy as np
import requests
import json
from datetime import datetime
from data_vis import DataVis

class TwoWayDict(dict):
    def __init__(self, dict):
        super().__init__()
        for key, value in dict.items():
            self.__setitem__(key, value)
    
    def __setitem__(self, key, value):
        # Remove any previous connections with these values
        if key in self:
            del self[key]
        if value in self:
            del self[value]
        dict.__setitem__(self, key, value)
        dict.__setitem__(self, value, key)

    def __delitem__(self, key):
        dict.__delitem__(self, self[key])
        dict.__delitem__(self, key)

    def __len__(self):
        """Returns the number of connections"""
        return dict.__len__(self) // 2


class Data:
    def __init__(self, current_season):
        self.season = current_season
        
        # Import environment variables
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        self.url = os.getenv('URL')
        self.api = os.getenv('API')
        auth_token = os.getenv('X_AUTH_TOKEN')
        self.headers = {'X-Auth-Token': auth_token}
                
        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 5
        self.star_team_threshold = 0.75  # Rating over 75% to be a star team
                        
        # List of current season teams, updated when updating standings 
        self.team_names = None  
        
        # Dataframes to build
        self.fixtures = None
        self.standings = None
        self.team_ratings = None
        self.home_advantages = None
        self.form = None
        self.position_over_time = None
        self.next_games = None

        self.names_and_initials = TwoWayDict({
            'ARS': 'Arsenal FC',
            'AVL': 'Aston Villa FC',
            'BHA': 'Brighton and Hove Albion FC',
            'BUR': 'Burnley FC',
            'CHE': 'Chelsea FC',
            'CRY': 'Crystal Palace FC',
            'EVE': 'Everton FC',
            'FUL': 'Fulham FC',
            'LEE': 'Leeds United FC',
            'LEI': 'Leicester City FC',
            'LIV': 'Liverpool FC',
            'MCI': 'Manchester City FC',
            'MUN': 'Manchester United FC',
            'NEW': 'Newcastle United FC',
            'SHU': 'Sheffield United FC',
            'SOU': 'Southampton FC',
            'TOT': 'Tottenham Hotspur FC',
            'WBA': 'West Bromwich Albion FC',
            'WHU': 'West Ham United FC',
            'WOL': 'Wolverhampton Wanderers FC',
        })
    
    def getCurrentMatchday(self):
        # Returns "Matchday X"
        return list(self.form.columns.unique(level=0))[-1]
    
    # -------- Functions for loading pages ------------
    # Functions that are called inside Flask page load functions
    # Returns data to used to display information on webpage
    # All require dataframes to be filled first
    def getPosition(self, team_name):
        return self.standings.loc[team_name, f'{self.season}']['Position']

    # ------- RECENT FORM --------

    def getForm(self, team_name):
        latest_matchday = self.getCurrentMatchday()
        form = self.form[latest_matchday].loc[team_name]['Form']
                
        # If team hasn't yet played in current matchday, use previous matchday's form
        if len(form.replace(',', '')) != 5:
            previous_matchday = list(self.form.columns.unique(level=0))[-2]
            form = self.form[previous_matchday].loc[team_name]['Form']
        
        if form == None:
            form = []
        else:
            form = list(form.replace(',', ''))
        form = form + ['None'] * (5 - len(form))  # Pad list
        return form

    def getRecentTeamsPlayed(self, team_name):
        latest_matchday = self.getCurrentMatchday()
        latest_teams_played = self.form[latest_matchday].loc[team_name]['Teams Played']
        
        if len(latest_teams_played) == 5:
            # If team has already played this game week
            return latest_teams_played
        else:
            # Use previous matchday's games played list
            previous_matchday = list(self.form.columns.unique(level=0))[-2]
            return self.form[previous_matchday].loc[team_name]['Teams Played']
    
    def getCurrentFormRating(self, team_name):
        matchday = self.getCurrentMatchday()# Latest matchday
        latest_teams_played = self.form[matchday].loc[team_name]['Teams Played']
        
        # If team hasn't yet played this matchday use previous matchday data
        if len(latest_teams_played) != 5:
            matchday = list(self.form.columns.unique(level=0))[-2]
        
        return self.form[matchday].loc[team_name]['Form Rating %'].round(1)
    
    def getWonAgainstStarTeam(self, team_name):
        latest_matchday = self.getCurrentMatchday()
        won_against_star_team = self.form[latest_matchday].loc[team_name]['Won Against Star Team']
        
        # If team hasn't yet played this matchday use previous matchday data
        if len(won_against_star_team) != 5:
            previous_matchday = list(self.form.columns.unique(level=0))[-2]
            won_against_star_team = self.form[previous_matchday].loc[team_name]['Won Against Star Team']
            
        # Replace boolean values with CSS tag for super win image
        won_against_star_team = ["star-team" if x else "not-star-team" for x in won_against_star_team]
        return won_against_star_team

    def getRecentForm(self, team_name):
        form = self.getForm(team_name)  # List of five 'W', 'D' or 'L'
        recent_teams_played = self.getRecentTeamsPlayed(team_name)
        form_rating = self.getCurrentFormRating(team_name)
        won_against_star_team = self.getWonAgainstStarTeam(team_name)
        return form, recent_teams_played, form_rating, won_against_star_team
    
    # ------- NEXT GAME --------

    def getNextTeamToPlay(self, team_name):
        team_name = self.next_games['Next Game'].loc[team_name]
        return team_name
    
    def getPreviousMeetings(self, team_name):
        prev_meetings = self.next_games.loc[team_name]['Previous Meetings']
        return prev_meetings
    
    def getNextGameHomeAway(self, team_name):
        home_away = self.next_games['HomeAway'].loc[team_name]
        return home_away

    def getNextGameDetails(self, team_name):
        team_playing_next_name = self.getNextTeamToPlay(team_name)
        team_playing_next_form_rating = self.getCurrentFormRating(team_playing_next_name)
        team_playing_next_home_away = self.getNextGameHomeAway(team_name)
        team_playing_prev_meetings = self.getPreviousMeetings(team_name)
        return team_playing_next_name, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings
    
    # -------- TABLE SNIPPET ---------
    
    def getTableSnippet(self, team_name):
        team_df_idx = self.standings.index.get_loc(team_name)
        
        # Get range of table the snippet should cover
        # Typically 3 teams below + 3 teams above, unless near either end of the table
        low_idx = team_df_idx-3
        high_idx = team_df_idx+4
        if low_idx < 0:
            # Add overflow amount to the high_idx to ensure 7 teams 
            overflow = low_idx
            high_idx -= low_idx  # Subtracting a negative
            low_idx = 0
        if high_idx > self.standings.shape[0] - 1:
            # Subtract overflow amount from the low_idx to ensure 7 teams
            overflow = high_idx - (self.standings.shape[0])
            low_idx -= overflow
            high_idx = self.standings.shape[0]
            
        rows = self.standings.iloc[low_idx:high_idx]
        team_names = rows.index.values.tolist()
        # Remove 'FC' from end of each team name (nicer to display)
        team_names = list(map(lambda name: ' '.join(name.split(' ')[:-1]), team_names))
        # Get new index of this team, relative to section of rows dataframe
        team_idx = rows.index.get_loc(team_name)

        # Only keep relevant columns
        rows = rows[f'{self.season}'][['Position', 'GD', 'Points']]
        
        # List of table rows: [ [pos, name, gd, points] ... ]
        table_snippet = rows.values.tolist()
        # Add the team name into position 1 of each table row
        for row_list, team_name in zip(table_snippet, team_names):
            row_list.insert(1, team_name)
            
        return table_snippet, team_idx
    
    
    # ---------------------- NEXT GAMES DATAFRAME ---------------------------

    def getNextGame(self, team_name, fixtures):
        # Scan through list of fixtures to find the first that is 'scheduled' 
        next_matchday_no, next_team = None, None
        for matchday_no in range(len(fixtures.columns.unique(level=0))):
            if fixtures.loc[team_name][f'Matchday {matchday_no+1}', 'Status'] == 'SCHEDULED':
                next_team = fixtures.loc[team_name][f'Matchday {matchday_no+1}', 'Team']
                next_matchday_no = matchday_no
                break

        return next_matchday_no, next_team

    
    def include_current_seasons_meetings(self, next_games):
        # Loop through the columns of matchdays that have been played
        for matchday_no in range(len(self.form.columns.unique(level=0))):
            matchday = f"Matchday {matchday_no+1}"
            matchday_data = self.fixtures[matchday]
            for team, row in matchday_data.iterrows():
                if row['HomeAway'] == 'Home':  # From the perspective of the home team
                    # If the teams next game is this team AND the game has been played
                    if next_games.loc[team]['Next Game'] == row['Team'] and row['Score'] != 'None - None':
                        date = row['Date'].strftime('%d %B %Y')
                        split_score = row['Score'].split(' ')
                        home_score, away_score = int(split_score[0]), int(split_score[2])
                        # Record overall result for home and away team
                        if home_score == away_score:
                            result = ('Drew', 'Drew')
                        elif home_score > away_score:
                            result = ('Won', 'Lost')
                        else:
                            result = ('Lost', 'Won')
                        next_games.loc[team]['Previous Meetings'].append(tuple((date, team, row['Team'], home_score, away_score, result[0])))
                        next_games.loc[row['Team']]['Previous Meetings'].append(tuple((date, team, row['Team'], home_score, away_score, result[1])))
    
    def include_prev_seasons_meetings(self, next_games, no_seasons, request_new):
        for season in range(self.season-1, self.season-1-no_seasons, -1):
            data = self.fixturesData(season, request_new=request_new)
            for match in sorted(data, key=lambda x: x['matchday']):
                if match['homeTeam']['name'] in next_games.index:  # From the perspective from the home team
                    if next_games.loc[match['homeTeam']['name']]['Next Game'] == match['awayTeam']['name']:
                        date = datetime.strptime(match['utcDate'][:10], "%Y-%m-%d").date().strftime('%d %B %Y')
                        home_score = match['score']['fullTime']['homeTeam']
                        away_score = match['score']['fullTime']['awayTeam']
                        # Record overall result for home and away team
                        if home_score == away_score:
                            result = ('Drew', 'Drew')
                        elif home_score > away_score:
                            result = ('Won', 'Lost')
                        else:
                            result = ('Lost', 'Won')
                        next_games.loc[match['homeTeam']['name']]['Previous Meetings'].append(tuple((date, match['homeTeam']['name'], match['awayTeam']['name'], match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'], result[0])))
                        next_games.loc[match['awayTeam']['name']]['Previous Meetings'].append(tuple((date, match['homeTeam']['name'], match['awayTeam']['name'], match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'], result[1])))
    
    @timebudget
    def buildNextGames(self, display=False, request_new=True):
        """ Builds and stores a dataframe containing information about each teams
            next game, along with data for each of their previous meetings results 
            from the last 3 seasons.
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            --------------------------------------------
            | Next Game | HomeAway | Previous Meetings |
            
            Next Game: name of the opposition team in a team's next game
            HomeAway: whether the team is playing the next match at home or away, 
                either 'Home' or 'Away'
            Previous Meetings: list of (String Date, Home Team, Away Team, Home Score, 
                Away Score, Winning Team) tuples of each previous game between the
                two teams
        
        Dependencies:
            fixtures dataframe
            form dataframe 
                
        Args:
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
            request_new (bool, optional): flag to request new data from data API.
                If false, stored data file is used. Defaults to True.
            
        Returns:
            DataFrame: dataframe containing data about the team's previous meetings
                with the opposition team in their next game.
        """
        print("Creating next games dataframe... ")
        
        next_games = pd.DataFrame()
        
        next_team_col = []
        for team_name, _ in self.fixtures.iterrows():
            matchday_no, next_team = self.getNextGame(team_name, self.fixtures)
            next_team_col.append(next_team)
        
        next_games['Next Game'] = next_team_col
        # Config index now as there are a correct number of rows, and allow to 
        # insert the HomeAway fixtures column (with same indices)
        next_games.index = self.fixtures.index
        next_games['HomeAway'] = self.fixtures[f'Matchday {matchday_no+1}']['HomeAway']
        next_games['Previous Meetings'] = [[] for _ in range(len(next_games.index))]
                
        # Add any previous meetings that have been played this season
        self.include_current_seasons_meetings(next_games)
        # Add any previous meetings from last 2 sesaons
        self.include_prev_seasons_meetings(next_games, 2, request_new)
        
        # Sort each list of tuple previous meeting to be descending by date
        for _, row in next_games.iterrows():
            row['Previous Meetings'].sort(key=lambda x: datetime.strptime(x[0], '%d %B %Y'), reverse=True)
        
        if display:
            print(next_games)
        
        return next_games
    
    
    
    
    # ------------------------- FORM DATAFRAME -------------------------------
    
    def convertTeamNameOrInitials(self, team_name):
        if team_name in self.names_and_initials.keys():
            return self.names_and_initials[team_name]
        elif len(team_name) == 3:
            # If no match found and input is initials
            raise KeyError("Team name does not exist")
        else:
            # If no match found and input is team name, shorten team name
            return team_name[:3].upper()
    
    def lastNGames(self, games_played, n_games, date):
        """ Slice games played data to return only the last 'n_games' games from 
            the given date """
            
        # Unzip tuples
        dates, teams_played, scores, home_aways = list(zip(*games_played))
           
        # Default to latest game
        index = len(dates)-1
        # Find index of dates where this matchday would fit
        for idx in range(len(dates)-2):
            if dates[idx+1] > date:
                index = idx
                break
        
        # Get the last n_games matchday values from this index
        if len(dates) > n_games:
            low = index - n_games+1
            if low < 0:
                low = 0
            high = index + 1
            # Find date of current matchday
            teams_played = teams_played[low:high]
            scores = scores[low:high]
            home_aways = home_aways[low:high]
                
        return list(teams_played), list(scores), list(home_aways)

    def lastNGamesCols(self, fixtures, n_games, matchday_no):
        teams_played_col = []
        scores_col = []
        home_away_col = []
        
        matchday_dates = fixtures[f'Matchday {matchday_no}', 'Date']
        median_matchday_date = matchday_dates[len(matchday_dates)//2].asm8
                
        for team_name, row in fixtures.iterrows():
            dates = fixtures.loc[team_name, (slice(None), 'Date')]
            teams_played = fixtures.loc[team_name, (slice(None), 'Team')]
            scores = fixtures.loc[team_name, (slice(None), 'Score')]
            home_aways = fixtures.loc[team_name, (slice(None), 'HomeAway')]
            
            # List containing a tuple for each game
            games_played = list(zip(dates.values, teams_played.values, scores.values, home_aways.values))
            # Remove matchdays that haven't played yet and don't have a score
            games_played = [game for game in games_played if game[2] != 'None - None']
            # Sort by date
            games_played = sorted(games_played, key=lambda x: x[0])
            
            matchday_date = row[f'Matchday {matchday_no}']['Date'].asm8
            
            # If matchday date is far away from the mean and this matchday has 
            # been rescheduled, use the mean matchday date insead
            # Check within 2 weeks either side
            if not (median_matchday_date - np.timedelta64(14,'D') < matchday_date < median_matchday_date + np.timedelta64(14,'D')):
                matchday_date = median_matchday_date
            
            teams_played, scores, home_away = self.lastNGames(games_played, n_games, matchday_date)
            teams_played_col.append(teams_played)
            scores_col.append(scores)
            home_away_col.append(home_away)

        # Convert full team names to team initials
        teams_played_col = [list(map(lambda team_name : self.convertTeamNameOrInitials(team_name), teams_played))
                                 for teams_played in teams_played_col]
        
        return teams_played_col, scores_col, home_away_col
    
    def formString(self, scores, home_aways):
        form_str = []
        
        for score, homeAway in zip(scores, home_aways):
            home, _, away = score.split(' ')
            if home != 'None' and away != 'None':
                if int(home) == int(away):
                    form_str.append('D')
                elif int(home) > int(away) and homeAway == 'Home' or int(home) < int(away) and homeAway == 'Away':
                    form_str.append('W')
                else:
                    form_str.append('L')
                    
        form_str = ','.join(form_str)  # Convert to string
        return form_str

    def calcFormRating(self, teams_played, form_str, gds, team_ratings):
        form_percentage = 50  # Default percentage, moves up or down based on performance
        
        if form_str != None:  # If games have been played this season
            #print(form_str)
            #print(teams_played)
            form_str = form_str.replace(',', '')
            for form_idx, result in enumerate(form_str):
                # Convert opposition team initials to their name 
                team_name = self.convertTeamNameOrInitials(teams_played[form_idx])

                #print("ON ", form_percentage)
                # Increament form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    #print("W PLUS", (team_ratings.loc[team_name]['Total Rating']) * 100,  "/", len(form_str), "  X  ", abs(gds[form_idx]), "=", ((team_ratings.loc[team_name]['Total Rating']) * 100 / len(form_str)) * abs(gds[form_idx]))
                    form_percentage += ((team_ratings.loc[team_name]['Total Rating']) * 100 / len(form_str)) * abs(gds[form_idx])
                elif result == 'D':
                    #print("D PLUS", team_ratings.loc[team_name]['Total Rating'], "-", (team_ratings.loc[team_name]['Total Rating']), "=", ((team_ratings.loc[team_name]['Total Rating'] - (team_ratings.loc[team_name]['Total Rating'])) * 100) / len(form_str))
                    form_percentage +=  ((team_ratings.loc[team_name]['Total Rating'] - (team_ratings.loc[team_name]['Total Rating'])) * 100) / len(form_str)
                elif result == 'L':
                    #print("L MINUS", (team_ratings.iloc[0]['Total Rating'] * 100), "-", (team_ratings.loc[team_name]['Total Rating']) * 100, "/", len(form_str), " X ", abs(gds[form_idx]), "= -", ((team_ratings.iloc[0]['Total Rating'] - team_ratings.loc[team_name]['Total Rating']) * 100 / len(form_str) * abs(gds[form_idx])))
                    form_percentage -= ((team_ratings.iloc[0]['Total Rating'] - team_ratings.loc[team_name]['Total Rating']) * 100 / len(form_str) * abs(gds[form_idx]))
                    
        # Cap rating
        if form_percentage > 100:
            form_percentage = 100
        elif form_percentage < 0:
            form_percentage = 0
        
        return form_percentage
    
    @timebudget
    def buildForm(self, display=False):
        """ Build and store a dataframe containing snapshots of each teams recent
            performance at the end of each matchday from matchday 1 to the most
            recent matchday. The aim of this dataframe is to give a clear insight 
            into how the teams form/performance has changed over time.
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            -------------------------------------------------------------------------------------------------------------------
            |                                                Matchday [X]                                                     |
            -------------------------------------------------------------------------------------------------------------------
            | Date | Teams Played | Scores | HomeAway | Form | GDs | Form Rating % | Played Star Team | Won Against Star Team |
            
            Matchday [X]: where X is integers from 1 to the most recent matchday
                with a game played
            Date: list of datetime values for the day a match is scheduled for 
                or taken place on for the last 5 games, with the most left-most
                value the most recent game played
            HomeAway: list of whether the team is playing that match at home or away, 
                either 'Home' or 'Away' for the last 5 games, with the most left-most
                value the most recent game played
            Team: list of the initials of the opposition team for the last 5 games, 
                with the most left-most value the most recent game played
            Status: list of the current status of that match, either 'FINISHED', 
                'IN PLAY' or 'SCHEDULED' for the last 5 games, with the most left-most
                value the most recent game played
            Score: list of the scores of the last 5 games, either 'X - Y' if status 
                is 'FINISHED' or None - None if status is 'SCHEDULED', with the 
                most left-most value the most recent game played
                
        Dependencies:
            fixtures dataframe
            standings dataframe
            team_ratings dataframe
                
        Args:
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
            
        Returns:
            DataFrame: dataframe containing data about the team's form for each 
                matchday played this season
        """
        print("Creating form dataframe... ")
        
        # Get number of matchdays that have had all teams played
        score = self.fixtures.loc[:, (slice(None), 'Score')]
        # Remove cols for matchdays that haven't played yet
        score = score.replace("None - None", np.nan).dropna(axis=1, how='all')
        no_cols = score.shape[1]

        form = {}
        
        # Loop through each matchday number played so far
        cols = list(score.columns.get_level_values(0))
        # Remove 'Matchday' prefix and just store sorted integers
        matchday_nos = sorted(map(lambda x: int(x.split(' ')[-1]), cols))
        for matchday_no in matchday_nos:
            form[(f'Matchday {matchday_no}', 'Date')] = self.fixtures[f'Matchday {matchday_no}', 'Date']
            
            # Get data about last 5 matchdays
            teams_played_col, scores_col, home_aways_col = self.lastNGamesCols(self.fixtures, 5, matchday_no+1)
            form[(f'Matchday {matchday_no}', 'Teams Played')] = teams_played_col
            form[(f'Matchday {matchday_no}', 'Scores')] = scores_col
            form[(f'Matchday {matchday_no}', 'HomeAway')] = home_aways_col
            
            # Form string and goal differences column
            form_str_col = []
            goal_differences_col = []
            # Loop through each matchday and record the goal different for each team
            for scores, home_aways in zip(scores_col, home_aways_col):
                # Append 'W', 'L' or 'D' depending on result
                form_str_col.append(self.formString(scores, home_aways))
                
                # Build goal differences of last games played from perspective of current team
                goal_differences = []
                for score, home_away in zip(scores, home_aways):
                    home, _, away = score.split(' ')
                    if home != 'None' and away != 'None':
                        diff = int(home) - int(away)
                        if diff > 0 and home_away == 'Home' or diff < 0 and home_away == 'Home':
                            goal_differences.append(diff)
                        elif diff < 0 and home_away == 'Away' or diff > 0 and home_away == 'Away':
                            goal_differences.append(diff*-1)
                        else:
                            goal_differences.append(0)
                goal_differences_col.append(goal_differences)
            form[(f'Matchday {matchday_no}', 'Form')] = form_str_col
            form[(f'Matchday {matchday_no}', 'GDs')] = goal_differences_col

            form_rating_col = []
            for teams_played, form_str, gds in zip(teams_played_col, form_str_col, goal_differences_col):
                rating = self.calcFormRating(teams_played, form_str, gds, self.team_ratings)
                form_rating_col.append(rating)
            form[(f'Matchday {matchday_no}', 'Form Rating %')] = form_rating_col
            
            # Column (list of booleans) for whether last 5 games have been against 
            # a team with a long term (multiple season) rating over a certain 
            # threshold (a star team)
            played_star_team_col = []
            for teams_played in teams_played_col:
                ratings = [self.team_ratings['Total Rating'][team_name] for team_name in list(map(self.convertTeamNameOrInitials, teams_played))]
                played_star_team_col.append([team_rating > self.star_team_threshold for team_rating in ratings])
            form[(f'Matchday {matchday_no}', 'Played Star Team')] = played_star_team_col
            
            # Column (list of booleans) for whether last 5 games have won against 
            # a star team
            won_against_star_team_col = []
            for played_star_team, form_str in zip(played_star_team_col, form_str_col):  # Team has played games this season
                won_against_star_team_col.append([(result == 'W' and pst == True) for result, pst in zip(form_str.replace(',', ''), played_star_team)])
            form[(f'Matchday {matchday_no}', 'Won Against Star Team')] = won_against_star_team_col
            
            # Remove column after use, data is not that useful to keep
            del form[(f'Matchday {matchday_no}', 'Played Star Team')]
                    
        form = pd.DataFrame(form)
        # print(form)
        # print(form['Matchday 30'])
        # form = form.sort_values((f'Matchday {no_cols}','Form Rating %'), ascending=False)
        
                
        if display: 
            print(form)
        return form
    
    
    
    
    # ------------ POSITION OVER TIME DATAFRAME ------------
    
    def getGDAndPts(self, score, home_away):
        pts = 0
        gd = 0
        if type(score) == str:  # If score exists and game has been played
            home, _, away = score.split(' ')
            home, away = int(home), int(away)
            
            if home == away:
                pts = 1
            if home_away == 'Home':
                gd = home - away
                if home > away:
                    pts = 3
            elif home_away == 'Away':
                gd = away - home
                if home < away:
                    pts = 3
                    
        return gd, pts

    
    @timebudget
    def buildPositionOverTime(self, display=False):
        """ Build and store a dataframe containing snapshots of a teams match and
            league table values for each matchday they have played so far. The aim 
            of this dataframe is to give a clear insight into how the teams league
            table position has changed over time.
            
            Rows: the 20 teams participating in the current season, ordered ascending
                by row team name
            Columns (multi-index):
            -----------------------------------------------------
            |                   Matchday [X]                    |
            -----------------------------------------------------
            | Score | HomeAway | Date | GDs | Points | Position |
            
            Matchday [X]: where X is integers from 1 to the most recent matchday
                with a game played
            Score: the score of that game 'X - Y', or rarely 'None - None' in
                the final, most recent matchday column for some games that are 
                soon to be played
            HomeAway: whether the team is playing that match at home or away, 
                either 'Home' or 'Away'
            Date: datetime values for the day a match is scheduled for 
                or has taken place on
            GDs: the goal difference the team held after that matchday
            Points: the points the team held after that matchday
            Position: the position in the table that the team held after that 
                matchday
        
        Dependencies:
            fixtures dataframe
            standings dataframe
                
        Args:
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
            
        Returns:
            DataFrame: dataframe containing data about the team's form for each 
                matchday played this season
        """
        print("Creating position over time dataframe... ")
                
        position_over_time = pd.DataFrame()

        score = self.fixtures.loc[:, (slice(None), 'Score')]
        home_away = self.fixtures.loc[:, (slice(None), 'HomeAway')]
        date = self.fixtures.loc[:, (slice(None), 'Date')]
        
        # Remove cols for matchdays that haven't played any games yet
        score = score.replace("None - None", np.nan).dropna(axis=1, how='all')
        no_cols = score.shape[1]
        # Only keep the same columns that remain in the score dataframe
        date = date[list(score.columns.unique(level=0))]
        home_away = home_away[list(score.columns.unique(level=0))]
        
        position_over_time = pd.concat([score, home_away, date], axis=1)
        
        cols = list(score.columns.get_level_values(0))
        # Remove 'Matchday' prefix and just store sorted integers
        matchday_nos = sorted(map(lambda x: int(x.split(' ')[-1]), cols))
        for idx, matchday_no in enumerate(matchday_nos):
            gd_col, pts_col = [], []
            col_data = position_over_time[f'Matchday {matchday_no}']
            for team_name, row in col_data.iterrows():
                gd = 0
                pts = 0
                if idx != 0:
                    # Add previous weeks cumulative gd
                    prev_matchday_no_idx = idx-1
                    previous_matchday_no = matchday_nos[prev_matchday_no_idx]
                    prev_gd = position_over_time.loc[team_name][f'Matchday {previous_matchday_no}', 'GD']
                    prev_pts = position_over_time.loc[team_name][f'Matchday {previous_matchday_no}', 'Points']
                    gd += prev_gd
                    pts += prev_pts
                # If this matchday has had all games played and is in score table
                # Add this weeks gd
                new_gd, new_pts = self.getGDAndPts(row['Score'], row['HomeAway'])
                gd += new_gd
                pts += new_pts
                
                gd_col.append(gd)
                pts_col.append(pts)
            
            position_over_time[f'Matchday {matchday_no}', 'GD'] = gd_col
            position_over_time[f'Matchday {matchday_no}', 'Points'] = pts_col
            
            position_over_time.sort_values(by=[(f'Matchday {matchday_no}', 'Points'), (f'Matchday {matchday_no}', 'GD')], ascending=False, inplace=True)
            # if matchday_no != 0:
            #     print(position_over_time[f'Matchday {matchday_no}'])
            # print(position_over_time[f'Matchday {matchday_no+1}'])
            # If on the last and most recent column, ensure matchday positions is 
            # exactly the same order as from API standings data 
            if idx == no_cols - 1:
                # Reorder to the order as standings data
                position_over_time = position_over_time.reindex(self.standings.index)

            position_over_time[f'Matchday {matchday_no}', 'Position'] = np.arange(1, 21)
               
        sorted_index = sorted(position_over_time.columns.values.tolist(), key=lambda x: int(x[0].split(' ')[-1]))
        position_over_time = position_over_time.reindex(sorted_index, axis=1)
                
        if display:
            print(position_over_time)
        return position_over_time
    
    
    
    
    # ------------- HOME ADVANTAGES DATAFRAME ---------------
    
    @timebudget
    def buildHomeAdvantages(self, no_seasons, display=False, request_new=True):
        """ Builds and stores a dataframe to hold each teams calculated home
            advantage values as well as the data required to calculate
            each team's home advantage values.
            
            Rows: the 20 teams participating in the current season, ordered descending 
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------------------------------------------------------------
            |                                             [SEASON YEAR]                                                 | Total Home Advantage |
            -------------------------------------------------------------------------------------------------------------                      |
            | Away Draws | Away Loses | Away Wins | Home Draws | Home Loses | Home Wins | Home Wins % | Wins % | Played |                      |
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago
            Away Draws: the total away games drawn this season
            Away Loses: the total away games lost this season
            Away Wins: the total away games won this season
            Home Draws: the total home games drawn this season
            Home Loses: the total home games lost this season
            Home Wins: the total home games won this season
            Home Wins %: the percentage of played home games won in the season
            Wins %: the percentage of played games won in the season
            Played: the number of games a team has played in the season
            Total Home Advantage: a final column of combined home advantage 
                values from all seasons in the table
        
        Dependencies:
            None
                
        Args:
            no_seasons (int): number of previous seasons to fetch and include. 
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
            request_new (bool, optional): flag to request new data from data API.
                If false, stored data file is used. Defaults to True.

        Returns:
            DataFrame: dataframe containing team's home advantage information for 
                each season with a final column for combined total home advantage 
                values
        """
        print("Creating home advantages dataframe... ")
        
        home_advantages = pd.DataFrame()
        
        dfs = []
        for i in range(no_seasons):
            data = self.fixturesData(self.season-i, request_new=request_new)
            
            d = {}
            for match in data:
                home_team = match['homeTeam']['name'].replace('&', 'and')
                away_team = match['awayTeam']['name'].replace('&', 'and')

                if home_team not in d.keys():
                    d[home_team] = {(f'{self.season-i}', 'Home Wins'): 0, 
                                    (f'{self.season-i}', 'Home Draws'): 0,
                                    (f'{self.season-i}', 'Home Loses'): 0,
                                    (f'{self.season-i}', 'Away Wins'): 0,
                                    (f'{self.season-i}', 'Away Draws'): 0,
                                    (f'{self.season-i}', 'Away Loses'): 0}                
                if away_team not in d.keys():
                    d[away_team] = {(f'{self.season-i}', 'Home Wins'): 0, 
                                    (f'{self.season-i}', 'Home Draws'): 0,
                                    (f'{self.season-i}', 'Home Loses'): 0,
                                    (f'{self.season-i}', 'Away Wins'): 0,
                                    (f'{self.season-i}', 'Away Draws'): 0,
                                    (f'{self.season-i}', 'Away Loses'): 0}   
                
                if match['score']['winner'] != None:
                    if match['score']['fullTime']['homeTeam'] > match['score']['fullTime']['awayTeam']:
                        # Home team wins
                        d[home_team][(f'{self.season-i}', 'Home Wins')] += 1
                        d[away_team][(f'{self.season-i}', 'Away Loses')] += 1
                    elif match['score']['fullTime']['homeTeam'] < match['score']['fullTime']['awayTeam']:
                        # Away team wins
                        d[home_team][(f'{self.season-i}', 'Home Loses')] += 1
                        d[away_team][(f'{self.season-i}', 'Away Wins')] += 1
                    else:  # Draw
                        d[home_team][(f'{self.season-i}', 'Home Draws')] += 1
                        d[away_team][(f'{self.season-i}', 'Away Draws')] += 1
            
            df = pd.DataFrame(d)
            # Drop teams that are not in the current season
            df = df.drop(df.columns[~df.columns.isin(self.team_names)].values.tolist(), axis=1)
            dfs.append(df)
        
        home_advantages = pd.concat(dfs).T
        home_advantages.index.name = "Team"
        home_advantages = home_advantages.fillna(0)
        home_advantages = home_advantages.astype(int)
        
        
        # Create home advantage column
        for i in range(no_seasons):
            home_advantages[f'{self.season-i}', 'Played'] = home_advantages[f'{self.season-i}']['Home Wins'] \
                                                            + home_advantages[f'{self.season-i}']['Home Draws'] \
                                                            + home_advantages[f'{self.season-i}']['Home Loses'] \
                                                            + home_advantages[f'{self.season-i}']['Away Wins'] \
                                                            + home_advantages[f'{self.season-i}']['Away Draws'] \
                                                            + home_advantages[f'{self.season-i}']['Away Loses']
            home_advantages[f'{self.season-i}', 'Played at Home'] = home_advantages[f'{self.season-i}']['Home Wins'] \
                                                                    + home_advantages[f'{self.season-i}']['Home Draws'] \
                                                                    + home_advantages[f'{self.season-i}']['Home Loses']
            # Percentage wins = total wins / total games played
            home_advantages[f'{self.season-i}', 'Wins %'] = ((home_advantages[f'{self.season-i}']['Home Wins'] 
                                                              + home_advantages[f'{self.season-i}']['Away Wins']) 
                                                             / home_advantages[f'{self.season-i}']['Played']) * 100
            # Percentage wins at home = total wins at home / total games played at home 
            home_advantages[f'{self.season-i}', 'Home Wins %'] = (home_advantages[f'{self.season-i}']['Home Wins'] 
                                                                  / home_advantages[f'{self.season-i}']['Played at Home']) * 100
            # Home advantage = percentage wins at home - percentage wins 
            home_advantages[f'{self.season-i}', 'Home Advantage'] = (home_advantages[f'{self.season-i}']['Home Wins %'] 
                                                                     - home_advantages[f'{self.season-i}']['Wins %']) / 100
        
        home_advantages = home_advantages.sort_index(axis=1)

        home_advantages_cols = home_advantages.iloc[:, home_advantages.columns.get_level_values(1)=='Home Advantage']
        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[f'{self.season}']['Played at Home'] <= self.home_games_threshold).all():
            print(f"Current season excluded from home advantages calculation -> all teams haven't played {self.home_games_threshold} home games.")
            # Drop this seasons column, start from previous season
            home_advantages_cols = home_advantages_cols.iloc[:, :-1]
                    
        # List of all home advantege column names that will be used to calculate final column
        home_advantages['Total Home Advantage'] = home_advantages_cols.mean(axis=1).fillna(0)
        home_advantages = home_advantages.sort_values(by='Total Home Advantage', ascending=False)
        home_advantages.index.name = "Team"
                
        if display:
            print(home_advantages)
        return home_advantages



    # ------------- Standings dataframe ---------------
    
    def standingsData(self, season, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season), 
                                    headers=self.headers)
            print("Code:", response.status_code)
            response = response.json()['standings'][0]['table']
            
            # Save new standings data
            with open(f'data/standings_{season}.json', 'w') as json_file:
                json.dump(response, json_file)
                
            return response
        else:
            # Read standings data
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)

    @timebudget
    def buildStandings(self, no_seasons, display=False, request_new=True):
        """ Build and store a dataframe to hold the Premier League table standings
            for the last [no_seasons] seasons.
            
            Rows: the 20 teams participating in the current season, ordered ascending 
                by the team's position in the current season 
            Columns (multi-index):
            ------------------------------------------------------------------------
            |                            [SEASON YEAR]                             |
            ------------------------------------------------------------------------
            | Position | Played | Form | Won | Draw | Lost | Points | GF | GA | GD |
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago
            Position: unique integer from 1 to 20 depending on the table position 
                a team holds in the season
            Played: the number of games a team has played in the season
            Form: a string of 5 characters W, D or L separated by commas, the 
                left-most character corresponds to the results of the most recent 
                game the team played from that season
            Won: the number of games a team has won in the season
            Drawn: the number of games a team has drawn in the season
            Lost: the number of games a team has lost in the season
            GF: goals for - the number of goals a team has scored in this season
            GA: goals against - the number of games a team has lost in the season
            GD: the number of games a team has lost in the season

        Args:
            no_seasons (int): number of previous seasons to fetch and include.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
            request_new (bool, optional): flag to request new data from data API.
                If false, stored data file is used. Defaults to True.

        Returns:
            DataFrame: dataframe containing all table standings for each season 
                       from current season to season no_seasons years ago.
        """
        print("Creating standings dataframe...")
        
        standings = pd.DataFrame()
        
        # Loop from current season to the season 2 years ago
        for i in range(no_seasons):
            data = self.standingsData(self.season-i, request_new=request_new)
            # pprint.pprint(data)
            df = pd.DataFrame(data)
            
            # Rename teams to their team name
            team_names = pd.Series([name.replace('&', 'and') for name in [df['team'][x]['name'] for x in range(len(df))]])
            df['team'] = team_names


            df.columns = pd.MultiIndex.from_tuples(((f'{self.season-i}', 'Position'), 
                                                   (f'{self.season-i}', 'Team'),
                                                   (f'{self.season-i}', 'Played'),
                                                   (f'{self.season-i}', 'Form'),
                                                   (f'{self.season-i}', 'Won'),
                                                   (f'{self.season-i}', 'Draw'),
                                                   (f'{self.season-i}', 'Lost'),
                                                   (f'{self.season-i}', 'Points'),
                                                   (f'{self.season-i}', 'GF'),
                                                   (f'{self.season-i}', 'GA'), 
                                                   (f'{self.season-i}', 'GD'),))

            df.index = df[f'{self.season-i}']['Team']
            df = df.drop(columns=['Team'], level=1)
            
            if i == 0:  # If building current season table
                standings = standings.append(df)
                self.team_names = team_names
            else:
                # Drop team rows that are no longer in the current season
                df = df.drop(df[~df.index.isin(standings.index)].index)
                # Drop the Form column from previous seasons
                df = df.drop(columns=['Form'], level=1)
                # Add season standings to main standings dataframe 
                standings = pd.concat([standings, df], axis=1)
        standings.index.name = "Team"
        
        if display:
            print(standings)
        return standings



    # ------------ Fixtures dataframe -------------

    def fixturesData(self, season, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                        headers=self.headers)
            print("Code:", response.status_code)
            response = response.json()['matches']
            
            # Save new fixtures data
            with open(f'data/fixtures_{season}.json', 'w') as json_file:
                json.dump(response, json_file)
            
            return response
        else:
            # Read saved fixtures data
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)
        
            
    @timebudget
    def buildFixtures(self, display=False, request_new=True):        
        """ Builds and stores a dataframe containing all fixtures of the current
            season, from matchday 1 to matchday 38.
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ---------------------------------------------
            |                Matchday [X]               |
            ---------------------------------------------
            | Date | HomeAway | Team  | Status  | Score |
            
            Matchday [X]: where X is integers from 1 to 38
            Date: datetime value for the day a match is scheduled for or taken 
                place on
            HomeAway: whether the team is playing that match at home or away, 
                either 'Home' or 'Away'
            Team: the name of the opposition team
            Status: the current status of that match, either 'FINISHED', 'IN PLAY' 
                or 'SCHEDULED'
            Score: the score of that game, either 'X - Y' if status is 'FINISHED'
                or None - None if status is 'SCHEDULED'
        
        Args:
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
            request_new (bool, optional): flag to request new data from data API.
                If false, stored data file is used. Defaults to True.
            
        Returns:
            DataFrame: dataframe containing the past and future fixtures for the 
                current season
        """
        print("Creating fixtures dataframe... ")
        
        # Get json fixtures data
        data = self.fixturesData(self.season, request_new=request_new)
                
        team_names = []  # List of all team names mentioned in fixtures
        team_names_index = []  # Specific order of team names to be dataframe index
        matchday = defaultdict(lambda: [])
        matchdays = []
        prev_matchday = 0
        for match in sorted(data, key=lambda x: x['matchday']):
            # If moved on to data for the next matchday, or 
            if prev_matchday < match['matchday']:
                # Package matchday dictionary into dataframe to concatenate into main fixtures dataframe
                df_matchday = pd.DataFrame(matchday)
                df_matchday.index = team_names
                
                matchday = defaultdict(lambda: [])
                # If just finished matchday 1 data, take team name list order as main fixtures dataframe index
                if prev_matchday == 1:
                    team_names_index = team_names[:]
                matchdays.append(df_matchday)
                
                prev_matchday = match['matchday']
                team_names = []
                
            # Home team row
            matchday[(f'Matchday {match["matchday"]}', 'Date')].append(datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"))
            matchday[(f'Matchday {match["matchday"]}', 'HomeAway')].append('Home')
            matchday[(f'Matchday {match["matchday"]}', 'Team')].append(match['awayTeam']['name'].replace('&', 'and'))
            matchday[(f'Matchday {match["matchday"]}', 'Status')].append(match['status']),
            matchday[(f'Matchday {match["matchday"]}', 'Score')].append(f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}")
            team_names.append(match['homeTeam']['name'].replace('&', 'and'))
            # Away team row
            matchday[(f'Matchday {match["matchday"]}', 'Date')].append(datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"))
            matchday[(f'Matchday {match["matchday"]}', 'HomeAway')].append('Away')
            matchday[(f'Matchday {match["matchday"]}', 'Team')].append(match['homeTeam']['name'].replace('&', 'and'))
            matchday[(f'Matchday {match["matchday"]}', 'Status')].append(match['status']),
            matchday[(f'Matchday {match["matchday"]}', 'Score')].append(f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}")
            team_names.append(match['awayTeam']['name'].replace('&', 'and'))
        
        # Add last matchday (38) dataframe to list
        df_matchday = pd.DataFrame(matchday)
        df_matchday.index = team_names
        matchdays.append(df_matchday)
        
        fixtures = pd.concat(matchdays, axis=1)
        fixtures.index = team_names_index
                
        if display:
            print(fixtures)
        return fixtures
                   



    # ----------- Team ratings dataframe -----------
    
    def calcRating(self, position, points, gd):
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points
        return rating
    
    def getSeasonWeightings(self, no_seasons):
        weights = [0.75, 0.20, 0.05]
        weights = np.array(weights[:no_seasons])
        # Normalise list
        weights = list(weights / sum(weights))
        return weights
    
    @timebudget
    def buildTeamRatings(self, no_seasons, display=False):
        """ Builds and stores a dataframe containing calculated values for each
            teams current rating, as well as the data used to calculate each teams 
            current rating.
            
            Rows: the 20 teams participating in the current season, ordered 
                descending by the team's rating
            Columns:
            ---------------------------------------------------------------------------------------------------------------------------------------------------
            | Rating Current | Rating 1Y Ago | Rating 2Y Ago | Normalised Rating Current | Normalised Rating 1Y Ago | Normalised Rating 2Y Ago | Total Rating |
            
            Rating current: a calculated positive or negative value that represents
                the team's rating based on the state of the current season's 
                standings table
            Rating 1Y Ago: a calculated positive or negative value that represents 
                the team's rating based on the state of last season's standings
                table
            Rating 2Y Ago: a calculated positive or negative value that represents 
                the team's rating based on the state of the standings table two
                seasons ago
            Normalised Rating current: the Rating Current column value normalised
            Normalised Rating 1Y Ago: the Rating 1Y Ago column values normalised
            Normalised Rating 2Y Ago: the Rating 2Y Ago column values normalised
            Total Rating: a final normalised rating value incorporating the values 
                from all three normalised columns
            
        Returns:
            DataFrame: dataframe containing data regarding each team's calculated 
                rating based on the last [no_seasons] seasons results.
        """
        print("Creating team ratings dataframe... ")
        
        # Ensure dependencies have been built
        if self.standings.empty:
            raise ValueError('Error when creating team_ratings dataframe: standings dataframe empty')
        
        # Add current season team names to the object team dataframe
        team_ratings = pd.DataFrame(index=self.standings.index)

        # Create column for each included season
        for i in range(0, no_seasons):
            team_ratings[f'Rating {i}Y Ago'] = np.nan
                
        # Insert rating values for each row
        for team_name, row in self.standings.iterrows():
            for i in range(no_seasons):
                rating = self.calcRating(row[f'{self.season-i}']['Position'], row[f'{self.season-i}']['Points'], row[f'{self.season-i}']['GD'])
                team_ratings.loc[team_name, 'Rating {}Y Ago'.format(i)] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in team_ratings.columns:
            team_ratings[col].replace(np.nan, team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for i in range(0, no_seasons):
            team_ratings[f'Normalised Rating {i}Y Ago'] = (team_ratings[f'Rating {i}Y Ago']
                                                           - team_ratings[f'Rating {i}Y Ago'].min()) \
                                                          / (team_ratings[f'Rating {i}Y Ago'].max() 
                                                           - team_ratings[f'Rating {i}Y Ago'].min())

        # Check whether current season data should be included in each team's total rating
        if (self.standings[f'{self.season}']['Played'] <= self.games_threshold).all():  # If current season hasn't played enough games
            print(f"Current season excluded from team ratings calculation -> all teams played {self.games_threshold} games.")
            include_current_season = False
        else:
            include_current_season = True

        # Calculate total rating column
        team_ratings['Total Rating'] = 0
        if include_current_season:
            start_n = 0  # Include current season when calculating total rating
            w = self.getSeasonWeightings(no_seasons) # Column weights
        else:
            start_n = 1  # Exclude current season when calculating total rating
            w = self.getSeasonWeightings(no_seasons-1) # Column weights

        for i in range(start_n, no_seasons):
            team_ratings['Total Rating'] += w[i-start_n] * team_ratings[f'Normalised Rating {i}Y Ago']

        team_ratings = team_ratings.sort_values(by="Total Rating", ascending=False).rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'})
        
        if display:
            print(team_ratings)
        return team_ratings
        
    
    @timebudget
    def updateAll(self, no_seasons=3, display_tables=False, display_graphs=False, request_new=True):
        # Standings for the last [n_seasons] seasons
        self.standings = self.buildStandings(no_seasons, display=display_tables, request_new=request_new)
        # Fixtures for the whole season for each team
        self.fixtures = self.buildFixtures(display=display_tables, request_new=request_new)
        # Ratings for each team, based on last [no_seasons] seasons standings table
        self.team_ratings = self.buildTeamRatings(no_seasons, display=display_tables)
        # Calculated values to represent the personalised advantage each team has at home
        self.home_advantages = self.buildHomeAdvantages(no_seasons, display=display_tables, request_new=request_new)
        # Calculated form values for each team for each matchday played so far
        self.form = self.buildForm(display=display_tables)
        # Snapshots of a teams table position and match results for each matchday played so far 
        self.position_over_time = self.buildPositionOverTime(display=display_tables)
        # Data about the opponent in each team's next game 
        self.next_games = self.buildNextGames(display=display_tables, request_new=request_new)
        
        # Use dataframes to update all graph HTML files
        vis = DataVis()
        vis.updateAll(self.fixtures, 
                      self.team_ratings, 
                      self.home_advantages, 
                      self.form, 
                      self.position_over_time, 
                      display_graphs=display_graphs, 
                      team_name='Liverpool FC')



if __name__ == "__main__":
    # Update all dataframes
    data = Data(2020)
    data.updateAll(request_new=False)
    
    

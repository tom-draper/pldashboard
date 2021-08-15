import os
from os.path import join, dirname
from dotenv import load_dotenv
import pandas as pd
from collections import defaultdict
from pandas.core.arrays.sparse import dtype
from pandas.core.frame import DataFrame
from timebudget import timebudget
import numpy as np
import requests
import json
from typing import List, Tuple
from datetime import datetime
from dataframes import Fixtures, Standings, TeamRatings, HomeAdvantages, Form, PositionOverTime, NextGames, SeasonStats
from data_vis import DataVis
from predictor import Predictor
from utilities import Utilities

utilities = Utilities()

class Data:
    def __init__(self, current_season: int):
        self.season = current_season
                
        # Import environment variables
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        self.url = os.getenv('URL')
        self.api = os.getenv('API')
        self.headers = {'X-Auth-Token': os.getenv('X_AUTH_TOKEN')}
                
        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 5
        self.star_team_threshold = 0.75  # Rating over 75% to be a star team
        
        # Temp store for requested json API data 
        self.new_data = {'fixtures': {}, 'standings': {}}
        
        # List of current season teams (taken from standings dataframe) 
        self.team_names = None
        self.logo_urls = {}
        
        # Dataframes to build
        self.fixtures = None
        self.standings = None
        self.team_ratings = None
        self.home_advantages = None
        self.form = None
        self.position_over_time = None
        self.next_games = None
        self.season_stats = None
        
        self.visualiser = DataVis()
        self.predictor = Predictor(current_season)
    

    def get_logo_url(self, team_name):
        return self.logo_urls[team_name]
    
    # ------ DATA API --------
    
    def fixtures_data(self, season: int, request_new: bool = True) -> dict:
        if request_new:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                        headers=self.headers)
            
            if response.status_code == 429:
                print('❌  Status:', response.status_code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print("✔️  Status:", response.status_code)
            
            response = response.json()['matches']
            
            return response
        else:
            # Read saved fixtures data
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)
    
    def standings_data(self, season: int, request_new: bool = True) -> dict:
        if request_new:
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season), 
                                    headers=self.headers)
            
            if response.status_code == 429:
                print("❌  Status:", response.status_code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print("✔️  Status:", response.status_code)
            
            response = response.json()['standings'][0]['table']
                
            return response
        else:
            # Read standings data
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)
    
    def fetch_data(self, n_seasons: int, request_new: bool = True):
        for n in range(n_seasons):          
            # Add new fixtures data to temp storage to be saved later
            self.new_data['fixtures'][self.season-n] = self.fixtures_data(self.season-n, request_new)
        self.new_data['standings'][self.season] = self.standings_data(self.season, request_new)
            
    def save_data(self):
        for season, data in self.new_data.items():
            # Save new fixtures data
            with open(f'data/fixtures_{season}.json', 'w') as json_file:
                json.dump(data, json_file)
    

    # ------- NEXT GAME --------

    def get_next_game_details(self, team_name: str):
        team_playing_next_name = ""
        team_playing_next_form_rating = None
        team_playing_next_home_away = None
        team_playing_prev_meetings = []
        prediction = None
        
        if self.next_games != None:
            # If season not finished
            team_playing_next_name = self.next_games.get_opposition(team_name)
            team_playing_next_form_rating = self.form.get_current_form_rating(team_playing_next_name)
            team_playing_next_home_away = self.next_games.get_home_away(team_name)
            team_playing_prev_meetings = self.next_games.get_previous_meetings(team_name)
            if self.predictor.predictions:
                prediction = self.predictor.predictions[team_name]
            
        return team_playing_next_name, team_playing_next_form_rating, team_playing_next_home_away, team_playing_prev_meetings, prediction


    
    # ---------------------- NEXT GAMES DATAFRAME ---------------------------

    def get_next_game(self, team_name: str, fixtures: Fixtures) -> Tuple[int, str]:
        # Scan through list of fixtures to find the first that is 'scheduled' 
        next_matchday_no, next_team = None, None
        for matchday_no in range(len(fixtures.df.columns.unique(level=0))):
            if fixtures.df.loc[team_name][f'Matchday {matchday_no+1}', 'Status'] == 'SCHEDULED':
                next_matchday_no = matchday_no
                date = fixtures.df.loc[team_name][f'Matchday {matchday_no+1}', 'Date']
                next_team = fixtures.df.loc[team_name][f'Matchday {matchday_no+1}', 'Team']
                break
        
        return next_matchday_no, date, next_team

    
    def include_current_seasons_meetings(self, next_games: pd.DataFrame):
        # Loop through the columns of matchdays that have been played
        for matchday_no in range(len(self.form.df.columns.unique(level=0))):
            matchday = f"Matchday {matchday_no+1}"
            matchday_data = self.fixtures.df[matchday]
            for team, row in matchday_data.iterrows():
                # if row['HomeAway'] == 'Home':  # From the perspective of the home team
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
    
    def include_prev_seasons_meetings(self, next_games: pd.DataFrame, no_seasons: int):
        for season in range(self.season-1, self.season-1-no_seasons, -1):
            data = self.new_data['fixtures'][season]
            
            for match in sorted(data, key=lambda x: x['matchday']):
                home_team = match['homeTeam']['name'].replace('&', 'and')
                away_team = match['awayTeam']['name'].replace('&', 'and')
                
                if home_team in next_games.index and away_team in next_games.index:
                    date = datetime.strptime(match['utcDate'][:10], "%Y-%m-%d").date().strftime('%d %B %Y')
                    
                    home_score = match['score']['fullTime']['homeTeam']
                    away_score = match['score']['fullTime']['awayTeam']
                    if home_score == away_score:
                        result = ('Drew', 'Drew')
                    elif home_score > away_score:
                        result = ('Won', 'Lost')
                    else:
                        result = ('Lost', 'Won')
                    
                    # From the perspective from the home team
                    # If this match's home team has their next game against this match's away team
                    if next_games.loc[home_team]['Next Game'] == away_team:
                        next_games.loc[home_team]['Previous Meetings'].append(tuple((date, home_team, away_team, match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'], result[0])))
                    
                    if next_games.loc[away_team]['Next Game'] == home_team:
                        next_games.loc[away_team]['Previous Meetings'].append(tuple((date, home_team, away_team, match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'], result[1])))
                        
    @timebudget
    def build_next_games(self, display: bool = False):
        """ Assigns self.next_games a dataframe containing data about the team's 
            previous meetings with the opposition team in their next game.
            
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
        """
        print("🔨 Building next games dataframe... ")
        
        next_games = pd.DataFrame()
        
        next_team_col = []
        next_game_dates_col = []
        for team_name, _ in self.fixtures.df.iterrows():
            matchday_no, date, next_team = self.get_next_game(team_name, self.fixtures)
            next_team_col.append(next_team)
            next_game_dates_col.append(date)
        
        if matchday_no == None:
            # If season has finished
            next_games = None
        else:
            next_games['Next Game'] = next_team_col
            next_games['Date'] = next_game_dates_col
            # Config index now as there are a correct number of rows, and allow to 
            # insert the HomeAway fixtures column (with same indices)
            next_games.index = self.fixtures.df.index
            next_games['HomeAway'] = self.fixtures.df[f'Matchday {matchday_no+1}']['HomeAway']
            next_games['Previous Meetings'] = [[] for _ in range(len(next_games.index))]
                    
            # Add any previous meetings that have been played this season
            self.include_current_seasons_meetings(next_games)
            # Add any previous meetings from last 2 sesaons
            self.include_prev_seasons_meetings(next_games, 2)
            
            # Sort each list of tuple previous meeting to be descending by date
            for _, row in next_games.iterrows():
                row['Previous Meetings'].sort(key=lambda x: datetime.strptime(x[0], '%d %B %Y'), reverse=True)
            
            next_games = NextGames(next_games)
            
        if display:
            print(next_games)
            
        self.next_games = next_games
    
    
    
    
    # ------------------------- FORM DATAFRAME -------------------------------
    
    
    def last_n_games(self, games_played: List, n_games: int, date) -> Tuple[List[str], List[str], List[str]]:
        """ Slice games played data to return only the last 'n_games' games from 
            the given date """

        if len(games_played) <= 0:
            return [], [], []
            
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

    
    
    def form_string(self, scores: List[str], home_aways: List[str]) -> str:
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

    def calc_form_rating(self, teams_played: List[str], form_str: str, gds: List[int], team_ratings: TeamRatings) -> float:
        form_percentage = 50  # Default percentage, moves up or down based on performance
        
        if form_str != None:  # If games have been played this season
            form_str = form_str.replace(',', '')
            for form_idx, result in enumerate(form_str):
                # Convert opposition team initials to their name 
                team_name = utilities.convert_team_name_or_initials(teams_played[form_idx])

                # Increament form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    form_percentage += (team_ratings.df.loc[team_name]['Total Rating'] * 100 / len(form_str)) * abs(gds[form_idx])
                elif result == 'D':
                    form_percentage +=  ((team_ratings.df.loc[team_name]['Total Rating'] - (team_ratings.df.loc[team_name]['Total Rating'])) * 100) / len(form_str)
                elif result == 'L':
                    form_percentage -= ((team_ratings.df.iloc[0]['Total Rating'] - team_ratings.df.loc[team_name]['Total Rating']) * 100 / len(form_str) * abs(gds[form_idx]))
                    
        # Cap rating
        if form_percentage > 100:
            form_percentage = 100
        elif form_percentage < 0:
            form_percentage = 0
        
        return form_percentage
    
    def calc_won_against_star_team_col(self, played_star_team_col, form_str_col):
        won_against_star_team_col = []
        for played_star_team, form_str in zip(played_star_team_col, form_str_col):  # Team has played games this season
            won_against_star_team_col.append([(result == 'W' and pst == True) for result, pst in zip(form_str.replace(',', ''), played_star_team)])
        return won_against_star_team_col
    
    def calc_played_star_team_col(self, teams_played_col):
        played_star_team_col = []
        for teams_played in teams_played_col:
            ratings = [self.team_ratings.df['Total Rating'][team_name] for team_name in list(map(utilities.convert_team_name_or_initials, teams_played))]
            played_star_team_col.append([team_rating > self.star_team_threshold for team_rating in ratings])
        return played_star_team_col
    
    def calc_form_rating_col(self, teams_played_col, form_str_col, goal_differences_col):
        form_rating_col = []
        for teams_played, form_str, gds in zip(teams_played_col, form_str_col, goal_differences_col):
            rating = self.calc_form_rating(teams_played, form_str, gds, self.team_ratings)
            form_rating_col.append(rating)
        return form_rating_col

    def calc_form_str_and_goal_differences_cols(self, scores_col, home_aways_col):
        form_str_col = []
        goal_differences_col = []
        # Loop through each matchday and record the goal different for each team
        for scores, home_aways in zip(scores_col, home_aways_col):
            # Append 'W', 'L' or 'D' depending on result
            form_str_col.append(self.form_string(scores, home_aways))
            
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
            
        return form_str_col, goal_differences_col

    def calc_last_n_games_cols(self, fixtures: Fixtures, n_games: int, matchday_num: int) -> Tuple[List[List[str]], List[List[str]], List[List[str]]]:
        teams_played_col = []
        scores_col = []
        home_away_col = []
        
        matchday_dates = fixtures.df[f'Matchday {matchday_num}', 'Date']
        median_matchday_date = matchday_dates[len(matchday_dates)//2].asm8
                
        for team_name, row in fixtures.df.iterrows():
            dates = fixtures.df.loc[team_name, (slice(None), 'Date')]
            teams_played = fixtures.df.loc[team_name, (slice(None), 'Team')]
            scores = fixtures.df.loc[team_name, (slice(None), 'Score')]
            home_aways = fixtures.df.loc[team_name, (slice(None), 'HomeAway')]
            
            # List containing a tuple for each game
            games_played = list(zip(dates.values, teams_played.values, scores.values, home_aways.values))
            # Remove matchdays that haven't played yet and don't have a score
            games_played = [game for game in games_played if game[2] != 'None - None']
            # Sort by date
            games_played = sorted(games_played, key=lambda x: x[0])
            
            matchday_date = row[f'Matchday {matchday_num}']['Date'].asm8
            
            # If matchday date is far away from the mean and this matchday has 
            # been rescheduled, use the mean matchday date insead
            # Check within 2 weeks either side
            if not (median_matchday_date - np.timedelta64(14,'D') < matchday_date < median_matchday_date + np.timedelta64(14,'D')):
                matchday_date = median_matchday_date
            
            teams_played, scores, home_away = self.last_n_games(games_played, n_games, matchday_date)
            teams_played_col.append(teams_played)
            scores_col.append(scores)
            home_away_col.append(home_away)

        # Convert full team names to team initials
        teams_played_col = [list(map(lambda team_name : utilities.convert_team_name_or_initials(team_name), teams_played))
                                 for teams_played in teams_played_col]
                
        return teams_played_col, scores_col, home_away_col
    
    @timebudget
    def build_form(self, display: bool = False):
        """ Assigns self.form a dataframe containing data about the team's form 
            for each matchday played this season.
            
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
        """
        print("🔨 Building form dataframe... ")
        
        # Get number of matchdays that have had all teams played
        score = self.fixtures.df.loc[:, (slice(None), 'Score')]
        # Remove cols for matchdays that haven't played yet
        score = score.replace("None - None", np.nan).dropna(axis=1, how='all')

        form = {}
        
        # Loop through each matchday number played so far
        cols = list(score.columns.get_level_values(0))
        # Remove 'Matchday' prefix and just store sorted integers
        matchday_nums = sorted(map(lambda x: int(x.split(' ')[-1]), cols))
        
        for n in matchday_nums:
            form[(f'Matchday {n}', 'Date')] = self.fixtures.df[f'Matchday {n}', 'Date']
            
            # Get data about last 5 matchdays
            teams_played_col, scores_col, home_aways_col = self.calc_last_n_games_cols(self.fixtures, 5, n)
            form[(f'Matchday {n}', 'Teams Played')] = teams_played_col
            form[(f'Matchday {n}', 'Scores')] = scores_col
            form[(f'Matchday {n}', 'HomeAway')] = home_aways_col
            
            # Form string and goal differences column
            form_str_col, goal_differences_col = self.calc_form_str_and_goal_differences_cols(scores_col, home_aways_col)
            form[(f'Matchday {n}', 'Form')] = form_str_col
            form[(f'Matchday {n}', 'GDs')] = goal_differences_col

            form_rating_col = self.calc_form_rating_col(teams_played_col, form_str_col, goal_differences_col)
            form[(f'Matchday {n}', 'Form Rating %')] = form_rating_col
            
            # Column (list of booleans) for whether last 5 games have been against 
            # a team with a long term (multiple season) rating over a certain 
            # threshold (a star team)
            played_star_team_col = self.calc_played_star_team_col(teams_played_col)
            form[(f'Matchday {n}', 'Played Star Team')] = played_star_team_col
            
            # Column (list of booleans) for whether last 5 games have won against 
            # a star team
            won_against_star_team_col = self.calc_won_against_star_team_col(played_star_team_col, form_str_col)
            form[(f'Matchday {n}', 'Won Against Star Team')] = won_against_star_team_col
            
            # Remove column after use, data is not that useful to keep
            del form[(f'Matchday {n}', 'Played Star Team')]
                    
        form = Form(form)
                
        if display: 
            print(form)
            
        self.form = form
    
    
    
    
    # ------------ POSITION OVER TIME DATAFRAME ------------
    
    def get_gd_and_pts(self, score: str, home_away: str) -> Tuple[int, int]:
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
    def build_position_over_time(self, display: bool = False):
        """ Assigns self.position_over_time a dataframe containing data about the 
            team's past and present league positions at each matchday played this 
            season.
            
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
        """
        print("🔨 Building position over time dataframe... ")
        
        # Check for dependencies
        if not self.fixtures or not self.standings:
            raise ValueError('❌ [ERROR] Cannot build position over time datafram: Dependencies not available')
                
        position_over_time = pd.DataFrame()

        score = self.fixtures.df.loc[:, (slice(None), 'Score')]
        home_away = self.fixtures.df.loc[:, (slice(None), 'HomeAway')]
        date = self.fixtures.df.loc[:, (slice(None), 'Date')]
        
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
                new_gd, new_pts = self.get_gd_and_pts(row['Score'], row['HomeAway'])
                gd += new_gd
                pts += new_pts
                
                gd_col.append(gd)
                pts_col.append(pts)
            
            position_over_time[f'Matchday {matchday_no}', 'GD'] = gd_col
            position_over_time[f'Matchday {matchday_no}', 'Points'] = pts_col
            
            position_over_time.sort_values(by=[(f'Matchday {matchday_no}', 'Points'), (f'Matchday {matchday_no}', 'GD')], ascending=False, inplace=True)
            # If on the last and most recent column, ensure matchday positions is 
            # exactly the same order as from API standings data 
            if idx == no_cols - 1:
                # Reorder to the order as standings data
                position_over_time = position_over_time.reindex(self.standings.df.index)

            position_over_time[f'Matchday {matchday_no}', 'Position'] = np.arange(1, 21)
               
        sorted_index = sorted(position_over_time.columns.values.tolist(), key=lambda x: int(x[0].split(' ')[-1]))
        position_over_time = position_over_time.reindex(sorted_index, axis=1)

        position_over_time = PositionOverTime(position_over_time)
                
        if display:
            print(position_over_time)
            
        self.position_over_time = position_over_time
    
    
    
    
    # ------------- HOME ADVANTAGES DATAFRAME ---------------
    
    
    def home_advantages_for_season(self, data: json, season: int) -> DataFrame:
        d = {}
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')

            if home_team not in d.keys():
                d[home_team] = {(f'{season}', 'Home Wins'): 0, 
                                (f'{season}', 'Home Draws'): 0,
                                (f'{season}', 'Home Loses'): 0,
                                (f'{season}', 'Away Wins'): 0,
                                (f'{season}', 'Away Draws'): 0,
                                (f'{season}', 'Away Loses'): 0}                
            if away_team not in d.keys():
                d[away_team] = {(f'{season}', 'Home Wins'): 0, 
                                (f'{season}', 'Home Draws'): 0,
                                (f'{season}', 'Home Loses'): 0,
                                (f'{season}', 'Away Wins'): 0,
                                (f'{season}', 'Away Draws'): 0,
                                (f'{season}', 'Away Loses'): 0}   
            
            if match['score']['winner'] != None:
                if match['score']['fullTime']['homeTeam'] > match['score']['fullTime']['awayTeam']:
                    # Home team wins
                    d[home_team][(f'{season}', 'Home Wins')] += 1
                    d[away_team][(f'{season}', 'Away Loses')] += 1
                elif match['score']['fullTime']['homeTeam'] < match['score']['fullTime']['awayTeam']:
                    # Away team wins
                    d[home_team][(f'{season}', 'Home Loses')] += 1
                    d[away_team][(f'{season}', 'Away Wins')] += 1
                else:  # Draw
                    d[home_team][(f'{season}', 'Home Draws')] += 1
                    d[away_team][(f'{season}', 'Away Draws')] += 1
                    
        df = pd.DataFrame(d)
        # Drop teams that are not in the current season
        df = df.drop(df.columns[~df.columns.isin(self.team_names)].values.tolist(), axis=1)
        
        return df

    def create_home_advantages_column(self, home_advantages, season):
        home_advantages[f'{season}', 'Played'] = home_advantages[f'{season}']['Home Wins'] \
                                               + home_advantages[f'{season}']['Home Draws'] \
                                               + home_advantages[f'{season}']['Home Loses'] \
                                               + home_advantages[f'{season}']['Away Wins'] \
                                               + home_advantages[f'{season}']['Away Draws'] \
                                               + home_advantages[f'{season}']['Away Loses']
        home_advantages[f'{season}', 'Played at Home'] = home_advantages[f'{season}']['Home Wins'] \
                                                       + home_advantages[f'{season}']['Home Draws'] \
                                                       + home_advantages[f'{season}']['Home Loses']
        # Percentage wins = total wins / total games played
        home_advantages[f'{season}', 'Wins %'] = ((home_advantages[f'{season}']['Home Wins'] 
                                                 + home_advantages[f'{season}']['Away Wins']) 
                                                 / home_advantages[f'{season}']['Played']) * 100
        # Percentage wins at home = total wins at home / total games played at home 
        home_advantages[f'{season}', 'Home Wins %'] = (home_advantages[f'{season}']['Home Wins'] 
                                                     / home_advantages[f'{season}']['Played at Home']) * 100
        # Home advantage = percentage wins at home - percentage wins 
        home_advantages[f'{season}', 'Home Advantage'] = (home_advantages[f'{season}']['Home Wins %'] 
                                                        - home_advantages[f'{season}']['Wins %']) / 100
    
    @timebudget
    def build_home_advantages(self, no_seasons: int, display: bool = False):
        """ Assigns self.home_advantages to a dataframe containing team's home 
            advantage information for each season with a final column for 
            combined total home advantage values.
            
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
        """
        print("🔨 Building home advantages dataframe... ")
        
        home_advantages = pd.DataFrame()
        
        dfs = []
        for i in range(no_seasons):
            data = self.new_data['fixtures'][self.season-i]
            df = self.home_advantages_for_season(data, self.season-i)
            dfs.append(df)
        
        home_advantages = pd.concat(dfs).T
        home_advantages.index.name = "Team"
        home_advantages = home_advantages.fillna(0)
        home_advantages = home_advantages.astype(int)
        
        # Create home advantage column
        for i in range(no_seasons):
            self.create_home_advantages_column(home_advantages, self.season-i)
        
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

        home_advantages = HomeAdvantages(home_advantages)
                
        if display:
            print(home_advantages)
        
        self.home_advantages = home_advantages



    # ------------- Standings dataframe ---------------
    
  

    # @timebudget
    # def build_standings(self, no_seasons: int, display: bool = False, request_new: bool = True):
    #     """ Sets self.standings to a dataframe containing all table standings for 
    #         each season from current season to season [no_seasons] years ago.
            
    #         Rows: the 20 teams participating in the current season, ordered ascending 
    #             by the team's position in the current season 
    #         Columns (multi-index):
    #         ------------------------------------------------------------------------
    #         |                            [SEASON YEAR]                             |
    #         ------------------------------------------------------------------------
    #         | Position | Played | Form | Won | Draw | Lost | Points | GF | GA | GD |
            
    #         [SEASON YEAR]: 4-digit year values that a season began, from current 
    #             season to season no_seasons ago
    #         Position: unique integer from 1 to 20 depending on the table position 
    #             a team holds in the season
    #         Played: the number of games a team has played in the season
    #         Form: a string of 5 characters W, D or L separated by commas, the 
    #             left-most character corresponds to the results of the most recent 
    #             game the team played from that season
    #         Won: the number of games a team has won in the season
    #         Drawn: the number of games a team has drawn in the season
    #         Lost: the number of games a team has lost in the season
    #         GF: goals for - the number of goals a team has scored in this season
    #         GA: goals against - the number of games a team has lost in the season
    #         GD: the number of games a team has lost in the season

    #     Args:
    #         no_seasons (int): number of previous seasons to fetch and include.
    #         display (bool, optional): flag to print the dataframe to console after 
    #             creation. Defaults to False.
    #         request_new (bool, optional): flag to request new data from data API.
    #             If false, stored data file is used. Defaults to True.
    #     """
    #     print("🔨 Building standings dataframe...")
                
    #     standings = pd.DataFrame()
        
    #     # Loop from current season to the season 2 years ago
    #     for i in range(no_seasons):
    #         data = self.standings_data(self.season-i, request_new=request_new)
            
    #         # pprint.pprint(data)
    #         df = pd.DataFrame(data)

    #         # Rename teams to their team name
    #         team_names = pd.Series([name.replace('&', 'and') for name in [df['team'][x]['name'] for x in range(len(df))]])
    #         # Record each team's crest url to dictionary 
    #         for _, team in df['team'].iteritems():
    #             team_name = team['name'].replace('&', 'and')
    #             crest_url = team['crestUrl']
    #             self.logo_urls[team_name] = crest_url
            
    #         # Overwrite team column with just team names
    #         df['team'] = team_names


    #         df.columns = pd.MultiIndex.from_tuples(((f'{self.season-i}', 'Position'), 
    #                                                 (f'{self.season-i}', 'Team'),
    #                                                 (f'{self.season-i}', 'Played'),
    #                                                 (f'{self.season-i}', 'Form'),
    #                                                 (f'{self.season-i}', 'Won'),
    #                                                 (f'{self.season-i}', 'Draw'),
    #                                                 (f'{self.season-i}', 'Lost'),
    #                                                 (f'{self.season-i}', 'Points'),
    #                                                 (f'{self.season-i}', 'GF'),
    #                                                 (f'{self.season-i}', 'GA'), 
    #                                                 (f'{self.season-i}', 'GD'),))

    #         df.index = df[f'{self.season-i}']['Team']
    #         df = df.drop(columns=['Team'], level=1)
            
    #         if i == 0:  # If building current season table
    #             standings = standings.append(df)
    #             self.team_names = team_names
    #         else:
    #             # Drop team rows that are no longer in the current season
    #             df = df.drop(df[~df.index.isin(standings.index)].index)
    #             # Drop the Form column from previous seasons
    #             df = df.drop(columns=['Form'], level=1)
    #             # Add season standings to main standings dataframe 
    #             standings = pd.concat([standings, df], axis=1)
        
    #     standings.index.name = "Team"
        
    #     standings = Standings(standings)
        
    #     if display:
    #         print(standings)
        
    #     self.standings = standings

    def season_standings(self, season: int) -> DataFrame:
        data = self.new_data['fixtures'][season]
        
        col_headings = ['Position', 'Played', 'Won', 'Draw', 'Lost', 'GF', 'GA', 'GD', 'Points']
        #                                0        1      2    3     4     5  6   7     8
        # Create rows of team name : [Position, Played, Won, Draw, Lost, GF, GA, GD, Points]
        df_rows = {}
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')
            # Init teams if doesn't already exits
            if home_team not in df_rows:
                df_rows[home_team] = [0 for _ in col_headings]
            if away_team not in df_rows:
                df_rows[away_team] = [0 for _ in col_headings]
                
            if match['status'] == 'FINISHED':
                home_goals = match['score']['fullTime']['homeTeam']
                away_goals = match['score']['fullTime']['awayTeam']
                
                # Increment Played
                df_rows[home_team][1] += 1  
                df_rows[away_team][1] += 1  
                
                # Add GF
                df_rows[home_team][5] += home_goals
                df_rows[away_team][5] += away_goals

                # Add GA
                df_rows[home_team][6] += away_goals
                df_rows[away_team][6] += home_goals
                
                # Record result and points
                if home_goals > away_goals:  # Home team win
                    df_rows[home_team][2] += 1
                    df_rows[away_team][4] += 1
                    # Points
                    df_rows[home_team][8] += 3
                elif home_goals < away_goals:
                    df_rows[home_team][4] += 1
                    df_rows[away_team][2] += 1
                    # Points
                    df_rows[away_team][8] += 3
                else:  # Draw
                    df_rows[home_team][3] += 1
                    df_rows[away_team][3] += 1
                    # Points
                    df_rows[home_team][8] += 1
                    df_rows[away_team][8] += 1
                    
        # Sort rows by Points, then GD
        df_rows = dict(sorted(df_rows.items(), key=lambda v: v[1][8], reverse=True))
        
        # Calc GD and Position for each team
        for idx, team in enumerate(df_rows.keys()):
            # GD = GF - GA
            df_rows[team][7] = df_rows[team][5] - df_rows[team][6]
            # Position is index as they have been sorted by points
            df_rows[team][0] = idx + 1
            
        df = pd.DataFrame.from_dict(df_rows, orient='index')
        df.columns = pd.MultiIndex.from_product([[season], col_headings])
        
        # Drop any rows with columns not in the current season
        df = df.drop(df[~df.index.isin(self.team_names)].index)

        return df

    @timebudget
    def build_standings(self, no_seasons: int, display: bool = False):
        """ Sets self.standings to a dataframe containing all table standings for 
            each season from current season to season [no_seasons] years ago.
            
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
        """
        print("🔨 Building standings dataframe...")
                
        if not self.team_names:
            raise ValueError('❌ [ERROR] Cannot build standings dataframe: Team names list required')
        
        standings = pd.DataFrame()
        
        # Loop from current season to the season 2 years ago
        for n in range(no_seasons):
            season_standings = self.season_standings(self.season-n)
            standings = pd.concat((standings, season_standings), axis=1)
        
        standings = standings.fillna(0).astype(int)
        standings.index.name = "Team"
        standings = Standings(standings)

        print(standings)
        if display:
            print(standings)
        
        self.standings = standings

    # ------------ Fixtures dataframe -------------


            
    @timebudget
    def build_fixtures(self, display: bool = False):        
        """ Sets self.fixtures to a dataframe containing the past and future 
            fixtures for the current season (matchday 1 to 38).
            
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
        """
        print("🔨 Building fixtures dataframe... ")
        
        # Get json fixtures data
        data = self.new_data['fixtures'][self.season]
                
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
        
        fixtures = Fixtures(fixtures)
                
        if display:
            print(fixtures)
        
        self.fixtures = fixtures



    # ----------- Team ratings dataframe -----------
    
    def calc_rating(self, position: int, points: int, gd: int) -> float:
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points
        return rating
    
    def get_season_weightings(self, no_seasons: int) -> List[float]:
        weights = [0.75, 0.20, 0.05]
        weights = np.array(weights[:no_seasons])
        # Normalise list
        weights = list(weights / sum(weights))
        return weights
    
    @timebudget
    def build_team_ratings(self, no_seasons: int, display: bool = False):
        """ Sets self.team_ratings to a dataframe containing data regarding each team's 
            calculated rating based on the last [no_seasons] seasons results.
            
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
        """
        print("🔨 Building team ratings dataframe... ")
        
        # Check for dependencies
        if not self.standings:
            raise ValueError('❌ [ERROR] Cannot build team ratings datafram: Standings dataframe not available')
        
        # Add current season team names to the object team dataframe
        team_ratings = pd.DataFrame(index=self.standings.df.index)

        # Create column for each included season
        for i in range(0, no_seasons):
            team_ratings[f'Rating {i}Y Ago'] = np.nan
                
        # Insert rating values for each row
        for team_name, row in self.standings.df.iterrows():
            for i in range(no_seasons):
                rating = self.calc_rating(row[self.season-i]['Position'], row[self.season-i]['Points'], row[self.season-i]['GD'])
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
        if (self.standings.df[self.season]['Played'] <= self.games_threshold).all():  # If current season hasn't played enough games
            print(f"Current season excluded from team ratings calculation -> all teams played {self.games_threshold} games.")
            include_current_season = False
        else:
            include_current_season = True

        # Calculate total rating column
        team_ratings['Total Rating'] = 0
        if include_current_season:
            start_n = 0  # Include current season when calculating total rating
            w = self.get_season_weightings(no_seasons) # Column weights
        else:
            start_n = 1  # Exclude current season when calculating total rating
            w = self.get_season_weightings(no_seasons-1) # Column weights

        for i in range(start_n, no_seasons):
            team_ratings['Total Rating'] += w[i-start_n] * team_ratings[f'Normalised Rating {i}Y Ago']

        team_ratings = team_ratings.sort_values(by="Total Rating", ascending=False).rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'})
        
        team_ratings = TeamRatings(team_ratings)
        
        if display:
            print(team_ratings)
        
        self.team_ratings = team_ratings
    
    
    def build_logo_urls(self):
        data = self.new_data['standings'][self.season]

        logo_urls = {}
        for standings_row in data:
            team_name = standings_row['team']['name'].replace('&', 'and')
            crest_url = standings_row['team']['crestUrl']
            logo_urls[team_name] = crest_url
        
        self.logo_urls = logo_urls
        self.team_names = logo_urls.keys()
            

    # ----------- SEASON STATS -----------
    
    def build_season_stats(self, display: bool = False) -> dict:
        cols = list(self.position_over_time.df.columns.unique(level=0))
        
        season_stats = {'Clean Sheet Ratio': {},
                        'Goals Per Game': {},
                        'Conceded Per Game': {}}
        for team_name, row in self.position_over_time.df.iterrows():
            n_games = 0
            clean_sheets = 0
            goals_scored = 0
            goals_conceded = 0
            for matchday in cols:
                match = row[matchday]
                if type(match['Score']) is str:
                    home, _ , away = match['Score'].split(' ')
                    home, away = int(home), int(away)
                    if match['HomeAway'] == 'Home':
                        goals_scored += home
                        if away == 0:
                            clean_sheets += 1
                        else:
                            goals_conceded += away
                    elif match['HomeAway'] == 'Away':
                        goals_scored += away
                        if home == 0:
                            clean_sheets += 1
                        else:
                            goals_conceded += home
                            
                    n_games += 1
            
            if n_games > 0:
                season_stats['Clean Sheet Ratio'][team_name] = round(clean_sheets / n_games, 2)
                season_stats['Goals Per Game'][team_name] = round(goals_scored / n_games, 2)
                season_stats['Conceded Per Game'][team_name] = round(goals_conceded / n_games, 2)
            else:
                season_stats['Clean Sheet Ratio'][team_name] =0
                season_stats['Goals Per Game'][team_name] = 0
                season_stats['Conceded Per Game'][team_name] = 0
            
        season_stats = SeasonStats(season_stats)
        
        if display:
            print(season_stats)
        
        self.season_stats = season_stats
    
    def update_predictions(self):
        # Create predictions
        count = self.predictor.set_score_predictions(self.form, self.next_games)
        if count > 0:
            print(f'ℹ️  Added {count} new predictions')
        count = self.predictor.record_actual_results(self.fixtures)
        if count > 0:
            print(f'ℹ️  Updated {count} predictions with their actual results')
        prediction_accuracy, result_accuracy = self.predictor.set_accuracy()
        print(f'ℹ️  Predicting with accuracy: {prediction_accuracy*100}%')
        print(f'ℹ️  Predicting correct results with accuracy: {result_accuracy*100}%')

    
    def build_dataframes(self, n_seasons: int = 3, display_tables: bool = False, request_new: bool = True):
        # Record team names and urls of team logos
        self.build_logo_urls()
        # Standings for the last [n_seasons] seasons
        self.build_standings(n_seasons, display=display_tables)
        # Fixtures for the whole season for each team
        self.build_fixtures(display=display_tables)
        # Ratings for each team, based on last [no_seasons] seasons standings table
        self.build_team_ratings(n_seasons, display=display_tables)
        # Calculated values to represent the personalised advantage each team has at home
        self.build_home_advantages(n_seasons, display=display_tables)
        # Calculated form values for each team for each matchday played so far
        self.build_form(display=display_tables)
        # Snapshots of a teams table position and match results for each matchday played so far 
        self.build_position_over_time(display=display_tables)
        # Data about the opponent in each team's next game 
        self.build_next_games(display=display_tables)
        # Season metrics
        self.build_season_stats(display=display_tables)
    
    
    @timebudget
    def update_all(self, n_seasons: int = 3, team_name: str = None, display_tables: bool = False, display_graphs: bool = False, request_new: bool = True):
        try:
            # Fetch data
            self.fetch_data(n_seasons, request_new)
        except ValueError as e:
            print(e)
            print("🔄 Retrying with saved data...")
            self.fetch_data(n_seasons, False)
        
        self.build_dataframes(n_seasons, display_tables)
        self.update_predictions()
        
        # Save any new data to json files
        if self.new_data:
            print("💾 Saving new data...")
            self.save_data()
        
        if request_new:
            # Use dataframes to update all graph HTML files
            self.visualiser.update_all(self.fixtures.df, 
                                       self.team_ratings.df, 
                                       self.home_advantages.df, 
                                       self.form.df, 
                                       self.position_over_time.df, 
                                       display_graphs=display_graphs, 
                                       team_name=team_name)



if __name__ == "__main__":
    # Update all dataframes
    data = Data(2021)
    data.update_all(request_new=False, team_name='Liverpool FC', display_tables=False)

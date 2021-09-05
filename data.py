import os
from os.path import join, dirname
from dotenv import load_dotenv
import pandas as pd
from pandas.core.frame import DataFrame
from collections import defaultdict
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
        __file__ = 'data.py'
        dotenv_path = join(dirname(__file__), '.env')
        load_dotenv(dotenv_path)
        self.url = os.getenv('URL')
        self.api = os.getenv('API')
        self.headers = {'X-Auth-Token': os.getenv('X_AUTH_TOKEN')}
                
        # Number of games played in a season for season data to be used
        self.games_threshold = 4
        self.home_games_threshold = 4
        self.star_team_threshold = 0.75  # Rating over 75% to be a star team
        
        # Temp store for requested json API data 
        self.json_data = {'fixtures': {}, 'standings': {}}
        
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
                print('✔️  Status:', response.status_code)
            
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
                print('❌  Status:', response.status_code)
                raise ValueError('❌ ERROR: Data request failed')
            else:
                print('✔️  Status:', response.status_code)
            
            response = response.json()['standings'][0]['table']
                
            return response
        else:
            # Read standings data
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)
    
    def fetch_data(self, n_seasons: int, request_new: bool = True):
        for n in range(n_seasons):          
            # Add new fixtures data to temp storage to be saved later
            self.json_data['fixtures'][self.season-n] = self.fixtures_data(self.season-n, request_new)
        self.json_data['standings'][self.season] = self.standings_data(self.season, request_new)
            
    def save_data(self):
        for data_type in self.json_data.keys():
            for season, data in self.json_data[data_type].items():
                # Save new fixtures data
                with open(f'data/{data_type}_{season}.json', 'w') as json_file:
                    json.dump(data, json_file)
    
    
    
    
    # ------------------------- STANDINGS DATAFRAME ----------------------------
    
    def fill_rows_from_data(self, data):
        df_rows = {}
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')
            # Init teams if doesn't already exits
            for team in [home_team, away_team]:
                if team not in df_rows:
                    df_rows[team] = {'Position': None, 'Played': 0, 'Won': 0, 'Drawn': 0, 'Lost': 0, 'GF': 0, 'GA': 0, 'GD': 0, 'Points': 0}

                
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
    
    def add_gd_col(self, df_rows):
        for team in df_rows.keys():
            df_rows[team]['GD'] = df_rows[team]['GF'] - df_rows[team]['GA']
    
    def add_position_col(self, df_rows):
        for idx, team in enumerate(df_rows.keys()):
            # Position is index as they have been sorted by points
            df_rows[team]['Position'] = idx + 1
    
    def season_standings(self, season: int) -> DataFrame:        
        data = self.json_data['fixtures'][season]

        df_rows = self.fill_rows_from_data(data)
        self.add_gd_col(df_rows)
                
        # Sort rows by Points, then GD, then GF
        df_rows = dict(sorted(df_rows.items(), key=lambda v: [v[1]['Points'], v[1]['GD'], v[1]['GF']], reverse=True))
        # Use df sorted by points to insert table position
        self.add_position_col(df_rows)
        
        df = pd.DataFrame.from_dict(df_rows, orient='index')
        df.columns = pd.MultiIndex.from_product([[season], ['Position', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']])
        
        # Drop any rows with columns not in the current season
        df = df.drop(df[~df.index.isin(self.team_names)].index)

        return df

    @timebudget
    def build_standings_df(self, n_seasons: int, display: bool = False):
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
        """
        print('🔨 Building standings dataframe...')
        
        # Check for dependencies
        if not self.team_names:
            raise ValueError('❌ [ERROR] Cannot build standings dataframe: Team names list required')
        
        standings = pd.DataFrame()
        
        # Loop from current season to the season 2 years ago
        for n in range(n_seasons):
            season_standings = self.season_standings(self.season-n)
            standings = pd.concat((standings, season_standings), axis=1)
        
        standings = standings.fillna(0).astype(int)
        standings.index.name = "Team"

        if display:
            print(standings)
        
        self.standings = Standings(standings)



    
    # --------------------------- FORM DATAFRAME -------------------------------
    
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
                    
        form_str = ''.join(form_str)  # Convert to string
        return form_str

    def calc_form_rating(self, teams_played: List[str], form_str: str, gds: List[int], team_ratings: TeamRatings) -> float:
        form_percentage = 0.5  # Default percentage, moves up or down based on performance
        
        if form_str != None:  # If games have been played this season
            # form_str = form_str.replace(',', '')
            for form_idx, result in enumerate(form_str):
                # Convert opposition team initials to their name 
                team_name = utilities.convert_team_name_or_initials(teams_played[form_idx])

                # Increament form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    form_percentage += (team_ratings.df.loc[team_name]['TotalRating'] / len(form_str)) * abs(gds[form_idx])
                elif result == 'D':
                    form_percentage +=  (team_ratings.df.loc[team_name]['TotalRating'] - team_ratings.df.loc[team_name]['TotalRating']) / len(form_str)
                elif result == 'L':
                    form_percentage -= ((team_ratings.df.iloc[0]['TotalRating'] - team_ratings.df.loc[team_name]['TotalRating']) / len(form_str)) * abs(gds[form_idx])
                    
        # Cap rating
        if form_percentage > 1:
            form_percentage = 1
        elif form_percentage < 0:
            form_percentage = 0
        
        return form_percentage
    
    def calc_won_against_star_team_col(self, played_star_team_col, form_str_col):
        won_against_star_team_col = []
        for played_star_team, form_str in zip(played_star_team_col, form_str_col):  # Team has played games this season
            won_against_star_team_col.append([(result == 'W' and pst == True) for result, pst in zip(form_str, played_star_team)])
        return won_against_star_team_col
    
    def calc_played_star_team_col(self, teams_played_col):
        played_star_team_col = []
        for teams_played in teams_played_col:
            ratings = [self.team_ratings.df['TotalRating'][team_name] for team_name in list(map(utilities.convert_team_name_or_initials, teams_played))]
            played_star_team_col.append([team_rating > self.star_team_threshold for team_rating in ratings])
        return played_star_team_col
    
    def calc_form_rating_col(self, teams_played_col, form_str_col, goal_differences_col):
        form_rating_col = []
        for teams_played, form_str, gds in zip(teams_played_col, form_str_col, goal_differences_col):
            rating = self.calc_form_rating(teams_played, form_str, gds, self.team_ratings)
            form_rating_col.append(rating)
        return form_rating_col

    def calc_form_str_and_gd_cols(self, scores_col, home_aways_col):
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

    def last_n_games(self, games_played: List, n_games: int, date) -> Tuple[List[str], List[str], List[str]]:
        """ Slice games played data to return only the last 'n_games' games from 
            the given date """

        if len(games_played) <= 0:
            return [], [], []
            
        dates, teams_played, scores, home_aways = list(zip(*games_played))
        index = len(dates) - 1  # Default to latest game
        
        # Find index of dates where this matchday would fit
        for i in range(len(dates)):
            if i == len(dates)-1:
                index = i+1
                break
            if date < dates[i+1]:
                index = i
                break
        
        # Get the last n_games matchday values from this index
        if len(dates) > n_games:
            low = index - n_games+1
            if low < 0:
                low = 0
            high = index + 1
        else:
            low = 0
            high = index + 1
            
        teams_played = teams_played[low:high]
        scores = scores[low:high]
        home_aways = home_aways[low:high]
        
        return list(teams_played), list(scores), list(home_aways)
    
    def last_n_games_cols(self, fixtures: Fixtures, n_games: int, matchday_no: int) -> Tuple[List[List[str]], List[List[str]], List[List[str]]]:
        teams_played_col, scores_col, home_away_col  = [], [], []
        
        matchday_dates = fixtures.df[matchday_no, 'Date']
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
            games_played = sorted(games_played, key=lambda x: x[0])  # Sort by date
            
            matchday_date = row[matchday_no]['Date'].asm8
            
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
        teams_played_col = [list(map(utilities.convert_team_name_or_initials, teams_played)) for teams_played in teams_played_col]
                
        return teams_played_col, scores_col, home_away_col
    
    @timebudget
    def build_form_df(self, display: bool = False):
        """ Assigns self.form a dataframe containing data about the team's form 
            for each matchday played this season.
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ----------------------------------------------------------------------------------------------------------
            |                                             [Matchday Number]                                          |
            ----------------------------------------------------------------------------------------------------------
            | Date | TeamsPlayed | Scores | HomeAway | Form | GDs | FormRating | PlayedStarTeam | WonAgainstStarTeam |
            
            [Matchday Numbers]: integers from 1 to the most recent matchday
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
        print('🔨 Building form dataframe... ')
        
        # Check for dependencies
        if not self.fixtures:
            raise ValueError('❌ [ERROR] Cannot form over time dataframe: Fixures data frame not available')
        
        # Get number of matchdays that have had all teams played
        score = self.fixtures.df.loc[:, (slice(None), 'Score')]
        # Remove cols for matchdays that haven't played yet
        score = score.replace("None - None", np.nan).dropna(axis=1, how='all')

        matchday_nos = sorted(list(score.columns.get_level_values(0)))
        
        form = {}
        for n in matchday_nos:
            form[(n, 'Date')] = self.fixtures.df[n, 'Date']
            
            # Get data about last 5 matchdays
            teams_played_col, scores_col, home_aways_col = self.last_n_games_cols(self.fixtures, 5, n)
            form[(n, 'TeamsPlayed')] = teams_played_col
            form[(n, 'Scores')] = scores_col
            form[(n, 'HomeAway')] = home_aways_col
                        
            # Form string and goal differences column
            form_str_col, gd_col = self.calc_form_str_and_gd_cols(scores_col, home_aways_col)
            form[(n, 'Form')] = form_str_col
            form[(n, 'GDs')] = gd_col

            form_rating_col = self.calc_form_rating_col(teams_played_col, form_str_col, gd_col)
            form[(n, 'FormRating')] = form_rating_col
            
            # Column (list of booleans) for whether last 5 games have been against 
            # a team with a long term (multiple season) rating over a certain 
            # threshold (a star team)
            played_star_team_col = self.calc_played_star_team_col(teams_played_col)
            form[(n, 'PlayedStarTeam')] = played_star_team_col
            
            # Column (list of booleans) for whether last 5 games have won against 
            # a star team
            won_against_star_team_col = self.calc_won_against_star_team_col(played_star_team_col, form_str_col)
            form[(n, 'WonAgainstStarTeam')] = won_against_star_team_col
            
            # Remove column after use, data is not that useful to keep
            del form[(n, 'PlayedStarTeam')]
        
        form = pd.DataFrame.from_dict(form)
        form.columns.names = ["Matchday", None]
                                    
        if display: 
            print(form)
            
        self.form = Form(form)
    
    
    
    
    
    # ---------------------- POSITION OVER TIME DATAFRAME ----------------------
    
    def get_gd_and_pts(self, score: str, home_away: str) -> Tuple[int, int]:
        pts, gd = 0, 0
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

    def goal_diff_and_pts_cols(self,  matchday_no: int, matchday_nums: List[int], matchday_nums_idx: int, position_over_time: pd.DataFrame) -> Tuple[List[int], List[int]]:
        gd_col, pts_col = [], []
        
        col_data = position_over_time[matchday_no]
        for team_name, row in col_data.iterrows():
            gd = 0
            pts = 0
            if matchday_nums_idx != 0:
                # Add previous weeks cumulative gd
                prev_matchday_no_idx = matchday_nums_idx-1
                previous_matchday_no = matchday_nums[prev_matchday_no_idx]
                prev_gd = position_over_time.loc[team_name][previous_matchday_no, 'GD']
                prev_pts = position_over_time.loc[team_name][previous_matchday_no, 'Points']
                gd += prev_gd
                pts += prev_pts
            # If this matchday has had all games played and is in score table
            # Add this weeks gd
            new_gd, new_pts = self.get_gd_and_pts(row['Score'], row['HomeAway'])
            gd += new_gd
            pts += new_pts
            
            gd_col.append(gd)
            pts_col.append(pts)
        
        return gd_col, pts_col
    
    @timebudget
    def build_position_over_time_df(self, display: bool = False):
        """ Assigns self.position_over_time a dataframe containing data about the 
            team's past and present league positions at each matchday played this 
            season.
            
            Rows: the 20 teams participating in the current season, ordered ascending
                by row team name
            Columns (multi-index):
            -----------------------------------------------------
            |                 [Matchday Number]                 |
            -----------------------------------------------------
            | Score | HomeAway | Date | GDs | Points | Position |
            
            [Matchday Number]: integers from 1 to the most recent matchday
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
        print('🔨 Building position over time dataframe... ')
        
        # Check for dependencies
        if not self.fixtures:
            raise ValueError('❌ [ERROR] Cannot build position over time dataframe: Fixtures dataframe not available')
        if not self.standings:
            raise ValueError('❌ [ERROR] Cannot build position over time dataframe: Standings dataframe not available')
                
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
        
        matchday_nos = sorted(list(score.columns.get_level_values(0)))
        # Remove 'Matchday' prefix and just store sorted integers
        for idx, matchday_no in enumerate(matchday_nos):
            gd_col, pts_col = self.goal_diff_and_pts_cols(matchday_no, matchday_nos, idx, position_over_time)
            position_over_time[matchday_no, 'GD'] = gd_col
            position_over_time[matchday_no, 'Points'] = pts_col
            
            position_over_time.sort_values(by=[(matchday_no, 'Points'), (matchday_no, 'GD')], ascending=False, inplace=True)
            # If on the last and most recent column, ensure matchday positions is 
            # exactly the same order as from API standings data 
            if idx == no_cols - 1:
                # Reorder to the order as standings data
                position_over_time = position_over_time.reindex(self.standings.df.index)

            position_over_time[matchday_no, 'Position'] = np.arange(1, 21)
               
        position_over_time = position_over_time.reindex(sorted(position_over_time.columns.values), axis=1)
        position_over_time.columns.names = ["Matchday", None] 
                
        if display:
            print(position_over_time)
            
        self.position_over_time = PositionOverTime(position_over_time)
    
    
    
    
    
    # ---------------------- HOME ADVANTAGES DATAFRAME -------------------------
    
    def home_advantages_for_season(self, d: dict, data: json, season: int):
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')
            
            # Initialise dictionary if needed
            for team in (home_team, away_team):
                if team not in d.keys():
                    d[team] = {(season, 'Home', 'Wins'): 0, 
                               (season, 'Home', 'Draws'): 0,
                               (season, 'Home', 'Loses'): 0,
                               (season, 'Away', 'Wins'): 0,
                               (season, 'Away', 'Draws'): 0,
                               (season, 'Away', 'Loses'): 0}
                elif (season, 'Home', 'Wins') not in d[team].keys():
                    d[team].update({(season, 'Home', 'Wins'): 0, 
                                    (season, 'Home', 'Draws'): 0,
                                    (season, 'Home', 'Loses'): 0,
                                    (season, 'Away', 'Wins'): 0,
                                    (season, 'Away', 'Draws'): 0,
                                    (season, 'Away', 'Loses'): 0})
                        
            if match['score']['winner'] != None:
                if match['score']['fullTime']['homeTeam'] > match['score']['fullTime']['awayTeam']:
                    # Home team wins
                    d[home_team][(season, 'Home', 'Wins')] += 1
                    d[away_team][(season, 'Away', 'Loses')] += 1
                elif match['score']['fullTime']['homeTeam'] < match['score']['fullTime']['awayTeam']:
                    # Away team wins
                    d[home_team][(season, 'Home', 'Loses')] += 1
                    d[away_team][(season, 'Away', 'Wins')] += 1
                else:  # Draw
                    d[home_team][(season, 'Home', 'Draws')] += 1
                    d[away_team][(season, 'Away', 'Draws')] += 1

    def create_season_home_advantage_col(self, home_advantages, season):
        played_at_home = home_advantages[season]['Home']['Wins'] \
                       + home_advantages[season]['Home']['Draws'] \
                       + home_advantages[season]['Home']['Loses']
        home_advantages[season, 'Home', 'Played'] = played_at_home
        
        played = played_at_home \
               + home_advantages[season]['Away']['Wins'] \
               + home_advantages[season]['Away']['Draws'] \
               + home_advantages[season]['Away']['Loses']
        home_advantages[season, 'Overall', 'Played'] = played

        # Percentage wins = total wins / total games played
        win_ratio = (home_advantages[season]['Home']['Wins'] 
                    + home_advantages[season]['Away']['Wins']) \
                    / played
        home_advantages[season, 'Overall', 'WinRatio'] = win_ratio
        
        # Percentage wins at home = total wins at home / total games played at home 
        win_ratio_at_home = home_advantages[season]['Home']['Wins'] / played_at_home
        home_advantages[season, 'Home', 'WinRatio'] = win_ratio_at_home
        
        home_advantage = win_ratio_at_home - win_ratio
        # Home advantage = percentage wins at home - percentage wins 
        home_advantages[season, 'HomeAdvantage', ''] = home_advantage
    
    def create_total_home_advantage_col(self, home_advantages):
        home_advantages_cols = home_advantages.iloc[:, home_advantages.columns.get_level_values(1)=='HomeAdvantage']
        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[self.season]['Home']['Played']<= self.home_games_threshold).all():
            print(f"Current season excluded from home advantages calculation: all teams must have played {self.home_games_threshold} home games.")
            # Drop this current seasons column (start from previous season)
            home_advantages_cols = home_advantages_cols.iloc[:, 1:]
        
        home_advantages = home_advantages.sort_index(axis=1)
        home_advantages['TotalHomeAdvantage'] = home_advantages_cols.mean(axis=1).fillna(0)
        home_advantages = home_advantages.sort_values(by='TotalHomeAdvantage', ascending=False)
        return home_advantages
        
    @timebudget
    def build_home_advantages_df(self, no_seasons: int = 3, display: bool = False):
        """ Assigns self.home_advantages to a dataframe containing team's home 
            advantage information for each season with a final column for 
            combined total home advantage values.
            
            Rows: the 20 teams participating in the current season, ordered descending 
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------------------------------------------
            |                                 [SEASON YEAR]                                           | Total Home Advantage |
            ------------------------------------------------------------------------------------------|                      |
            |         Home         |         Away         |  Played  |  Home Wins Ratio  | Wins Ratio |                      |
            ----------------------------------------------|          |                   |            |                      |
            | Draws | Loses | Wins | Draws | Loses | Wins |          |                   |            |                      |
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago
            Draws: the total [home/away] games drawn this season
            Loses: the total [home/away] games lost this season
            Wins: the total [home/away] games won this season
            Played: the number of games played in the season
            Home Wins Ratio: the win ratio of all games played at home in the season
            Wins Ratio: the win ratio of all games played in the season
            Total Home Advantage: combined home advantages value from all seasons 
               in the table: the average home wins ratio / wins ratio
                
        Args:
            no_seasons (int, optional): number of seasons to include. 
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building home advantages dataframe... ')

        d = {}
        for i in range(no_seasons):
            data = self.json_data['fixtures'][self.season-i]
            self.home_advantages_for_season(d, data, self.season-i)
        
        home_advantages = pd.DataFrame.from_dict(d, orient='index')
        # Drop teams from previous seasons
        home_advantages = home_advantages.dropna(subset=home_advantages.loc[[], [self.season]].columns)
        home_advantages = home_advantages.fillna(0).astype(int)

        # Calculate home advantages for each season
        for i in range(no_seasons):
            self.create_season_home_advantage_col(home_advantages, self.season-i)
        
        # Create the final overall home advantage value for each team
        home_advantages = self.create_total_home_advantage_col(home_advantages)
        home_advantages.index.name = "Team"
        
        if display:
            print(home_advantages)
        
        self.home_advantages = HomeAdvantages(home_advantages)










    # ------------------------- FIXTURES DATAFRAME -----------------------------
    
    @timebudget
    def build_fixtures_df(self, display: bool = False):        
        """ Sets self.fixtures to a dataframe containing the past and future 
            fixtures for the current season (matchday 1 to 38).
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ---------------------------------------------
            |             Matchday Number]              |
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
        """
        print('🔨 Building fixtures dataframe... ')
        
        data = self.json_data['fixtures'][self.season]
                
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
            matchday[(match["matchday"], 'Date')].append(datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"))
            matchday[(match["matchday"], 'HomeAway')].append('Home')
            matchday[(match["matchday"], 'Team')].append(match['awayTeam']['name'].replace('&', 'and'))
            matchday[(match["matchday"], 'Status')].append(match['status']),
            matchday[(match["matchday"], 'Score')].append(f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}")
            team_names.append(match['homeTeam']['name'].replace('&', 'and'))
            # Away team row
            matchday[(match["matchday"], 'Date')].append(datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"))
            matchday[(match["matchday"], 'HomeAway')].append('Away')
            matchday[(match["matchday"], 'Team')].append(match['homeTeam']['name'].replace('&', 'and'))
            matchday[(match["matchday"], 'Status')].append(match['status']),
            matchday[(match["matchday"], 'Score')].append(f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}")
            team_names.append(match['awayTeam']['name'].replace('&', 'and'))
        
        # Add last matchday (38) dataframe to list
        df_matchday = pd.DataFrame(matchday)
        df_matchday.index = team_names
        matchdays.append(df_matchday)
        
        fixtures = pd.concat(matchdays, axis=1)
        fixtures.index = team_names_index
        
        fixtures.columns.names = ["Matchday", None]
        
                
        if display:
            print(fixtures)
        
        self.fixtures = Fixtures(fixtures)




    # ----------- Team ratings dataframe -----------
    
    def calc_rating(self, position: int, points: int, gd: int) -> float:
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points
        return rating
    
    def get_season_weightings(self, n_seasons: int) -> List[float]:
        weights = [0.75, 0.20, 0.05]
        weights = np.array(weights[:n_seasons])
        # Normalise list
        weights = list(weights / sum(weights))
        return weights

    def calc_total_rating_col(self, team_ratings, n_seasons, include_current_season):
        # Calculate total rating column
        team_ratings['TotalRating'] = 0
        if include_current_season:
            start_n = 0  # Include current season when calculating total rating
            w = self.get_season_weightings(n_seasons) # Column weights
        else:
            start_n = 1  # Exclude current season when calculating total rating
            w = self.get_season_weightings(n_seasons-1) # Column weights

        for n in range(start_n, n_seasons):
            team_ratings['TotalRating'] += w[n-start_n] * team_ratings[f'NormalisedRating{n}YAgo']
    
    @timebudget
    def build_team_ratings_df(self, n_seasons: int, display: bool = False):
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
        print('🔨 Building team ratings dataframe... ')
        
        # Check for dependencies
        if not self.standings:
            raise ValueError('❌ [ERROR] Cannot build team ratings datafram: Standings dataframe not available')
        
        # Add current season team names to the object team dataframe
        team_ratings = pd.DataFrame(index=self.standings.df.index)

        # Create column for each included season
        for n in range(0, n_seasons):
            team_ratings[f'Rating{n}YAgo'] = np.nan
                
        # Insert rating values for each row
        for team_name, row in self.standings.df.iterrows():
            for n in range(n_seasons):
                rating = self.calc_rating(row[self.season-n]['Position'], row[self.season-n]['Points'], row[self.season-n]['GD'])
                team_ratings.loc[team_name, f'Rating{n}YAgo'] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in team_ratings.columns:
            team_ratings[col].replace(np.nan, team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for n in range(0, n_seasons):
            team_ratings[f'NormalisedRating{n}YAgo'] = (team_ratings[f'Rating{n}YAgo']
                                                      - team_ratings[f'Rating{n}YAgo'].min()) \
                                                     / (team_ratings[f'Rating{n}YAgo'].max() 
                                                      - team_ratings[f'Rating{n}YAgo'].min())

        # Check whether current season data should be included in each team's total rating
        if (self.standings.df[self.season]['Played'] <= self.games_threshold).all():  # If current season hasn't played enough games
            print(f"Current season excluded from team ratings calculation: all teams must have played {self.games_threshold} games.")
            include_current_season = False
        else:
            include_current_season = True

        self.calc_total_rating_col(team_ratings, n_seasons, include_current_season)

        team_ratings = team_ratings.sort_values(by="TotalRating", ascending=False)
        team_ratings = team_ratings.rename(columns={'Rating0YAgo': 'RatingCurrent', 'NormalisedRating0YAgo': 'NormalisedRatingCurrent'})
        team_ratings = TeamRatings(team_ratings)
        
        if display:
            print(team_ratings)
        
        self.team_ratings = team_ratings
    
    
    
    
    # ------------ LOGO URLS ---------------
    
    def build_logo_urls(self):
        data = self.json_data['standings'][self.season]

        logo_urls = {}
        for standings_row in data:
            team_name = standings_row['team']['name'].replace('&', 'and')
            crest_url = standings_row['team']['crestUrl']
            logo_urls[team_name] = crest_url
        
        self.logo_urls = logo_urls
        self.team_names = logo_urls.keys()
    
    
    
        
    # ------------------------ NEXT GAMES DATAFRAME ----------------------------
    
    def get_next_game(self, team_name: str, fixtures: Fixtures) -> Tuple[int, str, str, str]:
        date, next_team, home_away = None, None, None

        # Scan through list of fixtures to find the first that is 'scheduled'
        for matchday_no in fixtures.df.columns.unique(level=0):
            if fixtures.df[matchday_no, 'Status'].loc[team_name] == 'SCHEDULED':
                date = fixtures.df.loc[team_name][matchday_no, 'Date']
                next_team = fixtures.df.loc[team_name][matchday_no, 'Team']
                home_away = fixtures.df.loc[team_name][matchday_no, 'HomeAway']
                break
        return matchday_no, date, next_team, home_away
    
    def game_result_tuple(self, match) -> Tuple[str, str]:
        home_score = match['score']['fullTime']['homeTeam']
        away_score = match['score']['fullTime']['awayTeam']
        if home_score == away_score:
            result = ('Drew', 'Drew')
        elif home_score > away_score:
            result = ('Won', 'Lost')
        else:
            result = ('Lost', 'Won')
        return result
                    
    def append_prev_meeting(self, next_games: NextGames, home_team: str, away_team: str, date: datetime, result: Tuple[str, str], match: dict):
        # From the perspective from the home team
        # If this match's home team has their next game against this match's away team
        if next_games[home_team]['NextTeam'] == away_team:
            # Append to previous meetings list 
            next_games[home_team]['PreviousMeetings'].append([date, home_team, away_team, match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'], result[0]])
        if next_games[away_team]['NextTeam'] == home_team:
            next_games[away_team]['PreviousMeetings'].append([date, home_team, away_team, match['score']['fullTime']['homeTeam'], match['score']['fullTime']['awayTeam'], result[1]])
    
    def readable_date(self, date):
        return datetime.strptime(date[:10], "%Y-%m-%d").date().strftime('%d %B %Y')
    
    def convert_to_readable_dates(self, next_games: DataFrame):
        for _, row in next_games.items():
            for i in range(len(row['PreviousMeetings'])):
                row['PreviousMeetings'][i][0] =  self.readable_date(row['PreviousMeetings'][i][0])
                
    def sort_prev_meetings_by_date(self, next_games: DataFrame):
        for _, row in next_games.items():
            row['PreviousMeetings'] = sorted(row['PreviousMeetings'], key=lambda x: x[0], reverse=True)
    
    def append_season_prev_meetings(self, season: int, next_games: NextGames):
        data = self.json_data['fixtures'][season]
            
        for match in data:
            if match['status'] == 'FINISHED':
                home_team = match['homeTeam']['name'].replace('&', 'and')
                away_team = match['awayTeam']['name'].replace('&', 'and')
                
                if home_team in self.team_names and away_team in self.team_names:
                    result = self.game_result_tuple(match)
                    self.append_prev_meeting(next_games, home_team, away_team, match['utcDate'], result, match)
    
    @timebudget
    def build_next_games_df(self, n_seasons: int = 3, display: bool = False):
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
            n_seasons (int, optional): number of seasons to include.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        
        print('🔨 Building next games dataframe... ')

        
        next_games = {}
        
        for team_name in self.team_names:
            _, date, next_team, home_away = self.get_next_game(team_name, self.fixtures)
            next_games[team_name] = {'Date': date, 'NextTeam': next_team, 'HomeAway': home_away, 'PreviousMeetings': []}
        
        for i in range(n_seasons):
            self.append_season_prev_meetings(self.season-i, next_games)

        # Format previous meeting dates as long, readable str
        self.sort_prev_meetings_by_date(next_games)
        self.convert_to_readable_dates(next_games)
                
        next_games = pd.DataFrame.from_dict(next_games, orient='index')
        
        if display:
            print(next_games)
        
        self.next_games = NextGames(next_games)
        

    


    # ----------- SEASON STATS -----------
    
    def str_score_to_int_score(self, score: str) -> Tuple[int, int]:
        home, _ , away = score.split(' ')
        return int(home), int(away)

    def row_season_goals(self, row: pd.Series, matchdays: List[str]):
        n_games, clean_sheets, goals_scored, goals_conceded = 0, 0, 0, 0
        
        for matchday in matchdays:
            match = row[matchday]
            if type(match['Score']) is str:
                home, away = self.str_score_to_int_score(match['Score'])

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
        
        return n_games, clean_sheets, goals_scored, goals_conceded


    @timebudget
    def build_season_stats_df(self, display: bool = False) -> dict:
        print('🔨 Building season stats dataframe... ')

        
        matchdays = list(self.position_over_time.df.columns.unique(level=0))
        
        season_stats = {'CleanSheetRatio': {},
                        'GoalsPerGame': {},
                        'ConcededPerGame': {}}
        for team_name, row in self.position_over_time.df.iterrows():
            n_games, clean_sheets, goals_scored, goals_conceded = self.row_season_goals(row, matchdays)
            
            if n_games > 0:
                season_stats['CleanSheetRatio'][team_name] = round(clean_sheets / n_games, 2)
                season_stats['GoalsPerGame'][team_name] = round(goals_scored / n_games, 2)
                season_stats['ConcededPerGame'][team_name] = round(goals_conceded / n_games, 2)
            else:
                season_stats['CleanSheetRatio'][team_name] = 0
                season_stats['GoalsPerGame'][team_name] = 0
                season_stats['ConcededPerGame'][team_name] = 0
        
        season_stats = pd.DataFrame.from_dict(season_stats)
        
        if display:
            print(season_stats)
        
        self.season_stats = SeasonStats(season_stats)

    
    def build_dfs(self, n_seasons: int = 3, display_tables: bool = False, request_new: bool = True):
        # Standings for the last [n_seasons] seasons
        self.build_standings_df(n_seasons, display=display_tables)
        # Fixtures for the whole season for each team
        self.build_fixtures_df(display=display_tables)
        # Ratings for each team, based on last [no_seasons] seasons standings table
        self.build_team_ratings_df(n_seasons, display=display_tables)
        # Calculated values to represent the personalised advantage each team has at home
        self.build_home_advantages_df(n_seasons, display=display_tables)
        # Calculated form values for each team for each matchday played so far
        self.build_form_df(display=display_tables)
        # Snapshots of a teams table position and match results for each matchday played so far 
        self.build_position_over_time_df(display=display_tables)
        # Data about the opponent in each team's next game 
        self.build_next_games_df(n_seasons, display=display_tables)
        # Season metrics
        self.build_season_stats_df(display=display_tables)
    
    
    @timebudget
    def update_all(self, n_seasons: int = 3, team_name: str = None, display_tables: bool = False, display_graphs: bool = False, request_new: bool = True):
        try:
            # Fetch data
            self.fetch_data(n_seasons, request_new)
        except ValueError as e:
            print(e)
            print('🔄 Retrying with saved data...')
            self.fetch_data(n_seasons, False)
        
        self.build_logo_urls()  # Record team names and urls of team logos
        self.build_dfs(n_seasons, display_tables)
        self.predictor.update_predictions(self.fixtures, self.form, self.next_games, self.home_advantages)
        
        # Save any new data to json files
        if self.json_data:
            print('💾 Saving new data...')
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
    data.update_all(request_new=True, team_name='Liverpool FC', display_tables=True)

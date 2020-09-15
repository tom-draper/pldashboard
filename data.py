from gen_data_vis import GenDataVis
import pandas as pd
import numpy as np
import requests
import json
import pprint
from datetime import datetime


class Data:
    url = "https://api.football-data.org/v2/"
    api = "f6cead2f1c47791235586c2887a3e624599b62862b339749cfc0b10fcc83167c"
    headers = {'X-Auth-Token': 'cb159edc83824c21b6704e7ca18c2920'}

    def __init__(self, current_season):
        self.season = current_season
        
        # Number of games played in a season for season data to be used
        self.games_threshold = 0
                
        # List of current season teams, updated when updating standings 
        self.team_names = None  
        
        self.fixtures = pd.DataFrame()
        self.standings = pd.DataFrame()
        self.team_ratings = pd.DataFrame()
        self.home_advantages = pd.DataFrame()
    
    
    
    # ---------- Home Advantage Data ------------
    
    def getHomeAdvantages(self, no_seasons, display=False, request_new=True):
        print("Creating home advantages dataframe...")
        
        home_advantages = pd.DataFrame()
        
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

            df = pd.DataFrame(d).T
            df.index.name = "Team"
            df = df[df.index.isin(self.team_names)]
            home_advantages = pd.concat([home_advantages, df], axis=1)
            # home_advantages = home_advantages.join(df, how="outer")
        
        # Clean up
        home_advantages.fillna(0, inplace=True)
        home_advantages = home_advantages.astype(int)
        
        
        # Create home advantage column
        for i in range(no_seasons):
            home_advantages[f'{self.season-i}', 'Played'] = home_advantages[f'{self.season-i}']['Home Wins'] + home_advantages[f'{self.season-i}']['Home Draws'] + home_advantages[f'{self.season-i}']['Home Loses'] + home_advantages[f'{self.season-i}']['Away Wins'] + home_advantages[f'{self.season-i}']['Away Draws'] + home_advantages[f'{self.season-i}']['Away Loses']
            home_advantages[f'{self.season-i}', 'Played at Home'] = home_advantages[f'{self.season-i}']['Home Wins'] + home_advantages[f'{self.season-i}']['Home Draws'] + home_advantages[f'{self.season-i}']['Home Loses']
            # Wins / Total Games Played
            home_advantages[f'{self.season-i}', 'Wins %'] = (home_advantages[f'{self.season-i}']['Home Wins'] + home_advantages[f'{self.season-i}']['Away Wins']) / home_advantages[f'{self.season-i}']['Played']
            # Wins at Home / Total Games Played at Home 
            home_advantages[f'{self.season-i}', 'Home Wins %'] = home_advantages[f'{self.season-i}']['Home Wins'] / home_advantages[f'{self.season-i}']['Played at Home']
            home_advantages[f'{self.season-i}', 'Home Advantage'] = home_advantages[f'{self.season-i}']['Home Wins %'] - home_advantages[f'{self.season-i}']['Wins %']
        
        home_advantages = home_advantages.sort_index(axis=1)

        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[f'{self.season}']['Played at Home'] <= self.games_threshold).all():
            print("Current season excluded from home advantages calculation -> haven't played enough games.")
            start_n = 1  # Start from previous season
        else:
            start_n = 0  # Include current season
            
        # List of all home advantege column names that will be used to calculate final column
        home_advantages['Total Home Advantage'] = home_advantages.iloc[:, home_advantages.columns.get_level_values(1)=='Home Advantage'].mean(axis=1).fillna(0)
        home_advantages.sort_values(by='Total Home Advantage', ascending=False, inplace=True)
        home_advantages.index.name = "Team"
        
        if display:
            print(home_advantages)

        return home_advantages



    # ---------- Standings Data ------------

    def standingsData(self, season, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season), 
                                    headers=self.headers)
            print("Code:", response.status_code)
            response = response.json()['standings'][0]['table']
            
            with open(f'data/standings_{season}.json', 'w') as json_file:
                json.dump(response, json_file)
                
            return response
        else:
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def getStandings(self, no_seasons, display=False, request_new=True):
        """Get the Premier League table standings from the last specified number of 
           seasons. Compile each of these standings into a single dataframe to return.
           Dataframe contains only teams that are members of the current season.

        Args:
            no_seasons (int): number of previous seasons to fetch and include. 

        Returns:
            DataFrame: dataframe containing all standings.
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
            df.drop(columns=['Team'], level=1, inplace=True)
            
            if i == 0:  # If building current season table
                standings = standings.append(df)
                self.team_names = team_names
            else:
                # Drop team rows that are no longer in the current season
                df.drop(df[~df.index.isin(standings.index)].index, inplace=True)
                # Drop the Form column from previous seasons
                df.drop(columns=['Form'], level=1, inplace=True)
                # Add season standings to main standings dataframe 
                standings = pd.concat([standings, df], axis=1)
                # standings = standings.merge(df, on=f"({self.season-i+1}, Team)", how="outer")
            
        standings.index.name = "Team"
        # Sort by position in most recent season
        # standings.sort_values(by=([f'Position {self.season-i}' for i in range(no_seasons)]), 
        #                                inplace=True)
        
        if display:
            print(standings)
            
        return standings



    # ------------ Fixtures Data -------------

    def fixturesData(self, season, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season),
                                        headers=self.headers)
            print("Code:", response.status_code)
            response = response.json()['matches']
            
            # Save new data
            with open(f'data/fixtures_{season}.json', 'w') as json_file:
                json.dump(response, json_file)
            
            return response
        else:
            with open(f'data/fixtures_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def getFixtures(self, display=False, request_new=True):
        print("Creating fixtures dataframe...")
        data = self.fixturesData(self.season, request_new=request_new)
        
        fixtures = pd.DataFrame()
        
        d = {}
        matchday = pd.DataFrame()
        prev_match_matchday = 1
        for match in data:
            df_home = {(f'Matchday {match["matchday"]}', 'Date'): datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"),
                       (f'Matchday {match["matchday"]}', 'HomeAway'): 'Home',
                       (f'Matchday {match["matchday"]}', 'Team'): match['awayTeam']['name'].replace('&', 'and'),
                       (f'Matchday {match["matchday"]}', 'Status'): match['status'],
                       (f'Matchday {match["matchday"]}', 'Score'): f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}",}
            df_away = {(f'Matchday {match["matchday"]}', 'Date'): datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"),
                       (f'Matchday {match["matchday"]}', 'HomeAway'): 'Away',
                       (f'Matchday {match["matchday"]}', 'Team'): match['homeTeam']['name'].replace('&', 'and'),
                       (f'Matchday {match["matchday"]}', 'Status'): match['status'],
                       (f'Matchday {match["matchday"]}', 'Score'): f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}",}
            
            # If moved on to next matchday, reset matchday dataframe
            if prev_match_matchday < match['matchday']:
                fixtures = pd.concat([fixtures, matchday], axis=1)
                matchday = pd.DataFrame()
                prev_match_matchday = match['matchday']

            home_row = pd.Series(data=df_home, name=match['homeTeam']['name'].replace('&', 'and'))
            away_row = pd.Series(data=df_away, name=match['awayTeam']['name'].replace('&', 'and'))
            matchday = matchday.append([home_row, away_row])
                
        if display:
            print(fixtures)
            
        return fixtures
                   



    # ----------- Team Ratings Data -----------
    
    def calcRating(self, position, points, gd):
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points
        return rating
    
    def getSeasonWeightings(self, no_seasons):
        weights = [0.7, 0.25, 0.05]
        weights = np.array(weights[:no_seasons])
        # Normalise list
        weights = list(weights / sum(weights))
        return weights
        
    
    def getTeamRatings(self, no_seasons, standings, display=False):
        print("Creating team ratings dataframe...")
        # If standings table not calculated, calculate
        if standings.empty:
            standings = self.getStandings(no_seasons)
        
        # Add current season team names to the object team dataframe
        team_ratings = pd.DataFrame(index=standings.index)

        # Create column for each included season
        for i in range(0, no_seasons):
            team_ratings[f'Rating {i}Y Ago'] = np.nan
                
        # Insert rating values for each row
        for team_name, row in standings.iterrows():
            for i in range(no_seasons):
                rating = self.calcRating(row[f'{self.season-i}']['Position'], row[f'{self.season-i}']['Points'], row[f'{self.season-i}']['GD'])
                team_ratings.loc[team_name, 'Rating {}Y Ago'.format(i)] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in team_ratings.columns:
            team_ratings[col].replace(np.nan, team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for i in range(0, no_seasons):
            team_ratings[f'Normalised Rating {i}Y Ago'] = (team_ratings[f'Rating {i}Y Ago'] - team_ratings[f'Rating {i}Y Ago'].min()) / (team_ratings[f'Rating {i}Y Ago'].max() - team_ratings[f'Rating {i}Y Ago'].min())

        # Check whether current season data should be included in each team's total rating
        if (standings[f'{self.season}']['Played'] <= self.games_threshold).all():  # If current season hasn't played enough games
            print("Current season excluded from team ratings calculation -> haven't played enough games.")
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

        # Tidy dataframe
        team_ratings.sort_values(by="Total Rating", ascending=False, inplace=True)
        team_ratings.rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'}, inplace=True)
        
        if display:
            print(team_ratings)
            
        return team_ratings
        
    
    
    
    # ----------- Update Plotly Graph HTML Files ------------    
    
    def updateFixtures(self, no_seasons, standings, fixtures, team_ratings, home_advantages, display=False, team=None):
        # If required tables not calculated, calculate
        if standings.empty:
            standings = self.getStandings(no_seasons)
        if fixtures.empty:
            fixtures = self.getFixtures()
        if team_ratings.empty:
            team_ratings = self.getTeamRatings(no_seasons, standings)
        if home_advantages.empty:
            home_advantages = self.getHomeAdvantages(no_seasons)

        # Input team rating dataframe to grade upcoming fixtures
        gdv = GenDataVis()
        if team == None:
            print("Updating all team fixtures graphs...")
            for team_name in self.standings.index.values.tolist():
                gdv.genFixturesGraph(team_name, fixtures, team_ratings, home_advantages, display=display)
        else:
            print(f"Updating all {team} fixture graph...")
            gdv.genFixturesGraph(team, fixtures, team_ratings, home_advantages, display=display)
    
    def updateAll(self, no_seasons, team=None, display_tables=False, display_graphs=False, request_new=True):
        """Update all graph files at once.

        Args:
            no_seasons (int): number of seasons of data to include.
        """
        # ------ Update Dataframes -------
        # Standings for the last "n_seasons" seasons
        self.standings = self.getStandings(no_seasons, display=display_tables, request_new=request_new)
        # Fixtures for each team
        self.fixtures = self.getFixtures(display=display_tables, request_new=request_new)

        # Ratings for each team, based on last "no_seasons" seasons standings table
        self.team_ratings = self.getTeamRatings(no_seasons, self.standings, display=display_tables)

        self.home_advantages = self.getHomeAdvantages(no_seasons, display=display_tables, request_new=request_new)

        # ----- Update Graphs ------
        self.updateFixtures(no_seasons, self.standings, self.fixtures, self.team_ratings, self.home_advantages, display=display_graphs, team=team)




if __name__ == "__main__":
    data = Data(2020)
    
    data.updateAll(3, team='Liverpool FC', display_tables=True, display_graphs=True, request_new=False)


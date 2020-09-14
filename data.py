from gen_data_vis import GenDataVis
import pandas as pd
import numpy as np
import requests
import json
import pprint
import datetime


class Data:
    url = "https://api.football-data.org/v2/"
    api = "f6cead2f1c47791235586c2887a3e624599b62862b339749cfc0b10fcc83167c"
    headers = {'X-Auth-Token': 'cb159edc83824c21b6704e7ca18c2920'}

    def __init__(self, current_season):
        self.season = current_season
        
        # List of current season teams, updated when updating standings 
        self.team_names = None  
        
        self.fixtures = pd.DataFrame()
        self.standings = pd.DataFrame()
        self.team_ratings = pd.DataFrame()
        self.home_advantages = pd.DataFrame()
    
    
    
    # ---------- Home Advantage Data ------------
    
    def getHomeAdvantages(self, no_seasons, display=True, request_new=True):
        print("Creating home advantages dataframe...")
        
        home_advantages = pd.DataFrame()
        
        for i in range(no_seasons):
            data = self.fixturesData(self.season-i, request_new=request_new)
            
            d = {}
            for match in data:
                if match['homeTeam']['name'] not in d.keys():
                    d[match['homeTeam']['name']] = {f'Home Wins {self.season-i}': 0, 
                                                    f'Home Draws {self.season-i}': 0,
                                                    f'Home Loses {self.season-i}': 0,
                                                    f'Away Wins {self.season-i}': 0,
                                                    f'Away Draws {self.season-i}': 0,
                                                    f'Away Loses {self.season-i}': 0}                
                if match['awayTeam']['name'] not in d.keys():
                    d[match['awayTeam']['name']] = {f'Home Wins {self.season-i}': 0, 
                                                    f'Home Draws {self.season-i}': 0,
                                                    f'Home Loses {self.season-i}': 0,
                                                    f'Away Wins {self.season-i}': 0,
                                                    f'Away Draws {self.season-i}': 0,
                                                    f'Away Loses {self.season-i}': 0}
                
                if match['score']['winner'] != None:
                    if match['score']['fullTime']['homeTeam'] > match['score']['fullTime']['awayTeam']:
                        # Home team wins
                        d[match['homeTeam']['name']][f'Home Wins {self.season-i}'] += 1
                        d[match['awayTeam']['name']][f'Away Loses {self.season-i}'] += 1
                    elif match['score']['fullTime']['homeTeam'] < match['score']['fullTime']['awayTeam']:
                        # Away team wins
                        d[match['homeTeam']['name']][f'Home Loses {self.season-i}'] += 1
                        d[match['awayTeam']['name']][f'Away Wins {self.season-i}'] += 1
                    else:  # Draw
                        d[match['homeTeam']['name']][f'Home Draws {self.season-i}'] += 1
                        d[match['awayTeam']['name']][f'Away Draws {self.season-i}'] += 1
                        
            df = pd.DataFrame(d).T
            df.index.name = "Team"
            df = df[df.index.isin(self.team_names)]
            home_advantages = home_advantages.join(df, how="outer")
        
        # Clean up
        home_advantages.fillna(0, inplace=True)
        home_advantages = home_advantages.astype(int)
        
        # Create home advantage column
        for i in range(no_seasons):
            # Wins / Total Games Played
            home_advantages[f'Wins {self.season-i} %'] = (home_advantages[f'Home Wins {self.season-i}'] + home_advantages[f'Away Wins {self.season-i}']) / (home_advantages[f'Home Wins {self.season-i}'] + home_advantages[f'Home Draws {self.season-i}'] + home_advantages[f'Home Loses {self.season-i}'] + home_advantages[f'Away Wins {self.season-i}'] + home_advantages[f'Away Draws {self.season-i}'] + home_advantages[f'Away Loses {self.season-i}'])
            # Wins at Home / Total Games Played at Home 
            home_advantages[f'Home Wins {self.season-i} %'] = home_advantages[f'Home Wins {self.season-i}'] / (home_advantages[f'Home Wins {self.season-i}'] + home_advantages[f'Home Draws {self.season-i}'] + home_advantages[f'Home Loses {self.season-i}'])
            home_advantages[f'Home Advantage {self.season-i}'] = home_advantages[f'Home Wins {self.season-i} %'] - home_advantages[f'Wins {self.season-i} %']

        
        home_advantage_cols = [f"Home Advantage {self.season-i}" for i in range(1, no_seasons)]
        home_advantages['Home Advantage'] = home_advantages[home_advantage_cols].mean(axis=1)
        
        
        home_advantages.sort_values(by='Home Advantage', inplace=True)

        home_advantages['Home Advantage'].fillna(0, inplace=True)
        
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

    def getStandings(self, no_seasons, display=True, request_new=True):
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
            team_names = pd.Series([df['team'][x]['name'] for x in range(len(df))])
            df['team'] = team_names
            
            if i == 0:
                self.team_names = team_names


            # Rename columns to standardised names
            df.rename(columns={'position': f'Position {self.season-i}', 
                               'team': 'Team',
                               'playedGames': f'Played {self.season-i}', 
                               'form': f'Form {self.season-i}',
                               'won': f'Won {self.season-i}',
                               'draw': f'Draw {self.season-i}',
                               'lost': f'Lost {self.season-i}',
                               'points': f'Points {self.season-i}', 
                               'goalsFor': f'GF {self.season-i}',
                               'goalsAgainst': f'GA {self.season-i}', 
                               'goalDifference': f'GD {self.season-i}'}, 
                      inplace=True)

            

            if i == 0:
                standings = standings.append(df)
            else:
                # Drop teams that are no longer in the current season
                df.drop(standings[~df['Team'].isin(standings.head(20)['Team'])].index, inplace=True)
                
                standings = standings.merge(df, on='Team', how="outer")
            
        standings.set_index("Team", inplace=True)
        # Sort by position in most recent season
        standings.sort_values(by=([f'Position {self.season-i}' for i in range(no_seasons)]), 
                                       inplace=True)
        
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

    def getFixtures(self, display=True, request_new=True):
        print("Creating fixtures dataframe...")
        data = self.fixturesData(self.season, request_new=request_new)
        
        d = {}
        for match in data:
            home_game = {'Matchday': match['matchday'],
                         'Date': datetime.datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"),
                         'HomeAway': 'Home',
                         'Team': match['awayTeam']['name'],
                         'Status': match['status'],
                         'Score': match['score']['fullTime']}
            away_game = {'Matchday': match['matchday'],
                         'Date': datetime.datetime.strptime(match['utcDate'][:10], "%Y-%m-%d"),
                         'HomeAway': 'Away',
                         'Team': match['homeTeam']['name'],
                         'Status': match['status'],
                         'Score': match['score']['fullTime']}
            
            if match['homeTeam']['name'] not in d.keys():
                d[match['homeTeam']['name']] = []
            d[match['homeTeam']['name']].append(home_game)
            if match['awayTeam']['name'] not in d.keys():
                d[match['awayTeam']['name']] = []
            d[match['awayTeam']['name']].append(away_game)
        
        fixtures = pd.DataFrame(d)
        fixtures.set_index(pd.Series([f"Matchday {i}" for i in range(1, fixtures.shape[0] + 1)]), inplace=True)
        # Transpose to give "Matchday n" as columns, and team names as indexes
        fixtures = fixtures.T
        fixtures.index.name = "Team"
        
        fixtures.sort_index(inplace=True)
        
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
    
    def getSeasonWeightings(self, no_seasons, current_weight=0.7):
        # TODO : generate list of appropriate size
        return [current_weight, 0.25, 0.05]
    
    def getTeamRatings(self, no_seasons, standings, display=True):
        print("Creating team ratings dataframe...")
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
                if i == 0 and (standings[f'Played {self.season}'] < 5).all():  # If current season hasn't played enough games
                    # Use previous seasons final positions
                    rating = (20 - row[f'Position {self.season-1}'])
                else:
                    rating = self.calcRating(row[f'Position {self.season-i}'], row[f'Points {self.season-i}'], row[f'GD {self.season-i}'])
                team_ratings.loc[team_name, 'Rating {}Y Ago'.format(i)] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in team_ratings.columns:
            team_ratings[col].replace(np.nan, team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for i in range(0, no_seasons):
            team_ratings[f'Normalised Rating {i}Y Ago'] = (team_ratings[f'Rating {i}Y Ago'] - team_ratings[f'Rating {i}Y Ago'].min()) / (team_ratings[f'Rating {i}Y Ago'].max() - team_ratings[f'Rating {i}Y Ago'].min())

        w = self.getSeasonWeightings(no_seasons) # Column weights
        team_ratings['Total Rating'] = 0
        for i in range(0, no_seasons):
            team_ratings['Total Rating'] += w[i] * team_ratings[f'Normalised Rating {i}Y Ago']

        team_ratings.sort_values(by="Total Rating", ascending=False, inplace=True)
        team_ratings.rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'}, inplace=True)
        
        if display:
            print(team_ratings)
            
        return team_ratings
        
    
    
    
    # ----------- Update Plotly Graph HTML Files ------------    
    
    def updateFixtures(self, no_seasons, standings, fixtures, team_ratings, home_advantages, display=False, team=None):
        print("Updating fixtures graph...")
        if standings.empty:
            standings = self.getStandings(no_seasons)
        if fixtures.empty:
            fixtures = self.getFixtures()
        if team_ratings.empty:
            team_ratings = self.getTeamRatings(no_seasons, standings)
        # if home_advantages.empty:
        #     home_advantages = self.getHomeAdvantages(no_seasons)

        # Input team rating dataframe to grade upcoming fixtures
        gdv = GenDataVis()
        if team == None:
            for team_name in self.standings.index.values.tolist():
                gdv.genFixturesGraph(team_name, fixtures, team_ratings, home_advantages, display=display)
        else:
            gdv.genFixturesGraph(team, fixtures, team_ratings, home_advantages, display=display)
    
    def updateAll(self, no_seasons, team=None, display=True, request_new=True):
        """Update all graph files at once.

        Args:
            no_seasons (int): number of seasons of data to include.
        """
        # ------ Update Dataframes -------
        # Standings for the last "n_seasons" seasons
        self.standings = self.getStandings(no_seasons, display=display, request_new=request_new)
        # Fixtures for each team
        self.fixtures = self.getFixtures(display=display, request_new=request_new)

        # Ratings for each team, based on last "no_seasons" seasons standings table
        self.team_ratings = self.getTeamRatings(no_seasons, self.standings, display=display)

        self.home_advantages = self.getHomeAdvantages(no_seasons, display=display, request_new=request_new)

        # ----- Update Graphs ------
        self.updateFixtures(no_seasons, self.standings, self.fixtures, self.team_ratings, self.home_advantages, display=display, team=team)




if __name__ == "__main__":
    data = Data(2020)
        
    data.updateAll(3, team=None, display=False, request_new=False)


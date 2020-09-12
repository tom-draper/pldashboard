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
        
        self.team_names = []
        
        self.standings = pd.DataFrame()
        self.fixtures = pd.DataFrame()
        self.team_ratings = pd.DataFrame()
        self.home_advantages = pd.DataFrame()
    
    
    
    # ---------- Home Advantage Data ------------
    
    def getHomeAdvantages(self, no_seasons):
        print("Creating home advantages dataframe...")
        home_advantages = pd.DataFrame()
        
        for i in range(no_seasons):
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(self.season-i), 
                                    headers=self.headers)
            print(response.status_code)
        
        
        # TODO : Caculate home advantage percentage for each team from last n seasons
        # https://help.smarkets.com/hc/en-gb/articles/115000647291-Why-you-should-consider-home-advantage-for-football-trading
        return home_advantages
        #return 0.492 - 0.287  # 0.205



    # ---------- Standings Data ------------

    def standingsData(self, season, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(season), 
                                    headers=self.headers)
            print(response.status_code)
            response = response.json()['standings'][0]['table']
            
            with open(f'data/standings_{season}.json', 'w') as json_file:
                json.dump(response, json_file)
                
            return response
        else:
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def getStandings(self, no_seasons):
        """Get the Premier League table standings from the last specified number of 
           seasons. Compile each of these standings into a single dataframe to return.
           Dataframe contains only teams that are members of the current season.

        Args:
            no_seasons (int): number of previous seasons to fetch and include. 

        Returns:
            DataFrame: dataframe containing all standings.
        """

        print("Creating standings dataframe...")
        standings = pd.DataFrame(columns=['Position', 'Team', 'Played', 
                                          'Form', 'Won', 'Draw', 'Lost', 
                                          'Points', 'GF', 'GA', 'GD'])

        # Loop from current season to the season 2 years ago
        for i in range(no_seasons):
            data = self.standingsData(self.season-i, request_new=False)
            # pprint.pprint(data)
            df = pd.DataFrame(data)

            # Rename teams to their team name
            team_names = pd.Series([df['team'][x]['name']
                                    for x in range(len(df))])
            df['team'] = team_names

            # Rename columns to standardised names
            df.rename(columns={'position': f'Position_{self.season-i}', 
                               'team': 'Team',
                               'playedGames': f'Played_{self.season-i}', 
                               'form': f'Form_{self.season-i}',
                               'won': f'Won_{self.season-i}',
                               'draw': f'Draw_{self.season-i}',
                               'lost': f'Lost_{self.season-i}',
                               'points': f'Points_{self.season-i}', 
                               'goalsFor': f'GF_{self.season-i}',
                               'goalsAgainst': f'GA_{self.season-i}', 
                               'goalDifference': f'GD_{self.season-i}'}, 
                      inplace=True)

            if i == 0:
                standings = standings.append(df)
            else:
                # Drop teams that are no longer in the current season
                df = df.drop(standings[~df['Team'].isin(standings.head(20)['Team'])].index)
                standings = df.merge(standings, on='Team', how="outer", 
                                              suffixes=(f"_{self.season-i}", None))
        
        # Sort by position in most recent season
        standings.sort_values(by=([f'Position_{self.season-i}' for i in range(no_seasons)]), 
                                       inplace=True)
        standings.reset_index(drop=True, inplace=True)
        
        print(standings)
        return standings



    # ------------ Fixtures Data -------------

    def fixturesData(self, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/matches'.format(self.season),
                                        headers=self.headers)
            print("Code:", response.status_code)
            response = response.json()['matches']
            
            # Save new data
            with open(f'data/fixtures.json', 'w') as json_file:
                json.dump(response, json_file)
            
            return response
        else:
            with open('data/fixtures.json', 'r') as json_file:
                return json.load(json_file)

    def getFixtures(self):
        print("Creating fixtures dataframe...")
        data = self.fixturesData(request_new=False)
        
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
    
    def getTeamRatings(self, no_seasons, standings):
        print("Creating team ratings dataframe...")
        if standings.empty:
            standings = self.getStandings(no_seasons)
        
        team_ratings = pd.DataFrame()
        # Add current season team names to the object team dataframe
        team_ratings['Team'] = standings['Team']

        # Create column for each included season
        for i in range(0, no_seasons):
            team_ratings[f'Rating {i}Y Ago'] = np.nan
        
        # Insert rating values for each row
        for idx, row in standings.iterrows():
            for i in range(no_seasons):
                if i == 0: # TODO: REMOVE ONCE SEASON STARTED
                    rating = (20 - row[f'Position_{self.season-1}']) / 2
                else:
                    rating = self.calcRating(row[f'Position_{self.season-i}'], row[f'Points_{self.season-i}'], row[f'GD_{self.season-i}'])
                team_ratings.loc[team_ratings.loc[team_ratings['Team'] == row['Team']].index, 'Rating {}Y Ago'.format(i)] = rating

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
        team_ratings.rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'})
        
        print(team_ratings)
        return team_ratings
        
    
    
    
    # ----------- Update Plotly Graph HTML Files ------------    
    
    def updateFixtures(self, no_seasons, standings, fixtures, team_ratings, home_advantages, team='Liverpool FC'):
        print("Updating fixtures graph...")
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
            for team_name in self.standings['Team']:
                gdv.genFixturesGraph(team_name, fixtures, team_ratings, home_advantages)
        else:
            gdv.genFixturesGraph(team, fixtures, team_ratings, home_advantages)
    
    def updateAll(self, no_seasons):
        """Update all graph files at once.

        Args:
            no_seasons (int): number of seasons of data to include.
        """
        # Fill dataframes
        # Fixtures for each team
        self.fixtures = self.getFixtures() 
        # Standings for the last "n_seasons" seasons
        self.standings = self.getStandings(no_seasons)
        # Ratings for each team, based on last "no_seasons" seasons standings table
        self.team_ratings = self.getTeamRatings(no_seasons, self.standings)
        self.home_advantages = self.getHomeAdvantages(no_seasons)
        
        # Update graphs
        self.updateFixtures(no_seasons, self.standings, self.fixtures, self.team_ratings, self.home_advantages)




if __name__ == "__main__":
    data = Data(2020)
    
    data.updateAll(3)


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
        self.last_standings = pd.DataFrame()
        self.team_ratings = pd.DataFrame()
        self.fixtures = pd.DataFrame()
    
    def standingsData(self, season, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(season), 
                                    headers=self.headers)
            print(response.status_code)
            response = response.json()['standings'][0]['table']
            
            with open(f'data/standings_{season}.json', 'w') as json_file:
                json.dump(response, json_file)
                
            return response
        else:
            with open(f'data/standings_{season}.json', 'r') as json_file:
                return json.load(json_file)

    def getLastStandings(self, no_seasons):
        """Get the Premier League table standings from the last specified number of 
           seasons. Compile each of these standings into a single dataframe to return.
           Dataframe contains only teams that are members of the current season.

        Args:
            no_seasons (int): number of previous seasons to fetch and include. 

        Returns:
            DataFrame: dataframe containing all standings.
        """

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

            # If we're using current season data, save list of team names to object team dataframe
            # if i == 0:
            #     self.team_ratings = pd.DataFrame({'Team': team_names})

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

        return standings
    
    def fixturesData(self, request_new=True):
        if request_new:
            response = requests.get(self.url + 'competitions/PL/matches/?season={}'.format(self.season),
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
        
        return fixtures
                   
    def calcRating(self, position, points, gd):
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points

        return rating

    def getSeasonWeightings(self, no_seasons, current_weight=0.7):
        return [current_weight] + [0.25, 0.05]
        
        
    def updateFixtures(self, no_seasons, team=None):
        self.last_standings = self.getLastStandings(no_seasons)
        self.fixtures = self.getFixtures()

        # Add current season team names to the object team dataframe
        self.team_ratings['Team'] = self.last_standings['Team']

        # Create column for each included season
        for i in range(0, no_seasons):
            self.team_ratings[f'Rating {i}Y Ago'] = np.nan
        
        # Insert rating values for each row
        for idx, row in self.last_standings.iterrows():
            for i in range(no_seasons):
                if i == 0: # TODO: REMOVE ONCE SEASON STARTED
                    rating = (20 - row[f'Position_{self.season-1}']) / 2
                else:
                    rating = self.calcRating(row[f'Position_{self.season-i}'], row[f'Points_{self.season-i}'], row[f'GD_{self.season-i}'])
                self.team_ratings.loc[self.team_ratings.loc[self.team_ratings['Team'] == row['Team']].index, 'Rating {}Y Ago'.format(i)] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in self.team_ratings.columns:
            self.team_ratings[col].replace(np.nan, self.team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for i in range(0, no_seasons):
            self.team_ratings[f'Normalised Rating {i}Y Ago'] = (self.team_ratings[f'Rating {i}Y Ago'] - self.team_ratings[f'Rating {i}Y Ago'].min()) / (self.team_ratings[f'Rating {i}Y Ago'].max() - self.team_ratings[f'Rating {i}Y Ago'].min())

        w = self.getSeasonWeightings(no_seasons) # Column weights
        self.team_ratings['Total Rating'] = 0
        for i in range(0, no_seasons):
            self.team_ratings['Total Rating'] += w[i] * self.team_ratings[f'Normalised Rating {i}Y Ago']

        self.team_ratings.sort_values(by="Total Rating", ascending=False, inplace=True)
        self.team_ratings.rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'})

        # Input team rating dataframe to grade upcoming fixtures
        gdv = GenDataVis()
        if team == None:
            for team_name in self.last_standings['Team']:
                gdv.genFixturesGraph(team_name, self.fixtures, self.team_ratings)
        else:
            gdv.genFixturesGraph(team, self.fixtures, self.team_ratings)
    
    def updateAll(self, fixtures_no_seasons):
        data.updateFixtures(fixtures_no_seasons)


if __name__ == "__main__":
    data = Data(2020)
    
    data.updateFixtures(3)


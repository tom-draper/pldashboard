from gen_data_vis import GenDataVis
import pandas as pd
import numpy as np
import requests
import json
import pprint

class Data:
    url = "https://api.football-data.org/v2/"
    api = "f6cead2f1c47791235586c2887a3e624599b62862b339749cfc0b10fcc83167c"
    headers = {'X-Auth-Token': 'cb159edc83824c21b6704e7ca18c2920'}
    
    def __init__(self, current_season):
        self.season = current_season
        self.lastThreeStandings = pd.DataFrame()
        self.teams = pd.DataFrame()
    
    
    def calcLastThreeStandings(self):
        # response = requests.get(self.url + 'competitions/PL/standings', headers=self.headers)
        # response = response.json()['standings'][0]['table']
        
        lastThreeStandings = pd.DataFrame(columns=['Position', 'Team', 'Played', 'Form', 'Won', 'Draw', 'Lost', 'Points', 'GF', 'GA', 'GD'])
        
        # Loop from current season to the season 2 years ago 
        for i in range(3):
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(self.season-i), headers=self.headers)
            response = response.json()['standings'][0]['table']
            # pprint.pprint(response)
            df = pd.DataFrame(response)
            
            # Rename teams to their team name
            team_names = pd.Series([df['team'][x]['name'] for x in range(len(df))])
            df['team'] = team_names
            
            # If we're using current season data, save list of team names to object team dataframe
            # if i == 0:
            #     self.teams = pd.DataFrame({'Team': team_names})
            
            # Rename columns to standardised names
            df.rename(columns={'position': 'Position', 'team': 'Team', 
                              'playedGames': 'Played', 'form': 'Form',
                              'won': 'Won', 'draw': 'Draw', 'lost': 'Lost',
                              'points': 'Points', 'goalsFor': 'GF',
                              'goalsAgainst': 'GA', 'goalDifference': 'GD'}, inplace=True)
            
            lastThreeStandings = lastThreeStandings.append(df, ignore_index=True)
        
        # Drop teams that are no longer in the current season
        print(~df['Team'].isin(lastThreeStandings.head(20)['Team']))
        lastThreeStandings = lastThreeStandings.drop(df[~df['Team'].isin(lastThreeStandings.head(20)['Team'])].index)

        self.lastThreeStandings = lastThreeStandings
        
        
    def updateFixtures(self):
        self.calcLastThreeStandings()
        
        print(self.lastThreeStandings)
        # Add current season team names to the object team dataframe
        self.teams['Team'] = self.lastThreeStandings.head(20)
        
        # Calculate a rating for each team in the current season
        self.teams['Rating Current'] = np.nan
        self.teams['Rating Last Season'] = np.nan
        self.teams['Rating Two Seasons Ago'] = np.nan
        
        for idx, row in self.lastThreeStandings.iterrows():
            print(idx, row)
        print(self.teams)
        
        gdv = GenDataVis()
        gdv.genFixturesGraph(self.teams)


if __name__ == "__main__":
    data = Data(2020)
    
    data.updateFixtures()
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
            
            if i == 0:
                lastThreeStandings = lastThreeStandings.append(df)
            else:
                # Drop teams that are no longer in the current season
                df = df.drop(lastThreeStandings[~df['Team'].isin(lastThreeStandings.head(20)['Team'])].index)
                lastThreeStandings = df.merge(lastThreeStandings, on='Team', how="outer", suffixes=(f"_{self.season-i}", None))

        lastThreeStandings.sort_values(by=['Position', f'Position_{self.season-1}', f'Position_{self.season-2}'], inplace=True)
        lastThreeStandings.reset_index(drop=True, inplace=True)
        
        return lastThreeStandings
    
    def calcRating(self, position, points, gd):
        rating = (20 - position)
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points
        
        return rating
        
    def updateFixtures(self):
        self.lastThreeStandings = self.calcLastThreeStandings()
        
        print(self.lastThreeStandings)
        # Add current season team names to the object team dataframe
        self.teams['Team'] = self.lastThreeStandings['Team']
        
        # Calculate a rating for each team in the current season
        self.teams['Rating Current'] = np.nan
        self.teams['Rating Last Season'] = np.nan
        self.teams['Rating Two Seasons Ago'] = np.nan
        
        for idx, row in self.lastThreeStandings.iterrows():
            # print(row['Team'])
            # print(self.teams.loc[self.teams['Team'] == row['Team']])
            
            rating_current = self.calcRating(row['Position'], row['Points'], row['GD'])
            self.teams.loc[self.teams.loc[self.teams['Team'] == row['Team']].index, 'Rating Current'] = rating_current
            
            rating_last_season = self.calcRating(row[f'Position_{self.season-1}'], row[f'Points_{self.season-1}'], row[f'GD_{self.season-1}'])
            self.teams.loc[self.teams.loc[self.teams['Team'] == row['Team']].index, 'Rating Last Season'] = rating_last_season

            rating_two_seasons_ago = self.calcRating(row[f'Position_{self.season-2}'], row[f'Points_{self.season-2}'], row[f'GD_{self.season-2}'])
            self.teams.loc[self.teams.loc[self.teams['Team'] == row['Team']].index, 'Rating Two Seasons Ago'] = rating_two_seasons_ago
            
            # self.teams.at['Current Rating', self.teams.loc[self.teams['Team'] == row['Team']].index] = rating_current
        
        gdv = GenDataVis()
        gdv.genFixturesGraph(self.teams)


if __name__ == "__main__":
    data = Data(2020)
    
    data.updateFixtures()
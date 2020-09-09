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
        self.lastStandings = pd.DataFrame()
        self.team_ratings = pd.DataFrame()
        self.fixtures = pd.DataFrame()

    def getLastStandings(self, no_seasons):
        # response = requests.get(self.url + 'competitions/PL/standings', headers=self.headers)
        # response = response.json()['standings'][0]['table']

        standings = pd.DataFrame(columns=['Position', 'Team', 'Played', 
                                                   'Form', 'Won', 'Draw', 'Lost', 
                                                   'Points', 'GF', 'GA', 'GD'])

        # Loop from current season to the season 2 years ago
        for i in range(no_seasons):
            response = requests.get(self.url + 'competitions/PL/standings/?season={}'.format(self.season-i), 
                                    headers=self.headers)
            response = response.json()['standings'][0]['table']
            # pprint.pprint(response)
            df = pd.DataFrame(response)

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

    def calcRating(self, position, points, gd):
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points

        return rating

    def getSeasonWeightings(self, no_seasons, current_weight=0.7):
        return [current_weight] + [(0.3) for i in range(1, no_seasons)]
        
        
    def updateFixtures(self, no_seasons):
        self.lastStandings = self.getLastStandings(no_seasons)
        # self.fixtures = self.getFixtures()

        # Add current season team names to the object team dataframe
        self.team_ratings['Team'] = self.lastStandings['Team']

        # Create column for each included season
        for i in range(0, no_seasons):
            self.team_ratings[f'Rating {i}Y Ago'] = np.nan
        
        # Insert rating values for each row
        for idx, row in self.lastStandings.iterrows():
            for i in range(no_seasons):
                rating = self.calcRating(row[f'Position_{self.season-i}'], row[f'Points_{self.season-i}'], row[f'GD_{self.season-i}'])
                self.team_ratings.loc[self.team_ratings.loc[self.team_ratings['Team'] == row['Team']].index, 'Rating {}Y Ago'.format(i)] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in self.team_ratings.columns:
            self.team_ratings[col].replace(np.nan, self.team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for i in range(0, no_seasons):
            self.team_ratings[f'Normalised Rating {i}Y Ago'] = (self.team_ratings[f'Rating {i}Y Ago'] - self.team_ratings[f'Rating {i}Y Ago'].min()) / (self.team_ratings[f'Rating {i}Y Ago'].max() - self.team_ratings[f'Rating {i}Y Ago'].min())
        # self.team_ratings['Normalised Rating Two Seasons Ago'] = (self.team_ratings['Rating Two Seasons Ago'] - self.team_ratings['Rating Two Seasons Ago'].min()) / (
        #     self.team_ratings['Rating Two Seasons Ago'].max() - self.team_ratings['Rating Two Seasons Ago'].min())

        w = self.getSeasonWeightings(no_seasons) # Column weights
        print("Weights:", w)
        self.team_ratings['Total Rating'] = 0
        for i in range(0, no_seasons):
            self.team_ratings['Total Rating'] += w[i] * self.team_ratings[f'Normalised Rating {i}Y Ago']

        self.team_ratings.sort_values(by="Total Rating", ascending=False, inplace=True)
        self.team_ratings.rename(columns={'Rating 0Y Ago': 'Rating Current', 'Normalised Rating 0Y Ago': 'Normalised Rating Current'})

        # Input team rating dataframe to grade upcoming fixtures
        gdv = GenDataVis()
        gdv.genFixturesGraph(self.team_ratings)


if __name__ == "__main__":
    data = Data(2020)

    data.updateFixtures(2)

import logging

import pandas as pd
from pandas import DataFrame
from timebudget import timebudget

from .df import DF


class Fantasy(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'fantasy')
    

    def to_dict(self):
        return self.df.to_dict(orient='index')


    @timebudget
    def build(self, json_data: dict, display: bool = False):
        """ Builds a dataframe containing the past and future fixtures for the 
            current season (matchday 1 to 38) and inserts it into the fixtures 
            class variable.

            Rows: all players participating in the current season
        """
        logging.info('🛠️  Building fantasy dataframe... ')

        # Get first and only key as the current season
        current_season = next(iter(json_data['fantasy'].keys()))
        fantasy_data = json_data['fantasy'][current_season]

        teams = {}
        for team in fantasy_data['teams']:
            teams[team['code']] = team['name']

        player_types = {}
        for player_type in fantasy_data['element_types']:
            player_types[player_type['id']] = player_type['singular_name']

        d = {}
        for player in fantasy_data['elements']:
            d[player['web_name']] = {
                'firstName': player['first_name'],
                'surname': player['second_name'],
                'form': player['form'],
                'team': teams[player['team_code']],
                'minutes': player['minutes'],
                'pointsPerGame': player['points_per_game'],
                'price': player['now_cost'],
                'position': player_types[player['element_type']],
                'selectedBy': player['selected_by_percent'],
                'points': player['event_points'],
                'bonusPoints': player['bonus'],
                'transferIn': player['transfers_in'],
                'transferOut': player['transfers_out'],
                'goals': player['goals_scored'],
                'assists': player['assists'],
                'cleanSheets': player['clean_sheets'],
                'ownGoals': player['own_goals'],
                'penalitiesSaved': player['penalties_saved'],
                'penalitiesMissed': player['penalties_missed'],
                'yellowCards': player['yellow_cards'],
                'news': player['news'],
                'redCards': player['red_cards'],
                'saves': player['saves'],
                'chanceOfPlayingNextRound': player['chance_of_playing_next_round'],
                'chanceOfPlayingThisRound': player['chance_of_playing_this_round'],
            }
        
        fantasy = pd.DataFrame.from_dict(d, orient='index')
        fantasy.fillna(0, inplace=True)

        if display:
            print(fantasy)

        self.df = fantasy

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import math

import pandas as pd
from lib.utils.utilities import Utilities
from pandas.core.frame import DataFrame

from dataframes.fixtures import Fixtures
from dataframes.form import Form
from dataframes.home_advantages import HomeAdvantages
from dataframes.standings import Standings
from dataframes.team_ratings import TeamRatings
from dataframes.upcoming import Upcoming

utils = Utilities()

class Data:
    def __init__(self, current_season: int):
        self.last_updated = None
        self.fixtures: Fixtures = Fixtures()
        self.standings: Standings = Standings()
        self.team_ratings: TeamRatings = TeamRatings()
        self.home_advantages: HomeAdvantages = HomeAdvantages()
        self.form: Form = Form()
        self.upcoming: Upcoming = Upcoming(current_season)
    
    def built_all_dataframes(self) -> bool:
        return (self.fixtures.df is not None
                and self.standings.df is not None
                and self.team_ratings.df is not None
                and self.home_advantages.df is not None 
                and self.form.df is not None 
                and self.upcoming.df is not None)
    
    def to_dataframe(self) -> DataFrame:
        return pd.concat((self.fixtures.df, 
                          self.standings.df, 
                          self.team_ratings.df, 
                          self.home_advantages.df, 
                          self.form.df, 
                          self.upcoming.df), 
                         1)

    def collapse_tuple_keys(self, d):
        if type(d) is not dict:
            if type(d) is float and math.isnan(d):
                # Remove NaN values
                return None
            return d
        
        new_d = {}
        for k, v in d.items():
            if type(k) is tuple:
                k = [x for x in k if x != '']  # Remove blank multi-index levels
                if len(k) == 1:
                    k = k[0]  # If only one level remains, take the single heading
            
            if type(k) is list:
                # Separate multi-index into a nested dict
                k1 = str(k[0]) if type(k[0]) is int else k[0]
                k2 = str(k[1]) if type(k[1]) is int else k[1]
                if k1 in new_d:
                    new_d[k1][k2] = self.collapse_tuple_keys(v)
                else:
                    new_d[k1] = {k2: self.collapse_tuple_keys(v)}
            elif type(k) is int:
                new_d[str(k)] = self.collapse_tuple_keys(v)
            else:
                new_d[k] = self.collapse_tuple_keys(v)
        
        return new_d

    def collapse_tuple_keys2(self, d):
        if type(d) is not dict:
            if type(d) is float and math.isnan(d):
                # Remove NaN values
                return None
            return d
        
        new_d = {}
        for k, v in d.items():
            if type(k) is tuple:
                k = [x for x in k if x != '']  # Remove blank multi-index levels
                if len(k) == 1:
                    k = k[0]  # If only one level remains, take the single heading
            
            if type(k) is list:
                # Separate multi-index into a nested dict
                k1 = str(k[0]) if type(k[0]) is int else k[0]
                k2 = str(k[1]) if type(k[1]) is int else k[1]
                k3 = None
                if len(k) > 2:
                    k3 = str(k[2]) if type(k[2]) is int else k[2]
                    
                if k1 in new_d:
                    if k3 is None:
                        new_d[k1][k2] = self.collapse_tuple_keys2(v)
                    else:
                        if k2 in new_d[k1]:
                            new_d[k1][k2] = {k3: self.collapse_tuple_keys2(v)}
                        else:
                            new_d[k1] = {}
                            new_d[k1][k2] = {k3: self.collapse_tuple_keys2(v)}
                else:
                    if k3 is None:
                        new_d[k1] = {k2: self.collapse_tuple_keys2(v)}
                    else:
                        new_d[k1] = {}
                        new_d[k1][k2] = {k3: self.collapse_tuple_keys2(v)}
                        
            elif type(k) is int:
                new_d[str(k)] = self.collapse_tuple_keys2(v)
            else:
                new_d[k] = self.collapse_tuple_keys2(v)
        
        return new_d

    def collapse_tuple_keys3(self, d):
        if type(d) is not dict:
            if type(d) is float and math.isnan(d):
                # Remove NaN values
                return None
            return d
        
        new_d = {}
        for k, v in d.items():
            if type(k) is tuple:
                k = [x for x in k if x != '']  # Remove blank multi-index levels
                if len(k) == 1:
                    k = k[0]  # If only one level remains, take the single heading
            
            if type(k) is list:
                # Separate multi-index into a nested dict
                temp_d = new_d
                for i, _k in enumerate(k):
                    if type(_k) is int or type(_k) is float:
                        _k = str(_k)
                    if _k not in temp_d:
                        temp_d[_k] = {}
                    if i == len(k)-1:
                        temp_d[_k] = self.collapse_tuple_keys3(v)
                    else:
                        temp_d = temp_d[_k]
            elif type(k) is int:
                new_d[str(k)] = self.collapse_tuple_keys3(v)
            else:
                new_d[k] = self.collapse_tuple_keys3(v)
        
        return new_d
    
    def to_dict(self) -> dict:
        if not self.built_all_dataframes():
            raise ValueError('❌ [ERROR] Cannot build one team data dict: A dataframe is empty')
            
        # Build one dict containing all dataframes
        d = {
            'lastUpdated': self.last_updated,
            'fixtures': self.fixtures.df.to_dict(orient='index'),
            'standings': self.standings.df.to_dict(orient='index'),
            'teamRatings': self.team_ratings.df.to_dict(orient='index'),
            'homeAdvantages': self.home_advantages.df.to_dict(orient='index'),
            'form': self.form.df.to_dict(orient='index'),
            'upcoming': self.upcoming.df.to_dict(orient='index'),
        }
                
        # import pprint
        # Collapse tuple keys, convert int key to str and remove NaN values
        d = self.collapse_tuple_keys3(d)
        # pprint.pprint(d)
        return d

from datetime import datetime
from typing import Union

import os
import numpy as np
import pandas as pd
from src.data import Form, HomeAdvantages, TeamRatings, Fixtures
from src.fmt import convert_team_name_or_initials
from pandas.core.frame import DataFrame

class Predictor:
    def __init__(self, 
        json_data: dict,
        fixtures: Fixtures,
        form: Form,
        team_ratings: TeamRatings,
        home_advantages: HomeAdvantages,
        season: int,
        num_seasons: int

    ):
        # [last season, 2 seasons ago, 3 seasons ago]
        total_fixtures = {season: fixtures.df}
        prev_fixtures = [Fixtures(), Fixtures(), Fixtures()]
        for i in range(num_seasons-1):
            prev_fixtures[i].build(json_data,season-i-1)
            total_fixtures[season-i-1] = prev_fixtures[i].df
        
        total_fixtures = pd.concat(total_fixtures, axis=1)

        total_fixtures = total_fixtures.drop(index=total_fixtures.index.difference(fixtures.df.index.tolist()), axis=0)

        self.fixtures = total_fixtures
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages
    
    def _team_scoreline_freq(self, team: str, home_away: bool = True) -> dict[str, int]:
        freq = {}
        team_initials = convert_team_name_or_initials(team)

        team_row = self.fixtures.loc[team]
        # Remove higher-level multiindex
        team_row.index = team_row.index.get_level_values(2)
        scores = team_row.loc['score']
        at_homes = team_row.loc['atHome']

        for score, at_home in zip(scores, at_homes):
            if home_away:
                if at_home:
                    scoreline = f'{team_initials} {score["homeGoals"]} - {score["awayGoals"]} ___'
                else:
                    scoreline = f'___ {score["homeGoals"]} - {score["awayGoals"]} {team_initials}'
            else:
                scoreline = f'{score["homeGoals"]} - {score["awayGoals"]}'
            
            if scoreline in freq:
                freq[scoreline] += 1
            else:
                freq[scoreline] = 1

        return freq

    def _fixture_scoreline_freq(self, team1: str, team2: str, home_away: bool = True) -> dict[str, int]:
        freq = {}

        team1_initials = convert_team_name_or_initials(team1)
        team2_initials = convert_team_name_or_initials(team2)

        team1_row = self.fixtures.loc[team1]

        for (season, matchday, column) in team1_row.index:
            if column == "team" and team1_row[(season, matchday, column)] == team2:
                at_home = team1_row[(season, matchday, 'atHome')]
                score = team1_row[(season, matchday, 'score')]

                if home_away:
                    if at_home:
                        scoreline = f'{team1_initials} {score["homeGoals"]} - {score["awayGoals"]} {team2_initials}'
                    else:
                        scoreline = f'{team2_initials} {score["homeGoals"]} - {score["awayGoals"]} {team1_initials}'
                else:
                    scoreline = f'{score["homeGoals"]} - {score["awayGoals"]}'
                
                if scoreline in freq:
                    freq[scoreline] += 1
                else:
                    freq[scoreline] = 1

        return freq
    
    @staticmethod
    def _separate_scoreline_freq_by_home_away(team: str, freq: dict[str, int], at_home: bool) -> dict[str, int]:
        separated_freq = {}

        team_initials = convert_team_name_or_initials(team)
        for scoreline in freq:
            if (at_home and scoreline[:3] == team_initials) or (not at_home and scoreline[-3:] == team_initials):
                separated_freq[scoreline] = freq[scoreline]

        return separated_freq
    
    @staticmethod
    def _display_scoreline_freq(freq: dict[str, int | float]):
        sorted_freq = []
        for scoreline, count in freq.items():
            sorted_freq.append((scoreline, count))
        
        # Sort by frequency count descending
        sorted_freq.sort(key=lambda x: x[1], reverse=True)

        for scoreline, count in sorted_freq:
            print(scoreline, count)
    
    @staticmethod
    def _scoreline_freq_probability(freq: dict[str, int]) -> dict[str, float]:
        total_scorelines = sum(freq.values())

        probabilities = {}
        for scoreline in freq:
            probabilities[scoreline] = freq[scoreline] / total_scorelines
        
        return probabilities
    
    @staticmethod
    def _remove_scoreline_freq_teams(freq: dict[str, int | float]) -> dict[str, int | float]:
        new_freq = {}
        for scoreline, count in freq.items():
            # Remove team initials and space on either side
            new_scoreline = scoreline[4:-4]
            new_freq[new_scoreline] = count

        return new_freq

    def predict_score(
        self,
        home_team: str,
        away_team: str,
    ) -> dict:
        home_scoreline_freq = self._team_scoreline_freq(home_team)
        away_scoreline_freq = self._team_scoreline_freq(away_team)
        fixture_scoreline_freq = self._fixture_scoreline_freq(home_team, away_team)

        home_scoreline_freq_home = self._separate_scoreline_freq_by_home_away(home_team, home_scoreline_freq, True)
        away_scoreline_freq_away = self._separate_scoreline_freq_by_home_away(away_team, away_scoreline_freq, False)

        home_scoreline_probabilities_home = self._scoreline_freq_probability(home_scoreline_freq_home)
        away_scoreline_probabilities_away = self._scoreline_freq_probability(away_scoreline_freq_away)
        self._display_scoreline_freq(home_scoreline_probabilities_home | away_scoreline_probabilities_away)

        prediction = None
        return prediction

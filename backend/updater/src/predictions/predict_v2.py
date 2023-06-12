from datetime import datetime
from typing import Union

import os
import numpy as np
import pandas as pd
from src.data import Form, HomeAdvantages, TeamRatings, Fixtures
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
        print(total_fixtures)

        self.fixtures = total_fixtures
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages

    def predict_score(
        self,
        home_team: str,
        away_team: str,
    ) -> dict:
        prediction = None
        return prediction

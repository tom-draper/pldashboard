import numpy as np
from src.dataframes import TeamRatings

from .scoreline import Scoreline


def calc_form(team: str, recent_matches: list[Scoreline], weightings: list[float], team_ratings: TeamRatings) -> float:
    weightings /= np.sum(weightings)

    form = 0.5
    for scoreline, weight in zip(recent_matches, weightings):
        if scoreline.home_team == team:
            scored = scoreline.home_goals
            conceded = scoreline.away_goals
            opp_team = scoreline.away_team
        elif scoreline.away_team == team:
            scored = scoreline.away_goals
            conceded = scoreline.home_goals
            opp_team = scoreline.home_team
        else:
            continue

        gd = scored - conceded

        opp_team_rating = 0
        if opp_team in team_ratings.df.index:
            opp_team_rating = team_ratings.df.at[opp_team, 'totalRating']
        form += opp_team_rating * gd * weight

    form = min(max(0, form), 1)  # Cap rating
    return form

def scale_by_form(freq: dict[str, int | float], home_form: float, away_form: float):
    home_form += 1
    away_form += 1
    for scoreline in freq:
        if scoreline.home_goals > scoreline.away_goals:
            freq[scoreline] *= home_form
        elif scoreline.home_goals < scoreline.away_goals:
            freq[scoreline] *= away_form
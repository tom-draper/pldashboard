import numpy as np
from src.data.dataframes import TeamRatings

from .scoreline import Scoreline


def calc_form(
    team: str,
    recent_matches: list[Scoreline],
    weightings: list[float],
    team_ratings: TeamRatings,
):
    weightings /= np.sum(weightings)

    form = 0.5
    for scoreline, weight in zip(recent_matches, weightings):
        if scoreline.home_team == team:
            scored = scoreline.home_goals
            conceded = scoreline.away_goals
            opposition = scoreline.away_team
        elif scoreline.away_team == team:
            scored = scoreline.away_goals
            conceded = scoreline.home_goals
            opposition = scoreline.home_team
        else:
            continue

        gd = scored - conceded

        opposition_rating = 0
        if opposition in team_ratings.df.index:
            opposition_rating = team_ratings.df.at[opposition, "total"]
        form += opposition_rating * gd * weight

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

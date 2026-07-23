"""Shape fitted-model predictions for storage.

Turns the raw multi-season fixtures into a fitted model, predicts the upcoming
matchday, and packages each fixture into the document the dashboard reads:
expected goals, the home and away goal distributions, the top scorelines, and
home / draw / away probabilities. Team names are cleaned and reduced to initials
so the ids line up with the rest of the pipeline (and with actual-score backfill).

The engine comes from the `predictions.models` registry (Dixon-Coles by
default), as opposed to `form_predictor`, which is the older hand-rolled
heuristic feeding the `upcoming` DataFrame. The stored collection is still
named PredictionsV3 for continuity with the data already in it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from updater.data.raw_data import RawData, full_time_goals, parse_utc_date
from updater.fmt import clean_full_team_name, convert_team_name_or_initials
from updater.predictions import models as model_registry
from updater.predictions.distributions import MatchResult, ScorePrediction

# Goals beyond this are so unlikely they add noise, not information, to the
# stored distributions and heatmap.
DISPLAY_GOALS = 7
TOP_SCORELINES = 6


def extract_matches(
    raw_data: RawData, current_season: int, num_seasons: int
) -> list[MatchResult]:
    """Every finished match over the last `num_seasons`, cleaned team names."""
    matches: list[MatchResult] = []
    for season in range(current_season - num_seasons + 1, current_season + 1):
        for match in raw_data.fixtures.get(season, []):
            if match.get("status") != "FINISHED":
                continue
            home_goals, away_goals = full_time_goals(match)
            if home_goals is None or away_goals is None:
                continue
            matches.append(
                MatchResult(
                    date=parse_utc_date(match["utcDate"]),
                    home_team=clean_full_team_name(match["homeTeam"]["name"]),
                    away_team=clean_full_team_name(match["awayTeam"]["name"]),
                    home_goals=int(home_goals),
                    away_goals=int(away_goals),
                )
            )
    return matches


def next_matchday_fixtures(
    raw_data: RawData, current_season: int
) -> list[tuple[datetime, str, str]]:
    """The (date, home, away) of the earliest not-yet-played matchday."""
    unplayed = [
        match
        for match in raw_data.fixtures.get(current_season, [])
        if match.get("status") != "FINISHED" and match.get("matchday") is not None
    ]
    if not unplayed:
        return []

    next_matchday = min(match["matchday"] for match in unplayed)
    fixtures = [
        (
            parse_utc_date(match["utcDate"]),
            clean_full_team_name(match["homeTeam"]["name"]),
            clean_full_team_name(match["awayTeam"]["name"]),
        )
        for match in unplayed
        if match["matchday"] == next_matchday
    ]
    fixtures.sort(key=lambda f: f[0])
    return fixtures


def _prediction_document(
    date: datetime, home: str, away: str, pred: ScorePrediction
) -> dict[str, Any]:
    home_initials = convert_team_name_or_initials(home)
    away_initials = convert_team_name_or_initials(away)

    # Rank the joint matrix to surface the handful of most likely scorelines.
    scorelines = [
        {"homeGoals": h, "awayGoals": a, "probability": pred.scoreline_matrix[h][a]}
        for h in range(len(pred.scoreline_matrix))
        for a in range(len(pred.scoreline_matrix[h]))
    ]
    scorelines.sort(key=lambda s: s["probability"], reverse=True)

    return {
        "_id": f"{home_initials} vs {away_initials}",
        "datetime": date,
        "home": home,
        "away": away,
        "homeInitials": home_initials,
        "awayInitials": away_initials,
        "expectedHomeGoals": pred.expected_home_goals,
        "expectedAwayGoals": pred.expected_away_goals,
        "homeGoalsDist": pred.home_goals_dist[: DISPLAY_GOALS + 1],
        "awayGoalsDist": pred.away_goals_dist[: DISPLAY_GOALS + 1],
        "topScorelines": scorelines[:TOP_SCORELINES],
        "prediction": {
            "homeGoals": pred.predicted_home_goals,
            "awayGoals": pred.predicted_away_goals,
        },
        "probHomeWin": pred.prob_home_win,
        "probDraw": pred.prob_draw,
        "probAwayWin": pred.prob_away_win,
        "actual": None,
    }


def build_model_predictions(
    raw_data: RawData,
    current_season: int,
    num_seasons: int = 4,
    model_name: str = model_registry.DEFAULT_MODEL,
) -> list[dict[str, Any]]:
    """Fit the chosen engine and predict the upcoming matchday's fixtures.

    `model_name` selects from `predictions.models`, so swapping the production
    engine for one the backtest prefers is a name change rather than an edit.
    It must name a *scoreline* engine: the dashboard stores a goal matrix and a
    heatmap, which the direct outcome models cannot produce. Those exist to be
    benchmarked, not shipped.
    """
    if model_registry.family_of(model_name) != model_registry.SCORELINE:
        raise ValueError(
            f"{model_name!r} is an outcome-only model and cannot be used for "
            "production predictions, which need a full scoreline distribution. "
            f"Choose one of: {', '.join(model_registry.available(model_registry.SCORELINE))}"
        )

    matches = extract_matches(raw_data, current_season, num_seasons)
    model = model_registry.build(model_name).fit(matches)
    if model is None:
        return []

    documents: list[dict[str, Any]] = []
    for date, home, away in next_matchday_fixtures(raw_data, current_season):
        # Unknown (promoted) teams fall back to the model's weakest-side prior.
        pred = model.predict(home, away)
        documents.append(_prediction_document(date, home, away, pred))
    return documents

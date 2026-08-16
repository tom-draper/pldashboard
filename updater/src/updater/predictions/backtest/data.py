"""Loading finished matches out of the on-disk backups."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from updater.data.raw_data import full_time_goals, match_teams, parse_utc_date
from updater.env import BACKUPS_DIR
from updater.predictions.distributions import MatchResult


@dataclass
class SeasonMatch:
    season: int
    result: MatchResult


def load_matches(backups_dir: Path = BACKUPS_DIR) -> list[SeasonMatch]:
    """Every finished league match across all backup seasons, oldest first.

    Team names are cleaned exactly as `model_predictions.extract_matches` cleans them, so
    the engines are benchmarked over the same team namespace they are fitted on
    in production. Without it a mid-backup rename ("Leeds United FC" ->
    "Leeds United") would silently split one club's history into two teams.
    """
    matches: list[SeasonMatch] = []
    for path in sorted((backups_dir / "fixtures").glob("fixtures_*.json")):
        season = int(path.stem.split("_")[1])
        for match in json.loads(path.read_text()):
            if match.get("status") != "FINISHED":
                continue
            home_goals, away_goals = full_time_goals(match)
            if home_goals is None or away_goals is None:
                continue
            home_team, away_team = match_teams(match)
            matches.append(
                SeasonMatch(
                    season=season,
                    result=MatchResult(
                        date=parse_utc_date(match["utcDate"]),
                        home_team=home_team,
                        away_team=away_team,
                        home_goals=int(home_goals),
                        away_goals=int(away_goals),
                    ),
                )
            )
    matches.sort(key=lambda m: m.result.date)
    return matches


def latest_complete_season(matches: list[SeasonMatch], min_matches: int = 300) -> int:
    counts: dict[int, int] = {}
    for match in matches:
        counts[match.season] = counts.get(match.season, 0) + 1
    complete = [season for season, count in counts.items() if count >= min_matches]
    return max(complete) if complete else max(counts)

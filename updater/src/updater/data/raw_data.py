from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from updater.fmt import clean_full_team_name

# football-data renamed the full-time score keys partway through the period
# these backups cover: score.fullTime.homeTeam/awayTeam became home/away. Both
# spellings are still on disk, so every reader has to accept either. Keeping
# that in one place stops the fallback being re-derived (it had been written
# three different ways, and one reader omitted it entirely).
_FULL_TIME_KEYS = (("home", "homeTeam"), ("away", "awayTeam"))


def full_time_goals(match: dict[str, Any]) -> tuple[Optional[int], Optional[int]]:
    """The (home, away) full-time goals, or (None, None) if not yet played."""
    full_time = match["score"]["fullTime"]
    goals = []
    for current_key, legacy_key in _FULL_TIME_KEYS:
        value = full_time.get(current_key)
        if value is None:
            value = full_time.get(legacy_key)
        goals.append(None if value is None else int(value))
    return goals[0], goals[1]


def parse_utc_date(utc_date: str) -> datetime:
    """A match's kickoff time as a timezone-aware UTC datetime."""
    return datetime.fromisoformat(utc_date.replace("Z", "+00:00")).astimezone(
        timezone.utc
    )


def match_teams(match: dict[str, Any]) -> tuple[str, str]:
    """The (home, away) team names, cleaned.

    Every consumer wants the cleaned name rather than the API's, and cleaning
    exactly one side of a fixture is always a bug, so the pair is returned
    together.
    """
    return (
        clean_full_team_name(match["homeTeam"]["name"]),
        clean_full_team_name(match["awayTeam"]["name"]),
    )


def match_team_and_opposition(
    match: dict[str, Any], at_home: bool
) -> tuple[str, str]:
    """One side's (team, opposition), cleaned, from that side's perspective."""
    home_team, away_team = match_teams(match)
    return (home_team, away_team) if at_home else (away_team, home_team)


@dataclass
class RawData:
    """The raw API/backup payloads every DataFrame build reads from.

    Previously a nested dict keyed by strings, which allowed silent typos:
    `raw_data["fantasy_fixtures"]` was read in one place but never written,
    so the lookup failed into an exception handler and returned nothing.
    """

    # Season year -> list of match objects
    fixtures: dict[int, list[dict[str, Any]]] = field(default_factory=dict)
    # Season year -> list of standings table rows
    standings: dict[int, list[dict[str, Any]]] = field(default_factory=dict)
    # Fantasy Premier League "bootstrap-static" payload
    fantasy_general: dict[str, Any] = field(default_factory=dict)
    # Fantasy Premier League fixtures payload
    fantasy_fixtures: list[dict[str, Any]] = field(default_factory=list)

    def seasons(self):
        """Season years present in the fixtures data, newest first."""
        return sorted(self.fixtures.keys(), reverse=True)

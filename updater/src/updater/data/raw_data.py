from dataclasses import dataclass, field
from typing import Any


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

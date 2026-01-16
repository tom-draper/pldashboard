from dataclasses import dataclass, field
from updater.data.fantasy import FantasyData
from updater.data.teams import TeamsData


@dataclass
class Data:
    teams: TeamsData = field(default_factory=TeamsData)
    fantasy: FantasyData = field(default_factory=FantasyData)

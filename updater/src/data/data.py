from dataclasses import dataclass, field
from .fantasy import FantasyData
from .teams import TeamsData


@dataclass
class Data:
    teams: TeamsData = field(default_factory=TeamsData)
    fantasy: FantasyData = field(default_factory=FantasyData)

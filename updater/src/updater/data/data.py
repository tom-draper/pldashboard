from dataclasses import dataclass, field
from updater.data.dataframes import Fantasy
from updater.data.teams import TeamsData


@dataclass
class Data:
    teams: TeamsData = field(default_factory=TeamsData)
    fantasy: Fantasy = field(default_factory=Fantasy)

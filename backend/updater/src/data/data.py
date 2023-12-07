from datetime import datetime

from .fantasy import FantasyData
from .teams import TeamsData


class Data:
    def __init__(self):
        self.teams = TeamsData()
        self.fantasy = FantasyData()
        self.last_updated: datetime | None = None

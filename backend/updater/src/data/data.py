from datetime import datetime

from .fantasy import FantasyData
from .teams import TeamsData


class Data:
    def __init__(self):
        self.last_updated: datetime | None = None
        self.teams = TeamsData()
        self.fantasy = FantasyData()

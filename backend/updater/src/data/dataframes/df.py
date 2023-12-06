import logging
from datetime import datetime

from pandas import DataFrame


class DF:
    def __init__(self, d: DataFrame = DataFrame(), name: str = None):
        self.df = DataFrame(d) if not d.empty else None
        self.name = name
        self.last_updated: datetime = None

    def __str__(self):
        return str(self.df)

    def _check_dependencies(self, *args):
        for arg in args:
            if arg.df.empty:
                raise ValueError(
                    f"❌ [ERROR] Cannot {self.name} dataframe: {arg.name} dataframe empty"
                )

    def log_building(self, season: int | None = None):
        season_tag = "" if season is None else f"[{season}]"
        logging.info(
            f"🛠️  {season_tag} Building {self.name.replace('_', ' ')} dataframe... "
        )

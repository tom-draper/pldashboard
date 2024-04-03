import logging
from datetime import datetime
from typing import Optional

from pandas import DataFrame


class DF:
    def __init__(self, d: DataFrame = DataFrame(), name: Optional[str] = None):
        self.df: Optional[DataFrame] = DataFrame(d) if not d.empty else None
        self.name = name
        self.last_updated: Optional[datetime] = None

    def __str__(self):
        return str(self.df)

    def _check_dependencies(self, *args):
        for arg in args:
            if arg.df.empty:
                raise ValueError(
                    f"Cannot {self.name} DataFrame: {arg.name} DataFrame empty."
                )

    def log_building(self, season: Optional[int] = None):
        season_tag = "" if season is None else f"[{season}]"
        logging.info(
            f"🛠️  {season_tag} Building {self.name.replace('_', ' ')} DataFrame... "
        )

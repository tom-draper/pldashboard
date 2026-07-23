import logging
from datetime import datetime
from typing import Optional

from pandas import DataFrame


class DF:
    def __init__(self, d: Optional[DataFrame] = None, name: Optional[str] = None):
        self.df: Optional[DataFrame] = DataFrame(d) if d is not None and not d.empty else None
        self.name = name
        self.last_updated: Optional[datetime] = None

    def __str__(self):
        return str(self.df)

    def _check_dependencies(self, *args):
        # __init__ stores an empty frame as None, so the None case is the
        # normal way a dependency turns up unbuilt and must raise the same
        # ValueError rather than an AttributeError from `.empty`.
        for arg in args:
            if arg.df is None or arg.df.empty:
                raise ValueError(
                    f"Cannot build {self.name} DataFrame: {arg.name} DataFrame empty."
                )

    def log_building(self, season: Optional[int] = None):
        season_tag = "" if season is None else f"[{season}]"
        logging.info(
            f"🛠️  {season_tag} Building {self.name.replace('_', ' ')} DataFrame... "
        )

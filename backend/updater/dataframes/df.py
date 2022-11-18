from datetime import datetime

from pandas import DataFrame


class DF:
    def __init__(self, d: DataFrame = DataFrame(), name: str = None):
        self.df = DataFrame(d) if not d.empty else None
        self.name = name
        self.last_updated = None  # type: datetime

    def __str__(self):
        return str(self.df)

    def __getitem__(self, key: str):
        return self.df[key]

    def _check_dependencies(self, *args):
        for arg in args:
            if arg.df.empty:
                raise ValueError(
                    f'❌ [ERROR] Cannot {self.name} dataframe: {arg.name} dataframe empty')

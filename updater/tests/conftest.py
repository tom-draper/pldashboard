import pandas as pd
import pytest
from abc import abstractmethod
from src.data import Data
from src.updater import Updater
from typing import Protocol, TypeVar

pd.set_option('display.max_columns', None)  # Show all columns without truncation
pd.set_option('display.width', None)        # Disable line wrapping (use full width)

CT = TypeVar("CT", bound="Comparable")

# DataFrames built from data backups
updater_loaded = Updater()
updater_loaded.build_all(request_new=False, display_tables=False, update_db=False)

# DataFrames built from live data
updater_fetched = Updater()
updater_fetched.build_all(request_new=True, display_tables=False, update_db=False)

data_objects: list[Data] = [updater_loaded.data, updater_fetched.data]
data_ids = ["loaded", "fetched"]


current_season = 2024


class Comparable(Protocol):
    """Protocol for annotating comparable types."""

    @abstractmethod
    def __ge__(self: CT, other: CT) -> bool:
        pass


def is_sorted(my_list: list[CT]):
    return all(x >= y for x, y in zip(my_list, my_list[1:]))  # passes if descending


def in_range(values: pd.Series, min_value: float, max_value: float):
    return ((values >= min_value) & (values <= max_value)).all()


def min_limit(values: pd.Series, min_value: float):
    return (values >= min_value).all()


def max_limit(values: pd.Series, max_value: float):
    return (values <= max_value).all()


def valid_matchday(matchday: int):
    return 1 <= matchday <= 38


def valid_season(season: int):
    return 2000 <= season <= 2090


def pytest_configure(config):
    pytest.current_season = current_season
    pytest.data_objects = data_objects
    pytest.data_ids = data_ids
    pytest.is_sorted = is_sorted
    pytest.in_range = in_range
    pytest.min_limit = min_limit
    pytest.max_limit = max_limit
    pytest.valid_matchday = valid_matchday
    pytest.valid_season = valid_season

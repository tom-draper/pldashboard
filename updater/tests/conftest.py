import os
from abc import abstractmethod
from typing import Protocol, TypeVar

import pandas as pd
import pytest
from updater.data import Data
from updater.env import require_env_int
from updater.updater import Updater

pd.set_option('display.max_columns', None)  # Show all columns without truncation
pd.set_option('display.width', None)        # Disable line wrapping (use full width)

CT = TypeVar("CT", bound="Comparable")

# Hitting the live football-data API on every test run is slow, rate-limited and
# makes results depend on the time of day, so it is opt-in.
LIVE_DATA = os.getenv("UPDATER_TEST_LIVE_DATA") == "1"


def _build_data(request_new: bool) -> Data:
    updater = Updater()
    updater.build_all(
        request_new=request_new, display_tables=False, update_db=False
    )
    return updater.data


# DataFrames built from data backups
data_objects: list[Data] = [_build_data(request_new=False)]
data_ids = ["loaded"]

if LIVE_DATA:
    # DataFrames built from live data
    data_objects.append(_build_data(request_new=True))
    data_ids.append("fetched")


current_season = require_env_int("SEASON")


class Comparable(Protocol):
    """Protocol for annotating comparable types."""

    @abstractmethod
    def __ge__(self: CT, other: CT) -> bool:
        pass


def is_sorted(my_list: list[CT]):
    """True if ascending."""
    return all(x <= y for x, y in zip(my_list, my_list[1:]))


def is_sorted_descending(my_list: list[CT]):
    return all(x >= y for x, y in zip(my_list, my_list[1:]))


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
    pytest.is_sorted_descending = is_sorted_descending
    pytest.live_data = LIVE_DATA
    pytest.in_range = in_range
    pytest.min_limit = min_limit
    pytest.max_limit = max_limit
    pytest.valid_matchday = valid_matchday
    pytest.valid_season = valid_season

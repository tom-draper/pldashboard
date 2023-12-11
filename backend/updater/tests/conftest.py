import pytest
from src.data import Data
from src.updater import Updater

current_season = 2023

updater_loaded = Updater(current_season)
updater_loaded.build_all(request_new=False, display_tables=False, update_db=False)

updater_fetched = Updater(current_season)
updater_fetched.build_all(request_new=True, display_tables=False, update_db=False)

data_objects: list[Data] = [updater_loaded.data, updater_fetched.data]
data_ids = ["loaded", "fetched"]


def is_sorted(my_list):
    return all(b >= a for a, b in zip(my_list, my_list[1:]))


def pytest_configure():
    pytest.current_season = current_season
    pytest.data_objects = data_objects
    pytest.data_ids = data_ids
    pytest.is_sorted = is_sorted

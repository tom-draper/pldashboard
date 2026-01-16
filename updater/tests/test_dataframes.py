from datetime import datetime
from types import NoneType

import pytest
from src.updater.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_teams_dfs_filled(data: Data):
    dataframes = [
        data.teams.standings.df,
        data.teams.fixtures.df,
        data.teams.team_ratings.df,
        data.teams.home_advantages.df,
        data.teams.form.df,
        data.teams.upcoming.df,
    ]

    # Check all DataFrames are filled
    assert all([not df.empty for df in dataframes])


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_teams_dfs_index_identical(data: Data):
    dataframes = [
        data.teams.standings.df,
        data.teams.fixtures.df,
        data.teams.team_ratings.df,
        data.teams.home_advantages.df,
        data.teams.form.df,
        data.teams.upcoming.df,
    ]

    pairs = [(dataframes[i], dataframes[i + 1]) for i in range(len(dataframes) - 1)]
    for pair in pairs:
        assert set(pair[0].index.values.tolist()) == set(pair[1].index.values.tolist())


def test_teams_last_updated():
    assert isinstance(pytest.data_objects[0].teams.last_updated, NoneType)
    assert isinstance(pytest.data_objects[1].teams.last_updated, datetime)

from datetime import datetime

import pytest
from src.data import Data
from updater import Updater

current_season = 2023

updater_loaded = Updater(current_season)
updater_loaded.build_all(request_new=False, display_tables=False, update_db=False)

updater_fetched = Updater(current_season)
updater_fetched.build_all(request_new=True, display_tables=True, update_db=False)

data_objects: list[Data] = [updater_loaded.data, updater_fetched.data]
data_ids = ["loaded", "fetched"]


def is_sorted(my_list):
    return all(b >= a for a, b in zip(my_list, my_list[1:]))


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_dfs_filled(data: Data):
    dataframes = [
        data.standings.df,
        data.fixtures.df,
        data.team_ratings.df,
        data.home_advantages.df,
        data.form.df,
        data.upcoming.df,
    ]

    # Check all dataframes are filled
    assert all([not df.empty for df in dataframes])


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_index_identical(data: Data):
    dataframes = [
        data.standings.df,
        data.fixtures.df,
        data.team_ratings.df,
        data.home_advantages.df,
        data.form.df,
        data.upcoming.df,
    ]

    pairs = [(dataframes[i], dataframes[i + 1]) for i in range(len(dataframes) - 1)]
    for pair in pairs:
        assert set(pair[0].index.values.tolist()) == set(pair[1].index.values.tolist())


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_standings_df(data: Data):
    # 20 teams with [4 seasons x 9] columns
    assert data.standings.df.shape[0] == 20
    assert data.standings.df.shape[1] % 4 == 0
    assert data.standings.df.shape[1] % 9 == 0


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_standings_df_not_alphabetical(data: Data):
    # If alphabetical, it means standings dataframe is incorrect
    index = data.standings.df.index.tolist()
    assert not is_sorted(index)


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_fixtures_df(data: Data):
    # 20 teams with [38 matchdays x 5] columns
    assert data.fixtures.df.shape[0] == 20
    assert data.fixtures.df.shape[1] % 5 == 0


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_team_ratings_df(data: Data):
    # 20 teams with 9 columns
    assert data.team_ratings.df.shape == (20, 9)


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_team_ratings_df_not_alphabetical(data: Data):
    # If alphabetical, it means standings dataframe is incorrect
    index = data.team_ratings.df.index.tolist()
    assert not is_sorted(index)


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_home_advantages_df(data: Data):
    # 20 teams with [4 seasons x 5 (+ 1)] columns
    assert data.home_advantages.df.shape[0] == 20
    assert (data.home_advantages.df.shape[1] - 1) % 4 == 0
    assert (data.home_advantages.df.shape[1] - 1) % 5 == 0


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_home_advantages_df_not_alphabetical(data: Data):
    # If alphabetical, it means home advantages  dataframe is incorrect
    index = data.home_advantages.df.index.tolist()
    assert not is_sorted(index)


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_form_df(data: Data):
    # 20 teams with upto 38(x12) matchday columns
    assert data.form.df.shape[0] == 20
    # Maximum of [38 matchday x 12] columns
    assert 0 <= data.form.df.shape[1] <= (38 * 12)
    assert data.form.df.shape[1] % 12 == 0


@pytest.mark.parametrize("matchday_no", [1, 2, 3, 4, 5])
def test_form_df_early_matchdays_(matchday_no: int):
    matchday_cols = list(updater_fetched.data.form.df.columns.levels[0])

    if f"Matchday {matchday_no}" not in matchday_cols:
        return

    matchday = updater_fetched.data.form.df[f"Matchday {matchday_no}"]

    for _, row in matchday.iterrows():
        assert (
            len(row["Teams Played"])
            == len(row["Scores"])
            == len(row["HomeAway"])
            == len(row["Form"])
        )
        assert len(row["Teams Played"]) <= matchday_no
        assert len(row["Scores"]) <= matchday_no
        assert len(row["HomeAway"]) <= matchday_no
        assert len(row["Form"]) <= matchday_no


@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_upcoming_df(data):
    # 20 teams with 6 columns
    assert data.upcoming.df.shape == (20, 6)


def test_last_updated():
    assert isinstance(updater_loaded.data.last_updated, None)
    assert isinstance(updater_fetched.data.last_updated, datetime)

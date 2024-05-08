import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df_shape_teams(data: Data):
    # 20 teams with [4 seasons x 5] columns
    assert data.teams.home_advantages.df.shape[0] == 20


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df_shape_seasons(data: Data):
    # 4 seasons with 5 columns (+ additional column)
    assert (data.teams.home_advantages.df.shape[1] - 1) % 4 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df_shape_columns(data: Data):
    # 5 columns per season (+ additional column)
    assert (data.teams.home_advantages.df.shape[1] - 1) % 5 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df_index_not_sorted(data: Data):
    # Sorted by teams index indicates likely not sorted by total home advantage
    index = data.teams.home_advantages.df.index.tolist()
    assert not pytest.is_sorted(index)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df_sorted_by_total_home_advantages(data: Data):
    # Home advantages should be sorted by total home advantages
    home_advantages = data.teams.df.loc[:, ('HomeAdvantage', None, None)].tolist()
    assert pytest.is_sorted(home_advantages)

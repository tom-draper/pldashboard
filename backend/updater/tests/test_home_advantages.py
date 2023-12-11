import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df(data: Data):
    # 20 teams with [4 seasons x 5 (+ 1)] columns
    assert data.teams.home_advantages.df.shape[0] == 20
    assert (data.teams.home_advantages.df.shape[1] - 1) % 4 == 0
    assert (data.teams.home_advantages.df.shape[1] - 1) % 5 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_home_advantages_df_not_alphabetical(data: Data):
    # If alphabetical, it means home advantages  dataframe is incorrect
    index = data.teams.home_advantages.df.index.tolist()
    assert not pytest.is_sorted(index)

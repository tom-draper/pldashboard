import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df(data: Data):
    # 20 teams with [4 seasons x 9] columns
    assert data.teams.standings.df.shape[0] == 20
    assert data.teams.standings.df.shape[1] % 4 == 0
    assert data.teams.standings.df.shape[1] % 9 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_not_alphabetical(data: Data):
    # If alphabetical, it means standings dataframe is incorrect
    index = data.teams.standings.df.index.tolist()
    assert not pytest.is_sorted(index)

import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_team_ratings_df(data: Data):
    # 20 teams with 9 columns
    assert data.teams.team_ratings.df.shape == (20, 5)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_team_ratings_df_not_alphabetical(data: Data):
    # If alphabetical, it means standings dataframe is incorrect
    index = data.teams.team_ratings.df.index.tolist()
    assert not pytest.is_sorted(index)

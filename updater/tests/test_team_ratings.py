import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape(data: Data):
    # 5 columns with 20 team rows
    assert data.teams.team_ratings.df.shape[0] == (20, 5)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_index_not_sorted(data: Data):
    # Sorted by teams index indicates likely not sorted by total team rating
    index = data.teams.team_ratings.df.index.tolist()
    assert not pytest.is_sorted(index)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_sorted_by_total_rating(data: Data):
    # Ratings should be sorted by total rating
    total_ratings = data.teams.standings.df['total'].tolist()
    assert pytest.is_sorted(total_ratings)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_total_rating_range(data: Data):
    # Total ratings between 0 and 1 inclusive
    total_ratings = data.teams.standings.df['total']
    assert (0 <= total_ratings <= 1).all()
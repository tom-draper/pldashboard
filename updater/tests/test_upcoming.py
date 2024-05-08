import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_upcoming_df_shape(data: Data):
    # 20 teams with 6 columns
    assert data.teams.upcoming.df.shape == (20, 5)

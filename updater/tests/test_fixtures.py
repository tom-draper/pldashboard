import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_fixtures_df(data: Data):
    # 20 teams with [38 matchdays x 5] columns
    assert data.teams.fixtures.df.shape[0] == 20
    assert data.teams.fixtures.df.shape[1] % 5 == 0

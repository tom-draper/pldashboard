import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_teams_shape(data: Data):
    # 20 teams with up to 38(x13) matchday columns in the final season
    assert data.teams.form.df.shape[0] == 20


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_columns_max(data: Data):
    # Maximum of [4 seasons x 38 matchday x 13] columns
    assert (3 * 38 * 13) <= data.teams.form.df.shape[1] <= (4 * 38 * 13)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_columns(data: Data):
    # 13 columns per season per matchday
    assert data.teams.form.df.shape[1] % 13 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_index(data: Data):
    index = set(data.teams.form.df.index)
    teams = data.teams.form.df.loc[:, (pytest.current_season, slice(None), ["team"])]
    for values in teams.values():
        assert len(values) == 20
        assert set(values) == index


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_positions(data: Data):
    positions = data.teams.form.df.loc[:, (slice(None), slice(None), ["position"])]

    for values in positions.values():
        assert len(values.unique()) == 20
        assert min(values) == 1
        assert max(values) == 20

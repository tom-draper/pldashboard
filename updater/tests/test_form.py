import numpy as np
import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_teams_shape(data: Data):
    # 20 teams with up to 38(x13) matchday columns in the final season
    assert data.teams.form.df.shape[0] == 20


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_shape_columns_max(data: Data):
    # Maximum of [4 seasons x 38 matchday x 13] columns
    assert (3 * 38 * 13) <= data.teams.form.df.shape[1] <= (4 * 38 * 13)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_shape_columns(data: Data):
    # 13 columns per season per matchday
    assert data.teams.form.df.shape[1] % 13 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_teams_unique(data: Data):
    # No duplicates in opposition team column
    teams = data.teams.form.df.loc[:, (slice(None), slice(None), ["team"])]
    for col_name in teams.columns:
        col = teams[col_name].dropna()
        if not col.empty:
            assert len(col) == len(np.unique(col))


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_teams_match_index(data: Data):
    # Teams column holds the same teams as the index values
    teams = data.teams.form.df.loc[:, (slice(None), slice(None), ["team"])]
    for col_name in teams.columns:
        col = teams[col_name].dropna()
        if not col.empty:
            season = col_name[0]
            season_teams = data.teams.fixtures.df[
                data.teams.fixtures.df["season"] == season
            ].index
            assert set(np.unique(col)).issubset(set(season_teams))


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_positions_unique(data: Data):
    # Positions across all seasons and matchdays
    positions = data.teams.form.df.loc[:, (slice(None), slice(None), ["position"])]
    for col_name in positions.columns:
        col = positions[col_name].dropna()
        if not col.empty:
            assert len(np.unique(col)) == len(col)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_positions_values(data: Data):
    # Positions across all seasons and matchdays
    positions = data.teams.form.df.loc[:, (slice(None), slice(None), ["position"])]
    expected_position_values = set((i + 1 for i in range(20)))
    for col_name in positions.columns:
        col = positions[col_name].dropna()
        if not col.empty:
            assert set(col).issubset(expected_position_values)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_positions_min(data: Data):
    # Positions across all seasons and matchdays
    positions = data.teams.form.df.loc[:, (slice(None), slice(None), ['position'])]
    assert (positions >= 1).all().all() and (positions <= 20).all().all()


def get_seasons(data: Data):
    seasons = data.teams.form.df.columns.levels[0].tolist()
    return seasons


def get_matchdays(data: Data):
    matchdays = data.teams.form.df.columns.levels[1].tolist()
    return matchdays


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_season_range(data: Data):
    # Seasons in reasonable range
    seasons = get_seasons(data)
    for season in seasons:
        assert pytest.valid_season(season)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df_matchday_range(data: Data):
    # Matchdays in expected range
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        assert pytest.valid_matchday(matchday)
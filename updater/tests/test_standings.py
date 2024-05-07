import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_rows(data: Data):
    # 20 teams rows
    assert data.teams.standings.df.shape[0] == 20


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_seasons(data: Data):
    # 4 seasons each with 9 columns
    assert data.teams.standings.df.shape[1] % 4 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_columns(data: Data):
    # 9 columns for each season
    assert data.teams.standings.df.shape[1] % 9 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_season_columns(data: Data):
    # 4 seasons x 9 columns
    assert data.teams.standings.df.shape[1] == 4 * 9


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_sorted_by_current_season_points(data: Data):
    # Standings should be sorted by points
    seasons = get_seasons(data)
    current_season = max(seasons)
    points = data.teams.standings.df[current_season, 'points'].tolist()
    assert pytest.is_sorted(points)


def get_seasons(data: Data):
    seasons = data.teams.standings.df.columns.levels[0].tolist()
    return seasons


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_teams_not_alphabetical(data: Data):
    # Sorted by teams index indicates not sorted by points
    index = data.teams.standings.df.index.tolist()
    assert not pytest.is_sorted(index)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_multiindex(data: Data):
    # Columns should be multi-index (season, column) tuples
    assert isinstance(data.teams.standings.df.columns, pd.MultiIndex)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_position_unique(data: Data):
    # No duplicates in position column
    seasons = get_seasons(data)
    for season in seasons:
        positions = data.teams.standings.df[season, 'position']
        assert len(positions) == len(positions.unique())


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_position_range(data: Data):
    # Position column in 1 to 20 range
    seasons = get_seasons(data)
    for season in seasons:
        positions = data.teams.standings.df[season, 'position']
        assert (1 <= positions <= 20).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_played_range(data: Data):
    # Played column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        played = data.teams.standings.df[season, 'played']
        assert (0 <= played <= 38).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_won_range(data: Data):
    # Won column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        won = data.teams.standings.df[season, 'won']
        assert (0 <= won <= 38).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_drawn_range(data: Data):
    # Drawn column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        drawn = data.teams.standings.df[season, 'drawn']
        assert (0 <= drawn <= 38).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_lost_range(data: Data):
    # Lost column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        lost = data.teams.standings.df[season, 'lost']
        assert (0 <= lost <= 38).all()
        

@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_gf_non_negative(data: Data):
    # GF column zero or above
    seasons = get_seasons(data)
    for season in seasons:
        gf = data.teams.standings.df[season, 'gF']
        assert (gf >= 0).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_ga_non_negative(data: Data):
    # GA column zero or above
    seasons = get_seasons(data)
    for season in seasons:
        ga = data.teams.standings.df[season, 'gA']
        assert (ga >= 0).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_gd_range(data: Data):
    # GD column in reasonable range
    seasons = get_seasons(data)
    for season in seasons:
        gd = data.teams.standings.df[season, 'gD']
        # +-200 arbitrarily picked as a reasonable limit
        assert (-200 <= gd <= 200).all()


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_season_range(data: Data):
    # Seasons in reasonable range
    seasons = get_seasons(data)
    for season in seasons:
        assert 2000 <= season <= 2090


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_points_range(data: Data):
    # Points column in 0 to 150 range
    seasons = get_seasons(data)
    for season in seasons:
        points = data.teams.standings.df[season, 'points']
        # 150 arbitrarily picked as reasonable limit
        assert (0 <= points <= 150).all()
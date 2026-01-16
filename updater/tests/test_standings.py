import pandas as pd
import pytest
from src.updater.data import Data
# from src.data.dataframes.standings import Standings


# @pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
# def test_get_team_names(data: Data):
#     if data.online:
#         teams = Standings.get_team_names(data.json, data.season)
#         assert isinstance(teams, list)
#         assert len(teams) == 20
#         assert all(isinstance(team, str) for team in teams)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_shape_rows(data: Data):
    # 20 teams rows
    assert data.teams.standings.df.shape[0] == 20


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_shape_seasons(data: Data):
    # 4 seasons each with 9 columns
    assert data.teams.standings.df.shape[1] % 4 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_shape_columns(data: Data):
    # 9 columns for each season
    assert data.teams.standings.df.shape[1] % 9 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_shape_season_columns(data: Data):
    # 4 seasons x 9 columns
    assert data.teams.standings.df.shape[1] == 4 * 9


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_sorted_by_current_season_points(data: Data):
    # Standings should be sorted by points
    seasons = get_seasons(data)
    current_season = max(seasons)
    points = data.teams.standings.df[current_season, 'points'].tolist()
    assert pytest.is_sorted(points)


def get_seasons(data: Data):
    seasons = data.teams.standings.df.columns.levels[0].tolist()
    return seasons


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_index_not_sorted(data: Data):
    # Sorted by teams index indicates likely not sorted by points
    index = data.teams.standings.df.index.tolist()
    assert not pytest.is_sorted(index)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_multiindex(data: Data):
    # Columns should be multi-index (season, column) tuples
    assert isinstance(data.teams.standings.df.columns, pd.MultiIndex)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_position_unique(data: Data):
    # No duplicates in position column
    seasons = get_seasons(data)
    for season in seasons:
        positions = data.teams.standings.df[season, 'position']
        assert len(positions) == len(positions.unique())


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_position_range(data: Data):
    # Position column in 1 to 20 range
    seasons = get_seasons(data)
    for season in seasons:
        positions = data.teams.standings.df[season, 'position']
        assert pytest.in_range(positions, 1, 20)  # checks if within range 1 to 20 inclusive


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_played_range(data: Data):
    # Played column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        played = data.teams.standings.df[season, 'played']
        assert pytest.in_range(played, 0, 38)  # checks if within range 0 to 38 inclusive


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_won_range(data: Data):
    # Won column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        won = data.teams.standings.df[season, 'won']
        assert pytest.in_range(won, 0, 38)  # checks if within range 0 to 38 inclusive


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_drawn_range(data: Data):
    # Drawn column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        drawn = data.teams.standings.df[season, 'drawn']
        assert pytest.in_range(drawn, 0, 38)  # checks if within range 0 to 38 inclusive


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_lost_range(data: Data):
    # Lost column in 0 to 38 range
    seasons = get_seasons(data)
    for season in seasons:
        lost = data.teams.standings.df[season, 'lost']
        assert pytest.in_range(lost, 0, 38)  # checks if within range 0 to 38 inclusive
        

@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_gf_non_negative(data: Data):
    # GF column zero or above
    seasons = get_seasons(data)
    for season in seasons:
        gf = data.teams.standings.df[season, 'gF']
        assert pytest.min_limit(gf, 0)  # checks if all values are >= 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_ga_non_negative(data: Data):
    # GA column zero or above
    seasons = get_seasons(data)
    for season in seasons:
        ga = data.teams.standings.df[season, 'gA']
        assert pytest.min_limit(ga, 0)  # checks if all values are >= 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_gd_range(data: Data):
    # GD column in reasonable range
    seasons = get_seasons(data)
    for season in seasons:
        gd = data.teams.standings.df[season, 'gD']
        # +-200 arbitrarily picked as a reasonable limit
        assert pytest.in_range(gd, -200, 200)  # checks if within range -200 to 200 inclusive


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_season_range(data: Data):
    # Seasons in reasonable range
    seasons = get_seasons(data)
    for season in seasons:
        assert pytest.valid_season(season)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_standings_df_points_range(data: Data):
    # Points column in 0 to 150 range
    seasons = get_seasons(data)
    for season in seasons:
        points = data.teams.standings.df[season, 'points']
        # 150 arbitrarily picked as reasonable limit
        assert pytest.in_range(points, 0, 150)  # checks if within range 0 to 150 inclusive

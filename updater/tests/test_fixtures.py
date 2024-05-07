import pytest
from src.data import Data
from datetime import datetime


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_teams(data: Data):
    # 20 team rows
    assert data.teams.fixtures.df.shape[0] == 20


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_columns(data: Data):
    # 5 columns for each matchday
    assert data.teams.fixtures.df.shape[1] % 5 == 0


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_shape_matchday_columns(data: Data):
    # Up to 38 matchdays x 5 columns
    assert data.teams.fixtures.df.shape[1] <= 5 * 38


def get_matchdays(data: Data):
    matchdays = data.teams.fixtures.df.columns.levels[0].tolist()
    return matchdays


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_teams_sorted(data: Data):
    # Sorted by teams index
    index = data.teams.fixtures.df.index.tolist()
    assert pytest.is_sorted(index)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_multiindex(data: Data):
    # Columns should be multi-index (matchday, column) tuples
    assert isinstance(data.teams.fixtures.df.columns, pd.MultiIndex)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_date_datatype(data: Data):
    # Date column contains datetimes
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        dates = data.teams.fixtures.df[matchday, 'date']
        for date in dates:
            assert isinstance(date, datetime)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_teams_unique(data: Data):
    # No duplicates in opposition team column
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        teams = data.teams.fixtures.df[matchday, 'team']
        assert len(teams) == len(teams.unique())


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_teams_valid(data: Data):
    # Teams column holds the same teams as the index values
    index = data.teams.fixtures.df.index.tolist()
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        teams = data.teams.fixtures.df[matchday, 'team']
        assert set(index) == set(teams.unique())


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_status_datatype(data: Data):
    # Status column contains strings
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        statuses = data.teams.fixtures.df[matchday, 'status']
        for status in statuses:
            assert isinstance(status, str)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_at_home_datatype(data: Data):
    # At home column contains bools
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        at_homes = data.teams.fixtures.df[matchday, 'atHome']
        for at_home in at_homes:
            assert isinstance(at_home, bool)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_score_datatype(data: Data):
    # Score column contains str or None
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        scores = data.teams.fixtures.df[matchday, 'score']
        for score in scores:
            assert isinstance(score, str) or isinstance(score, None)


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_df_score_format(data: Data):
    # Score column contains valid scores
    matchdays = get_matchdays(data)
    for matchday in matchdays:
        scores = data.teams.fixtures.df[matchday, 'score']
        for score in scores:
            if isinstance(score, str):
                assert valid_score(score)


def valid_score(score: str):
    h, middle, a, *rest = score.split(' ')

    if len(rest) > 0:
        return False

    if midddle != "-":
        return False

    if not is_int(h) or not is_int(a):
        return False

    home_goals = int(h)
    if home_goals < 0:
        return False

    away_goals = int(a)
    if away_goals < 0:
        return False
    
    return True


def is_int(s: str):
    if s[0] in ('-', '+'):
        return s[1:].isdigit()
    return s.isdigit()
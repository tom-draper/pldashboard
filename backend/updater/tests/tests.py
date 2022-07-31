import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from updater.updater import Updater

current_season = 2022

updater_old = Updater(current_season)
updater_old.build_all(request_new=False, display_tables=False, update_db=False)

updater_new = Updater(current_season)
updater_new.build_all(request_new=True, display_tables=True, update_db=False)

updater_objects = [updater_old, updater_new]
updater_ids = ["old", "new"]


def is_sorted(my_list):
    return all(b >= a for a, b in zip(my_list, my_list[1:]))


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_dfs_filled(updater):
    dataframes = [updater.data.standings.df,
                  updater.data.fixtures.df,
                  updater.data.team_ratings.df,
                  updater.data.team_ratings.df,
                  updater.data.home_advantages.df,
                  updater.data.form.df,
                  updater.data.upcoming.df,
                  updater.data.season_stats.df]

    # Check all dataframes are filled
    assert all([not df.empty for df in dataframes])


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_index_identical(updater):
    dataframes = [updater.data.standings.df,
                  updater.data.fixtures.df,
                  updater.data.team_ratings.df,
                  updater.data.team_ratings.df,
                  updater.data.home_advantages.df,
                  updater.data.form.df,
                  updater.data.upcoming.df,
                  updater.data.season_stats.df]

    pairs = [(dataframes[i], dataframes[i+1])
             for i in range(len(dataframes)-1)]
    for pair in pairs:
        assert set(pair[0].index.values.tolist()) == set(
            pair[1].index.values.tolist())


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_standings_df(updater):
    # 20 teams with [4 seasons x 9] columns
    assert updater.data.standings.df.shape[0] == 20
    assert updater.data.standings.df.shape[1] % 4 == 0
    assert updater.data.standings.df.shape[1] % 9 == 0


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_standings_df_not_alphabetical(updater):
    # If alphabetical, it means standings dataframe is incorrect
    index = updater.data.standings.df.index.tolist()
    assert (not is_sorted(index))


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_fixtures_df(updater):
    # 20 teams with [38 matchdays x 5] columns
    assert updater.data.fixtures.df.shape[0] == 20
    assert updater.data.fixtures.df.shape[1] % 5 == 0


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_team_ratings_df(updater):
    # 20 teams with 9 columns
    assert updater.data.team_ratings.df.shape == (20, 9)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_team_ratings_df_not_alphabetical(updater):
    # If alphabetical, it means standings dataframe is incorrect
    index = updater.data.team_ratings.df.index.tolist()
    assert (not is_sorted(index))


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_home_advantages_df(updater):
    # 20 teams with [4 seasons x 5 (+ 1)] columns
    assert updater.data.home_advantages.df.shape[0] == 20
    assert (updater.data.home_advantages.df.shape[1] - 1) % 4 == 0
    assert (updater.data.home_advantages.df.shape[1] - 1) % 5 == 0


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_home_advantages_df_not_alphabetical(updater):
    # If alphabetical, it means home advantages  dataframe is incorrect
    index = updater.data.home_advantages.df.index.tolist()
    assert (not is_sorted(index))


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_form_df(updater):
    # 20 teams with upto 38(x13) matchday columns
    assert updater.data.form.df.shape[0] == 20
    # Maximum of [38 matchday x 13] columns
    assert 0 <= updater.data.form.df.shape[1] <= (38*13)
    assert updater.data.form.df.shape[1] % 13 == 0


@pytest.mark.parametrize("matchday_no", [1, 2, 3, 4, 5])
def test_form_df_early_matchdays_(matchday_no):
    matchday_cols = list(updater_new.data.form.df.columns.levels[0])

    if f'Matchday {matchday_no}' in matchday_cols:
        matchday = updater_new.data.form.df[f'Matchday {matchday_no}']

        for _, row in matchday.iterrows():
            assert len(row['Teams Played']) == len(row['Scores']) == len(row['HomeAway']) == len(row['Form'])
            assert len(row['Teams Played']) <= matchday_no
            assert len(row['Scores']) <= matchday_no
            assert len(row['HomeAway']) <= matchday_no
            assert len(row['Form']) <= matchday_no


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_upcoming_df(updater):
    # 20 teams with 6 columns
    assert updater.data.upcoming.df.shape == (20, 4)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_season_stats_df(updater):
    # 20 teams with 4 columns
    assert updater.data.season_stats.df.shape == (20, 4)


def test_last_updated():
    assert type(updater_old.last_updated) == type(None)
    assert type(updater_new.last_updated) == str

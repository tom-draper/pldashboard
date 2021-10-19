import pytest

from updater import Updater


current_season = 2021

updater_old = Updater(current_season)
updater_old.update_all(request_new=False, display_tables=False)

updater_new = Updater(current_season)
updater_new.update_all(request_new=True, display_tables=False)

# Requesting new data immediately after data_new should attempt recovery and use old data instead
updater_failed_refresh = Updater(current_season)
updater_failed_refresh.update_all(request_new=True, display_tables=False)

updater_objects = [updater_old, updater_new, updater_failed_refresh]
updater_ids = ["old", "new", "failed refresh"]


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
                  updater.data.position_over_time.df,
                  updater.data.upcoming.df,
                  updater.data.season_stats.df]

    # Check all dataframes are filled
    assert all([not df.empty for df in dataframes])


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_standings_df(updater):
    # 20 teams with [3 seasons x 9] columns
    assert updater.data.standings.df.shape == (20, 27)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_fixtures_df(updater):
    # 20 teams with [38 matchdays x 5] columns
    assert updater.data.fixtures.df.shape == (20, 190)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_team_ratings_df(updater):
    # 20 teams with 7 columns
    assert updater.data.team_ratings.df.shape == (20, 7)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_team_ratings_df_not_alphabetical(updater):
    # If alphabetical, it means standings dataframe is incorrect
    index = updater.data.team_ratings.df.index.tolist()
    assert(not is_sorted(index))


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_home_advantages_df(updater):
    # 20 teams with [3 seasons x 11 + 1] columns
    assert updater.data.home_advantages.df.shape == (20, 34)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_form_df(updater):
    # 20 teams with upto 38(x8) matchday columns
    assert updater.data.form.df.shape[0] == 20
    assert updater.data.form.df.shape[1] % 8 == 0
    # Maximum of [38 matchday x 8] columns
    assert 0 <= updater.data.form.df.shape[1] <= (38*8)


@pytest.mark.parametrize("matchday_no", [1, 2, 3, 4, 5])
def test_form_df_early_matchdays_(matchday_no):
    matchday_cols = list(updater_new.data.form.df.columns.levels[0])

    if f'Matchday {matchday_no}' in matchday_cols:
        matchday = updater_new.data.form.df[f'Matchday {matchday_no}']

        for _, row in matchday.iterrows():
            print(row)
            assert len(row['Teams Played']) == len(row['Scores']) == len(
                row['HomeAway']) == len(row['Form'])

            assert len(row['Teams Played']) <= matchday_no
            assert len(row['Scores']) <= matchday_no
            assert len(row['HomeAway']) <= matchday_no
            assert len(row['Form']) <= matchday_no


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_position_over_time_df(updater):
    # 20 teams with up to 38(x6) matchday columns
    assert updater.data.position_over_time.df.shape[0] == 20
    assert updater.data.position_over_time.df.shape[1] % 6
    # Maximum of [38 matchday x 6] columns
    assert 0 <= updater.data.position_over_time.df.shape[1] <= (38*6)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_upcoming_df(updater):
    # 20 teams with 3 columns
    assert updater.data.upcoming.df.shape == (20, 4)


@pytest.mark.parametrize("updater", updater_objects, ids=updater_ids)
def test_season_stats_df(updater):
    # 20 teams with 3 columns
    assert updater.data.season_stats.df.shape == (20, 3)

from data import Data
import pytest


current_season = 2021

data_old = Data(current_season)
data_old.update_all(request_new=False, display_tables=False)

data_new = Data(current_season)
data_new.update_all(request_new=True, display_tables=False)

# Requesting new data immediately after data_new should attempt recovery and use old data instead
data_failed_refresh = Data(current_season)
data_failed_refresh.update_all(request_new=True, display_tables=False)

data_objects = [data_old, data_new, data_failed_refresh]
data_ids = ["old", "new", "failed refresh"]


def is_sorted(my_list):
    return all(b >= a for a, b in zip(my_list, my_list[1:]))

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_dfs_filled(data):
    dataframes = [data.standings.df, 
                  data.fixtures.df, 
                  data.team_ratings.df, 
                  data.team_ratings.df, 
                  data.home_advantages.df, 
                  data.form.df, 
                  data.position_over_time.df, 
                  data.next_games.df, 
                  data.season_stats.df]

    # Check all dataframes are filled
    assert all([not df.empty for df in dataframes])

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_standings_df(data):
    # 20 teams with [3 seasons x 9 ] columns
    assert data.standings.df.shape == (20, 27)
    
@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_fixtures_df(data):
    # 20 teams with [38 matchdays x 5] columns
    assert data.fixtures.df.shape == (20, 190)

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_team_ratings_df(data):
    # 20 teams with 7 columns
    assert data.team_ratings.df.shape == (20, 7)
    
@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_team_ratings_df_not_alphabetical(data):
    # If alphabetical, it means standings dataframe is incorrect
    index = data.team_ratings.df.index.tolist()
    assert(not is_sorted(index))

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_home_advantages_df(data):
    # 20 teams with [3 seasons x 11 + 1] columns
    assert data.home_advantages.df.shape == (20, 34)

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_form_df(data):
    # 20 teams with upto 38(x8) matchday columns
    assert data.form.df.shape[0] == 20
    assert data.form.df.shape[1] % 8 == 0
    # Maximum of [38 matchday x 8] columns
    assert data.form.df.shape[1] <= (38*8)

@pytest.mark.parametrize("matchday_no", [1, 2, 3, 4, 5])
def test_form_df_early_matchdays_(matchday_no):
    matchday_cols = list(data_new.form.df.columns.levels[0])
    
    if f'Matchday {matchday_no}' in matchday_cols:
        matchday = data_new.form.df[f'Matchday {matchday_no}']
        
        for _, row in matchday.iterrows():
            print(row)
            assert len(row['Teams Played']) == len(row['Scores']) == len(row['HomeAway']) == len(row['Form'])
            
            assert len(row['Teams Played']) <= matchday_no
            assert len(row['Scores']) <= matchday_no
            assert len(row['HomeAway']) <= matchday_no
            assert len(row['Form']) <= matchday_no
    
    

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_position_over_time_df(data):
    # 20 teams with up to 38 matchday columns
    assert data.position_over_time.df.shape[0] == 20
    assert 0 <= data.position_over_time.df.shape[1] <= 38

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_next_games_df(data):
    # 20 teams with 3 columns
    assert data.next_games.df.shape == (20, 4)

@pytest.mark.parametrize("data", data_objects, ids=data_ids)
def test_season_stats_df(data):
    # 20 teams with 3 columns
    assert data.season_stats.df.shape == (20, 3)

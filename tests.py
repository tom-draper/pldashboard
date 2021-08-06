
from data import Data

current_season = 2021


def test_dataframe_creation():
    data = Data(current_season)
    data.updateAll(request_new=True, display_tables=False)

    dataframes = [data.standings.df, data.fixtures.df, data.team_ratings.df, data.team_ratings.df,
                  data.home_advantages.df, data.form.df, data.position_over_time.df, data.next_games.df, data.season_stats.df]

    # Check all dataframes are filled
    assert all([not df.empty for df in dataframes])

    # 20 teams with [3 seasons x 9 + 1] columns
    assert data.standings.df.shape == (20, 28)

    # 20 teams with [38 matchdays x 5] columns
    assert data.fixtures.df.shape == (20, 190)

    # 20 teams with 7 columns
    assert data.team_ratings.df.shape == (20, 7)

    # 20 teams with [3 seasons x 11 + 1] columns
    assert data.home_advantages.df.shape == (20, 34)

    # 20 teams with 38 matchday columns
    print(data.form.df)
    assert data.form.df.shape == (20, 38)

    # 20 teams with up to 38 matchday columns
    assert data.position_over_time.df.shape[0] == 20
    assert 0 <= data.position_over_time.df.shape[1] <= 38

    # 20 teams with 3 columns
    assert data.next_games.df.shape == (20, 3)

    # 20 teams with 3 columns
    assert data.season_stats.df.shape == (20, 3)

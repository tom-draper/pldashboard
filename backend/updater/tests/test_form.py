import pytest
from src.data import Data


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_form_df(data: Data):
    # 20 teams with up to 38(x13) matchday columns in the final season
    assert data.teams.form.df.shape[0] == 20
    # Maximum of [4 seasons x 38 matchday x 13] columns
    assert (3 * 38 * 13) <= data.teams.form.df.shape[1] <= (4 * 38 * 13)
    assert data.teams.form.df.shape[1] % 13 == 0


@pytest.mark.parametrize("matchday_no", [1, 2, 3, 4, 5])
def test_form_df_early_matchdays(matchday_no: int):
    matchday_cols = list(pytest.data_objects[1].teams.form.df.columns.levels[0])

    if f"Matchday {matchday_no}" not in matchday_cols:
        return

    matchday = pytest.data_objects[1].teams.form.df[f"Matchday {matchday_no}"]

    for _, row in matchday.iterrows():
        assert (
            len(row["Teams Played"])
            == len(row["Scores"])
            == len(row["HomeAway"])
            == len(row["Form"])
        )
        assert len(row["Teams Played"]) <= matchday_no
        assert len(row["Scores"]) <= matchday_no
        assert len(row["HomeAway"]) <= matchday_no
        assert len(row["Form"]) <= matchday_no

from datetime import datetime

import pandas as pd
import pytest

from updater.data import Data
from updater.data.dataframes.upcoming import Upcoming
from updater.predictions.scoreline import Scoreline


@pytest.mark.parametrize("data", pytest.data_objects, ids=pytest.data_ids)
def test_upcoming_df_shape(data: Data):
    # 20 teams with 6 columns
    assert data.teams.upcoming.df.shape == (20, 5)


def test_get_predictions_skips_teams_without_a_remaining_fixture():
    upcoming = Upcoming(
        pd.DataFrame(
            {
                "date": [datetime(2026, 8, 15), None],
                "atHome": [True, None],
                "team": ["Chelsea", None],
                "prediction": [Scoreline(1, 0, "Arsenal", "Chelsea"), None],
            },
            index=["Arsenal", "Liverpool"],
        )
    )

    predictions = upcoming.get_predictions()

    assert set(predictions) == {"Arsenal"}
    assert predictions["Arsenal"]["prediction"] == {"homeGoals": 1, "awayGoals": 0}

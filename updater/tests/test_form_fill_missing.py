"""Covers the carry-forward path for teams with no completed match.

Real backup data currently has no gaps, so this behaviour is exercised with a
synthetic frame. The previous implementation overwrote *every* team's values
whenever any team was missing a matchday.
"""

import numpy as np
import pandas as pd

from updater.data.dataframes.form import Form

SEASON = 2025
FIELDS = ("team", "cumGD", "cumPoints", "form5", "form10", "formRating5", "formRating10")


def _frame(teams, matchdays):
    columns = pd.MultiIndex.from_tuples(
        [(SEASON, matchday, field) for matchday in matchdays for field in FIELDS]
    )
    df = pd.DataFrame(index=list(teams), columns=columns, dtype=object)
    for matchday in matchdays:
        for i, team in enumerate(teams):
            df.loc[team, (SEASON, matchday, "team")] = f"OPP{i}"
            df.loc[team, (SEASON, matchday, "cumGD")] = float(matchday * 10 + i)
            df.loc[team, (SEASON, matchday, "cumPoints")] = float(matchday * 3 + i)
            df.loc[team, (SEASON, matchday, "form5")] = f"W{matchday}"
            df.loc[team, (SEASON, matchday, "form10")] = f"L{matchday}"
            df.loc[team, (SEASON, matchday, "formRating5")] = 0.5 + matchday / 100
            df.loc[team, (SEASON, matchday, "formRating10")] = 0.4 + matchday / 100
    return df


def test_missing_team_carries_previous_matchday_forward():
    df = _frame(["A", "B", "C"], [1, 2])
    # Team B did not play matchday 2
    for field in FIELDS:
        df.loc["B", (SEASON, 2, field)] = np.nan

    Form()._fill_teams_missing_matchday(df)

    assert df.loc["B", (SEASON, 2, "cumGD")] == df.loc["B", (SEASON, 1, "cumGD")]
    assert df.loc["B", (SEASON, 2, "cumPoints")] == df.loc["B", (SEASON, 1, "cumPoints")]
    assert df.loc["B", (SEASON, 2, "form5")] == df.loc["B", (SEASON, 1, "form5")]


def test_teams_that_played_keep_their_own_values():
    """The regression: one missing team must not clobber the others."""
    df = _frame(["A", "B", "C"], [1, 2])
    for field in FIELDS:
        df.loc["B", (SEASON, 2, field)] = np.nan

    expected = {
        team: {col: df.loc[team, (SEASON, 2, col)] for col in ("cumGD", "cumPoints", "form5")}
        for team in ("A", "C")
    }

    Form()._fill_teams_missing_matchday(df)

    for team, cols in expected.items():
        for col, value in cols.items():
            assert df.loc[team, (SEASON, 2, col)] == value, (
                f"{team} matchday 2 {col} was overwritten"
            )


def test_no_missing_teams_is_a_no_op():
    df = _frame(["A", "B"], [1, 2])
    before = df.copy(deep=True)

    Form()._fill_teams_missing_matchday(df)

    pd.testing.assert_frame_equal(df, before)


def test_first_matchday_has_nothing_to_carry_forward():
    df = _frame(["A", "B"], [1, 2])
    for field in FIELDS:
        df.loc["A", (SEASON, 1, field)] = np.nan

    Form()._fill_teams_missing_matchday(df)

    # Still missing: there is no earlier matchday to copy from
    assert pd.isna(df.loc["A", (SEASON, 1, "cumGD")])

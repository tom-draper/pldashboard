import pandas as pd
import pytest

from updater.data.dataframes.form import Form


@pytest.mark.parametrize(
    ("accessor", "expected"),
    [
        ("get_current_form_rating", 62.0),
        ("get_long_term_form_rating", 48.0),
    ],
)
def test_form_rating_accessors_use_their_window(accessor, expected):
    season = 2025
    columns = pd.MultiIndex.from_tuples(
        [
            (season, matchday, name)
            for matchday in (1, 2)
            for name in ("score", "formRating5", "formRating10")
        ]
    )
    data = pd.DataFrame(
        [["1-0", 0.5, 0.4, "2-1", 0.62, 0.48]],
        index=["Team"],
        columns=columns,
    )

    assert getattr(Form(data), accessor)("Team") == expected

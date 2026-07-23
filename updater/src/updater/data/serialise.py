"""Conversion of the built DataFrames into the JSON the dashboard consumes.

This is the wire format, so the rules are stated explicitly here rather than
inferred by walking the output:

- A column's MultiIndex levels become nested dict keys, outermost level first.
- Blank levels ("") are padding from ragged MultiIndexes and are dropped.
- All keys are strings, since JSON object keys are strings.
- NaN/NaT become None, and Scoreline objects are unpacked.

Keeping this separate from the DataFrames means their internal layout can change
without changing what the dashboard receives.
"""

import math
from typing import Any

import pandas as pd
from pandas import DataFrame

from updater.predictions.scoreline import Scoreline

# Fields kept for seasons before the current one. Everything the dashboard reads
# for a past season comes from this set; the other nine fields per matchday were
# most of the payload.
#
#   score, atHome  spider-graph win streaks, consistency, clean sheets, and
#                  scoreline frequencies
#   date           ScoredConcededOverTimeGraph, for season boundary positions
#   team           spider-graph vsBig6, to identify the opposition
#
# Anything added to a past-season code path in the dashboard must be added here
# too, or it will arrive undefined.
PAST_SEASON_FORM_FIELDS = frozenset({"score", "atHome", "date", "team"})


def clean_value(value: Any):
    """Convert a single DataFrame cell into something JSON-serialisable."""
    if isinstance(value, Scoreline):
        return value.to_dict()
    if value is None or value is pd.NaT or value is pd.NA:
        return None
    # bool is a subclass of int, and numpy floats subclass float, so check the
    # NaN case by value rather than by type name.
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, dict):
        return {str(k): clean_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        # Built fresh rather than mutated in place: these lists are still held
        # by the DataFrame.
        return [clean_value(v) for v in value]
    return value


def column_path(column: Any) -> tuple[str, ...]:
    """The nested dict key path for a column label."""
    levels = column if isinstance(column, tuple) else (column,)
    return tuple(str(level) for level in levels if level != "")


def to_nested_dict(df: DataFrame) -> dict[str, Any]:
    """Nest a DataFrame into {row: {level: {level: value}}} by column path."""
    paths = [column_path(column) for column in df.columns]

    records: dict[str, Any] = {}
    for row_label, row in zip(df.index, df.to_numpy(dtype=object)):
        record: dict[str, Any] = {}
        for path, value in zip(paths, row):
            node = record
            for key in path[:-1]:
                node = node.setdefault(key, {})
            node[path[-1]] = clean_value(value)
        records[str(row_label)] = record
    return records


def form_to_dict(df: DataFrame) -> dict[str, Any]:
    """Nest the form DataFrame, trimming past seasons to the fields in use."""
    current_season = max(df.columns.get_level_values(0))

    keep = [
        column
        for column in df.columns
        if column[0] == current_season or column[2] in PAST_SEASON_FORM_FIELDS
    ]
    return to_nested_dict(df[keep])

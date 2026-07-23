"""Prediction engines.

Two of them, named for what they are rather than the order they were written:

    * `form_predictor.FormPredictor` - the heuristic that weights a team's
      recent scorelines by form, opposition rating and home advantage. Used by
      the `upcoming` DataFrame.
    * `model_predictions.build_model_predictions` - fits one of the engines in
      `predictions.models` and shapes the upcoming matchday into the documents
      stored for the dashboard.

Import the concrete module you need directly rather than re-exporting here:
form_predictor pulls in the data frames, which pull in upcoming.py, which
imports form_predictor again, so an eager re-export at package load creates a
cycle.
"""

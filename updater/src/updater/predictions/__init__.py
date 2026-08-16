"""Prediction engines.

Two of them, named for what they are rather than the order they were written:

    * `form_predictor.FormPredictor` - the heuristic that weights a team's
      recent scorelines by form, opposition rating and home advantage. Used by
      the `upcoming` DataFrame.
    * `model_predictions.build_model_predictions` - fits one of the engines in
      `predictions.models` and shapes the upcoming matchday into the documents
      stored for the dashboard.

Import the concrete module you need directly rather than re-exporting here.
form_predictor pulls in the DataFrame package, which reaches upcoming.py, which
needs FormPredictor back; upcoming.py defers that import so the cycle no longer
bites, but an eager re-export at package load would reintroduce it.
"""

"""Backtest harness comparing the prediction engines against each other.

Both families compete here on equal terms. The `models.scoreline` engines predict
a full goal matrix and have their home/draw/away read off it; the `models.outcome`
engines predict home/draw/away directly and never commit to a scoreline. Since
RPS only ever looks at the three outcome probabilities, the comparison is exactly
like for like, and the `family` column says which kind produced each row.

An analysis tool, not part of the production build. It replays a past season one
matchday at a time, refitting each model only on matches that finished *before*
that matchday (no leakage) and scoring the predictions with proper metrics:

    * RPS   - ranked probability score over the ordered home/draw/away outcome
              (lower is better; the standard football forecasting metric, and the
              one to select on)
    * log-loss - negative log probability assigned to the actual outcome
    * ECE   - expected calibration error: do the stated probabilities happen at
              the stated rate? (lower is better). Read it alongside RPS, never
              alone: the base-rate baseline scores a perfect 0 here by
              construction, since quoting the season's own outcome frequencies
              is flawlessly calibrated and completely uninformative.
    * outcome accuracy - share of matches whose most likely outcome was right
    * exact-score accuracy - share whose most likely scoreline was exactly right.
              Low for everyone by nature: the true scoreline distribution is flat
              enough that even a perfect model rarely tops ~13%, so this is a
              weak basis for choosing between models. Shown as n/a for the
              outcome family, which never names a scoreline to be judged on.

Every model is compared against a base-rate baseline (the season's own
home/draw/away frequencies) so the numbers have a reference point. Run with::

    python -m updater.predictions.backtest
    python -m updater.predictions.backtest --models dixon-coles,ordered-logit
    python -m updater.predictions.backtest --family outcome
    python -m updater.predictions.backtest --sweep --models dixon-coles
    python -m updater.predictions.backtest --seasons 2023,2024,2025

The package is split by job: `data` loads finished matches from the backups,
`metrics` turns forecasts into scores, `harness` replays a season without
leakage, `report` renders the table, and `__main__` is the command line. This
module re-exports the pieces callers and tests already import by name.
"""

from updater.predictions.backtest.data import (
    SeasonMatch,
    latest_complete_season,
    load_matches,
)
from updater.predictions.backtest.harness import backtest
from updater.predictions.backtest.metrics import (
    Disagreement,
    Metrics,
    PairedComparison,
    disagreement,
    paired_rps_difference,
    ranked_probability_score,
)
from updater.predictions.backtest.report import format_table

__all__ = [
    "Disagreement",
    "Metrics",
    "PairedComparison",
    "SeasonMatch",
    "backtest",
    "disagreement",
    "format_table",
    "latest_complete_season",
    "load_matches",
    "paired_rps_difference",
    "ranked_probability_score",
]

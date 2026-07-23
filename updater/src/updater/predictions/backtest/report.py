"""Rendering scored metrics as the leaderboard table."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from updater.predictions.backtest.metrics import (
    Metrics,
    paired_rps_difference,
)


def format_table(rows: Sequence[Metrics]) -> str:
    """Leaderboard sorted by RPS, the metric worth selecting on.

    `vs best` is the paired RPS gap to the leader with a 95% interval; a `*`
    marks a gap that clears it. Models without a `*` are not distinguishable
    from the leader on this sample, however their point estimates are ordered.
    """
    ordered = sorted(rows, key=lambda r: r.rps)
    best = ordered[0]

    header = (
        f"{'model':<24}{'family':<10}{'n':>6}{'RPS':>10}{'vs best':>18}"
        f"{'logloss':>10}{'ECE':>8}{'outcome':>9}{'exact':>8}"
    )
    lines = [header, "-" * len(header)]
    for m in ordered:
        comparison = str(paired_rps_difference(m, best))
        exact = m.exact_score_accuracy
        exact_cell = "n/a" if np.isnan(exact) else f"{exact:.3f}"
        lines.append(
            f"{m.label:<24}{m.family:<10}{m.n:>6}{m.rps:>10.4f}{comparison:>18}"
            f"{m.log_loss:>10.4f}{m.calibration_error:>8.4f}"
            f"{m.outcome_accuracy:>9.3f}{exact_cell:>8}"
        )
    return "\n".join(lines)

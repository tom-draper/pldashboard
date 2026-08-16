"""Replaying past seasons matchday by matchday, without leakage."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Optional

from updater.predictions import models as model_registry
from updater.predictions.backtest.data import SeasonMatch
from updater.predictions.backtest.metrics import Metrics
from updater.predictions.distributions import match_outcome
from updater.predictions.models import (
    FittedModel,
    Predictor,
    predict_fixture,
    predict_outcome,
    produces_scoreline,
)


def backtest(
    matches: list[SeasonMatch],
    predictors: Sequence[Predictor],
    seasons: Sequence[int],
    labels: Optional[Sequence[str]] = None,
    min_train: int = 200,
    train_window_days: float = 1300.0,
    progress: bool = False,
) -> list[Metrics]:
    """Score each predictor, plus a base-rate baseline, over `seasons`.

    Each matchday is predicted from a rolling window of the prior
    `train_window_days` of results (~3.5 seasons), which bounds the fit cost and
    keeps stale, long-relegated teams out of the ratings. Models are refit once
    per ISO week on everything that finished before that week started, so a whole
    round is predicted from data available before it kicked off.

    A full multi-model run refits every engine once per week of every season and
    takes tens of minutes, so `progress` reports weeks completed on stderr,
    keeping the table itself clean on stdout.
    """
    window = timedelta(days=train_window_days)
    test = [m for m in matches if m.season in set(seasons)]
    if not test:
        raise ValueError(f"No matches found for seasons {sorted(seasons)}")

    labels = list(labels) if labels else [p.name for p in predictors]

    # Base rate uses the tested seasons' own outcome frequencies as a reference.
    # It is the most generous possible baseline: it has seen the results already.
    base_counts = [0, 0, 0]
    for m in test:
        base_counts[match_outcome(m.result.home_goals, m.result.away_goals)] += 1
    base_probs: tuple[float, float, float] = (
        base_counts[0] / len(test),
        base_counts[1] / len(test),
        base_counts[2] / len(test),
    )

    baseline = Metrics(label="baseline (base rate)")
    results = [
        Metrics(label=label, family=model_registry.family_of(predictor.name))
        for predictor, label in zip(predictors, labels)
    ]

    # One cache per predictor, keyed by the week whose fixtures it predicts.
    caches: list[dict[datetime, Optional[FittedModel]]] = [{} for _ in predictors]

    # Weeks are only known once the fixtures are walked, so the total for the
    # progress line is counted up front rather than guessed from the season.
    total_weeks = len(
        {
            (m.result.date - timedelta(days=m.result.date.weekday())).date()
            for m in test
        }
    )
    weeks_done = 0

    for match in test:
        match_date = match.result.date
        week_start = (match_date - timedelta(days=match_date.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        train = [
            m.result for m in matches if week_start - window < m.result.date < week_start
        ]
        if len(train) < min_train:
            continue

        if progress and week_start not in caches[0]:
            weeks_done += 1
            print(
                f"  week {weeks_done}/{total_weeks} ({week_start.date()}), "
                f"training on {len(train)} matches",
                file=sys.stderr,
                flush=True,
            )

        actual = match_outcome(match.result.home_goals, match.result.away_goals)
        scored_any = False

        for predictor, cache, metrics in zip(predictors, caches, results):
            if week_start not in cache:
                cache[week_start] = predictor.fit(train)
            model = cache[week_start]
            if model is None:
                continue

            # Promoted sides with no prior matches fall back to each model's weak
            # prior (as in production), so every fixture is scored, not just the
            # ones between established teams. The kickoff date is known before
            # the match, so passing it to the models that use it (rest days) is
            # information they would genuinely have, not leakage.
            # A scoreline model is asked for its matrix, so exact-score accuracy
            # can be judged too; an outcome model has no matrix and is asked
            # only for the three probabilities. Both end up scored on the same
            # RPS, which is what makes the families comparable.
            if produces_scoreline(model):
                pred = predict_fixture(
                    model,
                    match.result.home_team,
                    match.result.away_team,
                    match_date=match.result.date,
                )
                probs = (pred.prob_home_win, pred.prob_draw, pred.prob_away_win)
                exact_hit = (
                    pred.predicted_home_goals == match.result.home_goals
                    and pred.predicted_away_goals == match.result.away_goals
                )
            else:
                probs = predict_outcome(
                    model,
                    match.result.home_team,
                    match.result.away_team,
                    match_date=match.result.date,
                ).probs
                exact_hit = None

            metrics.add(probs, actual, exact_hit=exact_hit)
            scored_any = True

        if scored_any:
            baseline.add(base_probs, actual)

    if baseline.n == 0:
        raise ValueError("No matches had enough prior data to score")

    return [baseline] + results

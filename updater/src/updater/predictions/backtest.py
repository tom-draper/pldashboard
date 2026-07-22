"""Backtest harness for the v3 Dixon-Coles engine.

An analysis tool, not part of the production build. It replays a past season one
matchday at a time, refitting the model only on matches that finished *before*
each matchday (no leakage) and scoring the predictions with proper metrics:

    * RPS   - ranked probability score over the ordered home/draw/away outcome
              (lower is better; the standard football forecasting metric)
    * log-loss - negative log probability assigned to the actual outcome
    * outcome accuracy - share of matches whose most likely outcome was right
    * exact-score accuracy - share whose most likely scoreline was exactly right

Results are compared against a base-rate baseline (the season's own home/draw/away
frequencies) so the numbers have a reference point. Run with::

    python -m updater.predictions.backtest [--half-life DAYS] [--season YEAR]
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from updater.env import BACKUPS_DIR
from updater.predictions.predict_v3 import (
    DixonColesModel,
    MatchResult,
    fit_dixon_coles,
)


@dataclass
class SeasonMatch:
    season: int
    result: MatchResult


def _parse_date(utc_date: str) -> datetime:
    return datetime.fromisoformat(utc_date.replace("Z", "+00:00")).astimezone(
        timezone.utc
    )


def load_matches(backups_dir: Path = BACKUPS_DIR) -> list[SeasonMatch]:
    """Every finished league match across all backup seasons, oldest first."""
    matches: list[SeasonMatch] = []
    for path in sorted((backups_dir / "fixtures").glob("fixtures_*.json")):
        season = int(path.stem.split("_")[1])
        for match in json.loads(path.read_text()):
            if match.get("status") != "FINISHED":
                continue
            # football-data renamed the score keys (homeTeam/awayTeam -> home/away)
            # partway through these backups, so accept either.
            full_time = match["score"]["fullTime"]
            home_goals = full_time.get("homeTeam", full_time.get("home"))
            away_goals = full_time.get("awayTeam", full_time.get("away"))
            if home_goals is None or away_goals is None:
                continue
            matches.append(
                SeasonMatch(
                    season=season,
                    result=MatchResult(
                        date=_parse_date(match["utcDate"]),
                        home_team=match["homeTeam"]["name"],
                        away_team=match["awayTeam"]["name"],
                        home_goals=int(home_goals),
                        away_goals=int(away_goals),
                    ),
                )
            )
    matches.sort(key=lambda m: m.result.date)
    return matches


def outcome(home_goals: int, away_goals: int) -> int:
    """0 = home win, 1 = draw, 2 = away win."""
    if home_goals > away_goals:
        return 0
    if home_goals == away_goals:
        return 1
    return 2


def ranked_probability_score(probs: tuple[float, float, float], actual: int) -> float:
    """RPS for the ordered [home, draw, away] outcome."""
    cumulative_pred = 0.0
    cumulative_obs = 0.0
    total = 0.0
    for i in range(2):  # r - 1 terms, r = 3 outcomes
        cumulative_pred += probs[i]
        cumulative_obs += 1.0 if actual == i else 0.0
        total += (cumulative_pred - cumulative_obs) ** 2
    return total / 2.0


def _latest_complete_season(matches: list[SeasonMatch], min_matches: int = 300) -> int:
    counts: dict[int, int] = {}
    for match in matches:
        counts[match.season] = counts.get(match.season, 0) + 1
    complete = [season for season, count in counts.items() if count >= min_matches]
    return max(complete) if complete else max(counts)


@dataclass
class Metrics:
    n: int
    rps: float
    log_loss: float
    outcome_accuracy: float
    exact_score_accuracy: float

    def __str__(self) -> str:
        return (
            f"n={self.n}  RPS={self.rps:.4f}  logloss={self.log_loss:.4f}  "
            f"outcome_acc={self.outcome_accuracy:.3f}  "
            f"exact_acc={self.exact_score_accuracy:.3f}"
        )


def backtest(
    matches: list[SeasonMatch],
    season: int,
    half_life_days: float = 180.0,
    min_train: int = 200,
    train_window_days: float = 1300.0,
    xg_weight: float = 0.0,
) -> tuple[Metrics, Metrics]:
    """Score the model and a base-rate baseline over `season`'s matches.

    Each matchday is predicted from a rolling window of the prior
    `train_window_days` of results (~3.5 seasons), which bounds the fit cost and
    keeps stale, long-relegated teams out of the ratings.
    """
    window = timedelta(days=train_window_days)
    test = [m for m in matches if m.season == season]
    if not test:
        raise ValueError(f"No matches found for season {season}")

    # Base rate uses the tested season's own outcome frequencies as a reference.
    base_counts = [0, 0, 0]
    for m in test:
        base_counts[outcome(m.result.home_goals, m.result.away_goals)] += 1
    base_probs: tuple[float, float, float] = (
        base_counts[0] / len(test),
        base_counts[1] / len(test),
        base_counts[2] / len(test),
    )

    model_rps = model_ll = model_out = model_exact = 0.0
    base_rps = base_ll = base_out = 0.0
    scored = 0

    # Refit once per ISO week, trained on everything before that week starts, so
    # a whole round is predicted from data available before it kicked off.
    model_cache: dict[datetime, Optional[DixonColesModel]] = {}
    for match in test:
        match_date = match.result.date
        week_start = (match_date - timedelta(days=match_date.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        train = [
            m.result
            for m in matches
            if week_start - window < m.result.date < week_start
        ]
        if len(train) < min_train:
            continue

        if week_start not in model_cache:
            model_cache[week_start] = fit_dixon_coles(
                train, half_life_days=half_life_days, xg_weight=xg_weight
            )
        model = model_cache[week_start]
        if model is None:
            continue

        # Promoted sides with no prior matches fall back to the model's weak
        # prior (as in production), so every fixture is scored, not just the
        # ones between established teams.
        pred = model.predict(match.result.home_team, match.result.away_team)
        actual = outcome(match.result.home_goals, match.result.away_goals)
        probs = (pred.prob_home_win, pred.prob_draw, pred.prob_away_win)

        model_rps += ranked_probability_score(probs, actual)
        model_ll += -_safe_log(probs[actual])
        model_out += 1.0 if _argmax(probs) == actual else 0.0
        model_exact += 1.0 if (
            pred.predicted_home_goals == match.result.home_goals
            and pred.predicted_away_goals == match.result.away_goals
        ) else 0.0

        base_rps += ranked_probability_score(base_probs, actual)
        base_ll += -_safe_log(base_probs[actual])
        base_out += 1.0 if _argmax(base_probs) == actual else 0.0
        scored += 1

    if scored == 0:
        raise ValueError("No matches had enough prior data to score")

    model_metrics = Metrics(
        n=scored,
        rps=model_rps / scored,
        log_loss=model_ll / scored,
        outcome_accuracy=model_out / scored,
        exact_score_accuracy=model_exact / scored,
    )
    base_metrics = Metrics(
        n=scored,
        rps=base_rps / scored,
        log_loss=base_ll / scored,
        outcome_accuracy=base_out / scored,
        exact_score_accuracy=0.0,
    )
    return model_metrics, base_metrics


def _argmax(values: tuple[float, ...]) -> int:
    return max(range(len(values)), key=lambda i: values[i])


def _safe_log(p: float) -> float:
    from math import log

    return log(max(p, 1e-12))


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest the v3 Dixon-Coles engine.")
    parser.add_argument("--season", type=int, default=None, help="Season year to test.")
    parser.add_argument(
        "--half-life",
        type=float,
        default=365.0,
        help="Recency half-life in days (default 365, the backtest's best).",
    )
    parser.add_argument(
        "--sweep",
        action="store_true",
        help="Sweep several half-lives instead of using --half-life.",
    )
    args = parser.parse_args()

    matches = load_matches()
    season = args.season or _latest_complete_season(matches)
    print(f"Loaded {len(matches)} finished matches. Testing season {season}.\n")

    half_lives = [90, 180, 365, 730] if args.sweep else [args.half_life]
    baseline_printed = False
    for half_life in half_lives:
        model_metrics, base_metrics = backtest(matches, season, half_life_days=half_life)
        if not baseline_printed:
            print(f"baseline (season base rate):  {base_metrics}\n")
            baseline_printed = True
        print(f"v3 half_life={half_life:>4.0f}d:  {model_metrics}")


if __name__ == "__main__":
    main()

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
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Sequence

import numpy as np

from updater.env import BACKUPS_DIR
from updater.predictions import models as model_registry
from updater.predictions.distributions import MatchResult
from updater.predictions.models import (
    FittedModel,
    Predictor,
    predict_fixture,
    predict_outcome,
    produces_scoreline,
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
    """Running totals for one model, finalised by `summary()`."""

    label: str
    # "scoreline", "outcome", or "-" for the baseline. Worth carrying because
    # the leaderboard is now a comparison *between* families, not just models.
    family: str = "-"
    n: int = 0
    rps_total: float = 0.0
    log_loss_total: float = 0.0
    correct_outcomes: int = 0
    correct_scores: int = 0
    # Matches where an exact-score guess was even possible. The direct outcome
    # models never predict a scoreline, so for them this stays 0 and the exact
    # column reads n/a rather than a 0.000 that looks like a failed prediction.
    scored_exact: int = 0
    # (predicted probability, hit) pairs across all three outcomes, for ECE.
    calibration: list[tuple[float, bool]] = field(default_factory=list)
    # Per-match RPS, kept so models can be compared *paired* on identical
    # fixtures. Two engines can differ by less than either one's own spread and
    # still be reliably ordered, so the unpaired spread would hide a real edge,
    # and an unpaired tie would hide a real one.
    per_match_rps: list[float] = field(default_factory=list)
    # The forecasts themselves, kept so two models can be compared fixture by
    # fixture. Averages hide disagreement: two engines can tie on RPS while
    # picking different winners, their errors cancelling in the mean.
    per_match_probs: list[tuple[float, float, float]] = field(default_factory=list)
    per_match_actual: list[int] = field(default_factory=list)

    def add(
        self,
        probs: tuple[float, float, float],
        actual: int,
        exact_hit: Optional[bool] = None,
    ) -> None:
        self.n += 1
        rps = ranked_probability_score(probs, actual)
        self.per_match_rps.append(rps)
        self.per_match_probs.append((probs[0], probs[1], probs[2]))
        self.per_match_actual.append(actual)
        self.rps_total += rps
        self.log_loss_total += -_safe_log(probs[actual])
        self.correct_outcomes += 1 if _argmax(probs) == actual else 0
        if exact_hit is not None:
            self.scored_exact += 1
            if exact_hit:
                self.correct_scores += 1
        for i, p in enumerate(probs):
            self.calibration.append((p, i == actual))

    @property
    def rps(self) -> float:
        return self.rps_total / self.n if self.n else float("nan")

    @property
    def log_loss(self) -> float:
        return self.log_loss_total / self.n if self.n else float("nan")

    @property
    def outcome_accuracy(self) -> float:
        return self.correct_outcomes / self.n if self.n else float("nan")

    @property
    def exact_score_accuracy(self) -> float:
        """NaN when the model never produced a scoreline to be judged on."""
        return (
            self.correct_scores / self.scored_exact
            if self.scored_exact
            else float("nan")
        )

    @property
    def calibration_error(self) -> float:
        """Expected calibration error over 10 equal-width probability bins."""
        if not self.calibration:
            return float("nan")
        bins: list[list[tuple[float, bool]]] = [[] for _ in range(10)]
        for prob, hit in self.calibration:
            bins[min(int(prob * 10), 9)].append((prob, hit))
        total = len(self.calibration)
        error = 0.0
        for bucket in bins:
            if not bucket:
                continue
            mean_prob = sum(p for p, _ in bucket) / len(bucket)
            observed = sum(1 for _, hit in bucket if hit) / len(bucket)
            error += (len(bucket) / total) * abs(mean_prob - observed)
        return error


@dataclass
class PairedComparison:
    """A model's RPS gap to the leader, measured on the same fixtures."""

    mean_difference: float
    standard_error: float

    @property
    def t_statistic(self) -> float:
        if self.standard_error == 0:
            return 0.0
        return self.mean_difference / self.standard_error

    def __str__(self) -> str:
        if self.standard_error == 0:
            return "-"
        # +/- 2 standard errors is the usual 95% interval; anything inside it is
        # a gap this sample cannot distinguish from zero.
        marker = "*" if abs(self.t_statistic) > 2 else " "
        return f"{self.mean_difference:+.4f}+/-{2 * self.standard_error:.4f}{marker}"


def paired_rps_difference(model: Metrics, reference: Metrics) -> PairedComparison:
    """Mean per-match RPS difference (model - reference) and its standard error.

    Both models saw identical fixtures in identical order, so differencing
    match-by-match cancels the fixture difficulty that dominates the raw spread.
    """
    if model is reference or len(model.per_match_rps) != len(reference.per_match_rps):
        return PairedComparison(0.0, 0.0)

    differences = np.array(model.per_match_rps) - np.array(reference.per_match_rps)
    if differences.size < 2:
        return PairedComparison(0.0, 0.0)
    return PairedComparison(
        mean_difference=float(differences.mean()),
        standard_error=float(differences.std(ddof=1) / np.sqrt(differences.size)),
    )


def _table(rows: Sequence[Metrics]) -> str:
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


@dataclass
class Disagreement:
    """How far apart two models are fixture by fixture, and who wins where.

    A leaderboard cannot answer this. Two engines that tie on mean RPS may be
    making the same forecast every week, or wildly different ones that happen to
    be wrong equally often. Only the first case means the second engine is
    redundant, and telling them apart decides whether keeping both families is
    worth anything.
    """

    first: str
    second: str
    n: int
    # Fixtures where the two name a different most likely result.
    differing_picks: int
    mean_total_variation: float
    max_total_variation: float
    # Mean RPS restricted to the fixtures where the picks differ. If the two
    # carry different information, one should be clearly better on exactly
    # these, which is where a blend would earn its keep.
    first_rps_when_differing: float
    second_rps_when_differing: float

    @property
    def differing_share(self) -> float:
        return self.differing_picks / self.n if self.n else float("nan")

    def __str__(self) -> str:
        if self.n == 0:
            return f"{self.first} vs {self.second}: nothing scored in common"
        return "\n".join(
            [
                f"{self.first} vs {self.second} over {self.n} fixtures",
                f"  different pick     {self.differing_picks} "
                f"({self.differing_share:.1%} of fixtures)",
                f"  mean separation    {self.mean_total_variation:.4f} "
                f"(total variation, max {self.max_total_variation:.4f})",
                f"  RPS where they differ: {self.first} {self.first_rps_when_differing:.4f}, "
                f"{self.second} {self.second_rps_when_differing:.4f}",
            ]
        )


def disagreement(first: Metrics, second: Metrics) -> Disagreement:
    """Compare two models' stored per-fixture forecasts.

    Both must have been scored in the same `backtest` call, so their stored
    forecasts line up fixture for fixture. Total variation distance is used for
    separation: half the L1 gap between the two probability triples, which is 0
    for identical forecasts and 1 for forecasts with nothing in common.
    """
    if len(first.per_match_probs) != len(second.per_match_probs):
        raise ValueError(
            "Models were scored on different fixtures and cannot be compared"
        )

    if not first.per_match_probs:
        return Disagreement(first.label, second.label, 0, 0, float("nan"), float("nan"), float("nan"), float("nan"))

    a = np.array(first.per_match_probs)
    b = np.array(second.per_match_probs)

    total_variation = 0.5 * np.abs(a - b).sum(axis=1)
    differing = a.argmax(axis=1) != b.argmax(axis=1)

    first_rps = np.array(first.per_match_rps)
    second_rps = np.array(second.per_match_rps)

    return Disagreement(
        first=first.label,
        second=second.label,
        n=len(a),
        differing_picks=int(differing.sum()),
        mean_total_variation=float(total_variation.mean()),
        max_total_variation=float(total_variation.max()),
        first_rps_when_differing=(
            float(first_rps[differing].mean()) if differing.any() else float("nan")
        ),
        second_rps_when_differing=(
            float(second_rps[differing].mean()) if differing.any() else float("nan")
        ),
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
        base_counts[outcome(m.result.home_goals, m.result.away_goals)] += 1
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

        actual = outcome(match.result.home_goals, match.result.away_goals)
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


def _argmax(values: tuple[float, ...]) -> int:
    return max(range(len(values)), key=lambda i: values[i])


def _safe_log(p: float) -> float:
    from math import log

    return log(max(p, 1e-12))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare prediction engines on past seasons."
    )
    parser.add_argument(
        "--models",
        type=str,
        default=None,
        help="Comma-separated engines to compare (default: all registered).",
    )
    parser.add_argument(
        "--family",
        type=str,
        default=None,
        choices=list(model_registry.FAMILIES),
        help=(
            "Restrict to one family: 'scoreline' engines predict a goal matrix, "
            "'outcome' engines predict home/draw/away directly. Default: both."
        ),
    )
    parser.add_argument(
        "--seasons",
        type=str,
        default=None,
        help="Comma-separated season years to test (default: latest complete).",
    )
    parser.add_argument(
        "--half-life",
        type=float,
        default=365.0,
        help="Recency half-life in days (default 365, the backtest's best).",
    )
    parser.add_argument(
        "--sweep",
        action="store_true",
        help="Sweep several half-lives for each selected model.",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="Print the registered engine names and exit.",
    )
    parser.add_argument(
        "--compare",
        type=str,
        default=None,
        help=(
            "Two engine names, comma separated. After the table, report how "
            "often they pick different results and who is right when they do. "
            "Answers what the leaderboard cannot: whether two models that tie "
            "are actually making the same forecast."
        ),
    )
    parser.add_argument(
        "--progress",
        action="store_true",
        help="Report weeks completed on stderr (a full run takes tens of minutes).",
    )
    args = parser.parse_args()

    if args.list_models:
        for family in model_registry.FAMILIES:
            print(f"{family}:")
            for name in model_registry.available(family):
                print(f"  {name}")
        return

    compare: list[str] = []
    if args.compare:
        compare = [name.strip() for name in args.compare.split(",") if name.strip()]
        if len(compare) != 2:
            parser.error("--compare takes exactly two model names")

    if args.models:
        names = [name.strip() for name in args.models.split(",") if name.strip()]
        if args.family:
            names = [n for n in names if model_registry.family_of(n) == args.family]
    else:
        names = model_registry.available(args.family)

    # The pair has to be scored in this run for its per-fixture forecasts to be
    # comparable, so pull it in rather than failing after the run.
    for name in compare:
        if name not in names:
            names.append(name)
    matches = load_matches()
    seasons = (
        [int(s) for s in args.seasons.split(",")]
        if args.seasons
        else [_latest_complete_season(matches)]
    )

    half_lives = [90.0, 180.0, 365.0, 730.0] if args.sweep else [args.half_life]

    predictors: list[Predictor] = []
    labels: list[str] = []
    for name in names:
        for half_life in half_lives:
            predictors.append(model_registry.build(name, half_life_days=half_life))
            labels.append(f"{name} hl={half_life:.0f}d" if args.sweep else name)

    seasons_label = ", ".join(str(s) for s in seasons)
    print(
        f"Loaded {len(matches)} finished matches. "
        f"Testing season(s) {seasons_label} with {len(predictors)} model(s).\n"
    )

    rows = backtest(
        matches, predictors, seasons, labels=labels, progress=args.progress
    )
    print(_table(rows))

    if compare:
        by_label = {row.label: row for row in rows}
        missing = [name for name in compare if name not in by_label]
        if missing:
            print(f"\nCannot compare: {', '.join(missing)} produced no scored rows.")
        else:
            print()
            print(disagreement(by_label[compare[0]], by_label[compare[1]]))


if __name__ == "__main__":
    main()

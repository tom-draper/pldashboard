"""Command line for the backtest harness.

Run with `python -m updater.predictions.backtest`; see the package docstring
for the available flags.
"""

from __future__ import annotations

import argparse

from updater.predictions import models as model_registry
from updater.predictions.backtest.data import latest_complete_season, load_matches
from updater.predictions.backtest.harness import backtest
from updater.predictions.backtest.metrics import disagreement
from updater.predictions.backtest.report import format_table
from updater.predictions.models import Predictor


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
        else [latest_complete_season(matches)]
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
    print(format_table(rows))

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

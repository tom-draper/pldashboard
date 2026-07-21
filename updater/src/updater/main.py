import argparse

from updater.run import run_mode, RunMode


def main():
    parser = argparse.ArgumentParser(
        prog="updater",
        description="Fetch the latest football data, build the metrics and "
        "upload them to MongoDB.",
    )
    parser.add_argument(
        "--dev",
        action="store_const",
        const=RunMode.DEVELOPMENT,
        default=RunMode.PRODUCTION,
        dest="mode",
        help="Development mode: build from local backups, print the tables and "
        "skip all database writes.",
    )
    args = parser.parse_args()
    run_mode(args.mode)

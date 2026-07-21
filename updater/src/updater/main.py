import argparse
import logging

from updater.updater import Updater


def main():
    parser = argparse.ArgumentParser(
        prog="updater",
        description="Fetch the latest football data, build the metrics and "
        "upload them to MongoDB.",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Development mode: build from local backups, print the tables and "
        "skip all database writes.",
    )
    args = parser.parse_args()

    log_format = "%(asctime)s :: %(levelname)s :: %(message)s"
    if args.dev:
        logging.basicConfig(level=logging.DEBUG, format=log_format)
        Updater().build_all(
            display_tables=True, update_db=False, request_new=False
        )
    else:
        logging.basicConfig(level=logging.CRITICAL, format=log_format)
        Updater().build_all()

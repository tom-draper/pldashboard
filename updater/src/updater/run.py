import logging
from enum import Enum

from updater.updater import Updater


class RunMode(Enum):
    PRODUCTION = "production"
    DEVELOPMENT = "development"


def main():
    run_mode(RunMode.PRODUCTION)


def run_mode(mode: RunMode):
    if mode == RunMode.PRODUCTION:
        logging.basicConfig(level=logging.CRITICAL, format="%(asctime)s :: %(levelname)s :: %(message)s")
        Updater().build_all()
    elif mode == RunMode.DEVELOPMENT:
        logging.basicConfig(level=logging.DEBUG, format="%(asctime)s :: %(levelname)s :: %(message)s")
        Updater().build_all(display_tables=True, update_db=False, request_new=False)

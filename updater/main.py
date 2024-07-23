import logging

from src.updater import Updater
from timebudget import timebudget


def run(display_tables: bool = False, request_new: bool = True, update_db: bool = True):
    updater = Updater()
    updater.build_all(
        display_tables=display_tables, request_new=request_new, update_db=update_db
    )


def run_production():
    timebudget.set_quiet()
    logging.basicConfig(
        level=logging.CRITICAL, format="%(asctime)s :: %(levelname)s :: %(message)s"
    )
    run()


def run_development():
    logging.basicConfig(
        level=logging.DEBUG, format="%(asctime)s :: %(levelname)s :: %(message)s"
    )
    run(display_tables=True, update_db=False, request_new=False)


if __name__ == "__main__":
    run_production()

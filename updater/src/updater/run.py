import logging
from updater.updater import Updater
from timebudget import timebudget
from enum import Enum

class RunMode(Enum):
    PRODUCTION = "production"
    DEVELOPMENT = "development"

def run(display_tables: bool = False, request_new: bool = True, update_db: bool = True, quiet: bool = False):
    if quiet:
        timebudget.set_quiet()
    updater = Updater()
    updater.build_all(display_tables=display_tables, request_new=request_new, update_db=update_db)

def run_mode(mode: RunMode):
    if mode == RunMode.PRODUCTION:
        logging.basicConfig(level=logging.CRITICAL, format="%(asctime)s :: %(levelname)s :: %(message)s")
        run()
    elif mode == RunMode.DEVELOPMENT:
        logging.basicConfig(level=logging.DEBUG, format="%(asctime)s :: %(levelname)s :: %(message)s")
        run(display_tables=True, update_db=False, request_new=False)
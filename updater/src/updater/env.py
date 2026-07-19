import logging
from functools import lru_cache
from os import getenv
from pathlib import Path

from dotenv import load_dotenv

# src/updater/env.py -> src/updater -> src -> <project root>
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Backups live alongside the package rather than relative to the working
# directory, so the updater can be invoked from anywhere.
BACKUPS_DIR = PROJECT_ROOT / "backups"


@lru_cache(maxsize=1)
def load_env():
    """Load the project .env file exactly once.

    Values already present in the real environment take precedence, so
    container/CI configuration is not overridden by a stale .env file.
    """
    dotenv_path = PROJECT_ROOT / ".env"
    if dotenv_path.is_file():
        load_dotenv(dotenv_path)
    else:
        logging.debug(f"No .env file found at {dotenv_path}, using environment only")


def require_env(name: str):
    """Return the value of a required environment variable.

    Raises:
        RuntimeError: The variable is unset or empty.
    """
    load_env()
    value = getenv(name)
    if not value:
        raise RuntimeError(
            f"Required environment variable {name} is not set. "
            f"Add it to {PROJECT_ROOT / '.env'} or the process environment."
        )
    return value


def require_env_int(name: str):
    """Return a required environment variable parsed as an int."""
    value = require_env(name)
    try:
        return int(value)
    except ValueError as e:
        raise RuntimeError(
            f"Environment variable {name} must be an integer, got {value!r}"
        ) from e

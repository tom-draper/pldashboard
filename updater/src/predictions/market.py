import logging
import time

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from webdriver_manager.chrome import ChromeDriverManager

from .odds import Odds


def fetch_odds(url: str, js_rendered: bool = False):
    try:
        driver = _fetch_webpage(url, js_rendered)
        time.sleep(5)  # Allows webpage to load
        tables = driver.find_elements(By.CLASS_NAME, "coupon-table")
        odds = _extract_odds(tables)
        driver.quit()
    except WebDriverException as e:
        logging.error(f"❌ Failed to fetch odds: {e}")
        odds = {}
    return odds


def _chrome_options_headless():
    options = webdriver.ChromeOptions()
    options.add_argument("no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    # options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--headless")
    # options.add_argument("--disable-extensions")
    return options


def _fetch_webpage(url: str, js_rendered: bool = False):
    if js_rendered:
        options = webdriver.ChromeOptions()
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()), options=options
        )
    else:
        options = _chrome_options_headless()
        driver = webdriver.Chrome(
            service=Service("/usr/local/bin/chromedriver"), options=options
        )
    driver.get(url)
    return driver


def _extract_odds(tables: list[WebElement]):
    odds: dict[tuple[str, str], Odds] = {}
    for table in tables:
        cells = table.text.split("\n")[1:]
        cells = list(filter(lambda x: x[0] != "£", cells))
        table_odds = _extract_table_odds(cells)
        odds = {**odds, **table_odds}
    return odds


def _extract_table_odds(cells: list[str]):
    odds: dict[tuple[str, str], Odds] = {}
    i = 0
    while i < len(cells):
        # Move to next odds value
        while i < len(cells) and not _is_odds_value(cells[i]):
            i += 1

        if i - 3 < 0:
            continue

        # Previous 3 values before odds will be date and team names
        date, home_team, away_team = cells[i - 3 : i]
        home_team = (
            _betfair_team_alias[home_team]
            if home_team in _betfair_team_alias
            else home_team
        )
        away_team = (
            _betfair_team_alias[away_team]
            if away_team in _betfair_team_alias
            else away_team
        )

        odds_values = _extract_match_odds(cells, i)
        i += len(odds_values)

        home, draw, away = _extract_standard_odds(odds_values)
        if home is None or draw is None or away is None:
            continue

        odds[(home_team, away_team)] = Odds(
            home, draw, away, home_team, away_team, date
        )
    return odds


_betfair_team_alias = {
    "Man City": "Manchester City",
    "Nottm Forest": "Nottingham Forest",
    "Sheff Utd": "Sheffield United",
    "Man Utd": "Manchester United",
    "Tottenham": "Tottenham Hotspur",
    "Wolves": "Wolverhampton Wanderers",
    "Newcaslte": "Newcastle United",
    "Brighton": "Brighton and Hove Albion",
    "Leeds": "Leeds United",
    "West Ham": "West Ham United",
    "Leicester": "Leicester City",
}


def _is_odds_value(cell_value: str):
    return ("." in cell_value or cell_value.isnumeric()) and not _has_alpha(cell_value)


def _has_alpha(value: str):
    return value.upper().isupper()


def _extract_match_odds(cells: list[str], cur_idx: int):
    odds: list[float] = []
    while cur_idx < len(cells) and _is_odds_value(cells[cur_idx]):
        cell_value = cells[cur_idx]
        odds.append(float(cell_value))
        cur_idx += 1
    return odds


def _extract_standard_odds(odds: list[float]):
    if len(odds) == 6:
        return odds[0], odds[2], odds[4]
    return None, None, None

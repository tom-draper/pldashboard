import time

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from src.predictions.odds import Odds
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.remote.webelement import WebElement


def fetch_odds(url: str) -> dict[tuple[str, str], Odds]:
    driver = _fetch_webpage(url)
    time.sleep(5)  # Allows webpage to load
    tables = driver.find_elements(By.CLASS_NAME, 'coupon-table')
    odds = _extract_odds(tables)
    return odds

def _fetch_webpage(url: str) -> webdriver:
    options = webdriver.ChromeOptions()
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get(url)
    return driver

def _extract_odds(tables: list[WebElement]) -> dict[tuple[str, str], Odds]:
    odds = {}
    for table in tables:
        cells = table.text.split('\n')[1:]
        cells = list(filter(lambda x: x[0] != '£', cells))
        table_odds = _extract_table_odds(cells)
        odds = {**odds, **table_odds}
    return odds

def _extract_table_odds(cells: list[str]) -> dict[tuple[str, str], Odds]:
    odds = {}
    i = 0
    while i < len(cells):
        date, home_team, away_team = cells[i:i+3]
        home_team = _team_alias[home_team] if home_team in _team_alias else home_team
        away_team = _team_alias[away_team] if away_team in _team_alias else away_team
        i += 3

        odds_values = _extract_match_odds(cells, i)
        i += len(odds_values)

        home, draw, away = _extract_standard_odds(odds_values)
        if home is None or draw is None or away is None:
            continue

        _odds = Odds(home, draw, away, home_team, away_team, date)
        odds[(home_team, away_team)] = _odds
    return odds

_team_alias = {
    'Man City': 'Manchester City',
    'Nottm Forest': 'Nottingham Forest',
    'Sheff Utd': 'Sheffield United',
    'Man Utd': 'Manchester United',
    'Tottenham': 'Tottenham Hotspur',
    'Wolves': 'Wolverhampton Wanderers',
    'Newcaslte': 'Newcastle United',
    'Brighton': 'Brighton and Hove Albion',
    'Leeds': 'Leeds United',
    'West Ham': 'West Ham United',
    'Leicester': 'Leicester City',
}

def _is_odds_value(cell_value: str) -> bool:
    return "." in cell_value or cell_value.isnumeric()

def _extract_match_odds(cells: list[str], cur_idx: int) -> list[float]:
    odds = []
    while cur_idx < len(cells) and _is_odds_value(cells[cur_idx]):
        odds.append(float(cells[cur_idx]))
        cur_idx += 1
    return odds

def _extract_standard_odds(odds: list[float]) -> tuple[float, float, float]:
    if len(odds) == 6:
        return odds[0], odds[2], odds[4]
    return None, None, None


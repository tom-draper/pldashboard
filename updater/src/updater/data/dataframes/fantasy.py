import logging
from typing import Any, Optional

import pandas as pd
from pandas import DataFrame

from updater.data.raw_data import RawData
from updater.timing import timed

from .df import DF


class Fantasy(DF):
    """Class for managing Fantasy Premier League player data and statistics."""

    # Fantasy point scoring system constants
    SCORING_SYSTEM = {
        "goals_scored": {
            "Forward": 4,
            "Midfielder": 5,
            "Defender": 6,
            "Goalkeeper": 6
        },
        "assists": 3,
        "clean_sheets": {
            "Goalkeeper": 4,
            "Defender": 4,
            "Midfielder": 1,
            "Forward": 0
        },
        "own_goals": -2,
        "penalties_saved": 5,
        "penalties_missed": -2,
        "yellow_cards": -1,
        "red_cards": -3,
        "saves_per_point": 3  # Points awarded per 3 saves
    }

    # Column mapping for better maintainability
    PLAYER_COLUMN_MAPPING = {
        "web_name": "web_name",
        "first_name": "firstName",
        "second_name": "surname",
        "form": "form",
        "minutes": "minutes",
        "points_per_game": "pointsPerGame",
        "now_cost": "price",
        "selected_by_percent": "selectedBy",
        "event_points": "points",
        "total_points": "totalPoints",
        "bonus": "bonusPoints",
        "transfers_in": "transferIn",
        "transfers_out": "transferOut",
        "goals_scored": "goals",
        "assists": "assists",
        "clean_sheets": "cleanSheets",
        "own_goals": "ownGoals",
        "penalties_saved": "penalitiesSaved",
        "penalties_missed": "penalitiesMissed",
        "yellow_cards": "yellowCards",
        "red_cards": "redCards",
        "saves": "saves",
        "news": "news",
        "chance_of_playing_next_round": "chanceOfPlayingNextRound",
        "chance_of_playing_this_round": "chanceOfPlayingThisRound",
    }

    def __init__(self, d: Optional[DataFrame] = None):
        super().__init__(d, "fantasy")

    def _extract_team_mappings(self, fantasy_data: dict[str, Any]) -> dict[int, str]:
        """Team code -> team name, for resolving each player's club."""
        try:
            return {team["code"]: team["name"] for team in fantasy_data["teams"]}
        except KeyError as e:
            raise ValueError("Team data not found in fantasy data") from e

    def _extract_position_mappings(self, fantasy_data: dict[str, Any]) -> dict[int, str]:
        """Position id -> position name, for resolving each player's role."""
        try:
            return {
                position_type["id"]: position_type["singular_name"]
                for position_type in fantasy_data["element_types"]
            }
        except KeyError as e:
            raise ValueError("Position data not found in fantasy data") from e

    def _build_player_record(self, player: dict[str, Any],
                           team_mappings: dict[int, str],
                           position_mappings: dict[int, str]) -> dict[str, Any]:
        """One player's row: renamed API fields plus club and position."""
        try:
            team_name = team_mappings.get(player["team_code"], "Unknown")
            position_name = position_mappings.get(player["element_type"], "Unknown")

            # Build record using column mapping
            record = {}
            for api_field, df_column in self.PLAYER_COLUMN_MAPPING.items():
                if api_field in player:
                    record[df_column] = player[api_field]
                else:
                    record[df_column] = 0  # Default value for missing fields

            # Add computed fields
            record["team"] = team_name
            record["position"] = position_name

            return record

        except KeyError as e:
            raise ValueError(f"Missing required player field: {e}") from e

    def _process_all_players(self, fantasy_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """Every player's row, keyed by web_name.

        A player whose record cannot be built is logged and skipped rather
        than failing the build, since one malformed entry should not cost the
        dashboard the other several hundred.
        """
        team_mappings = self._extract_team_mappings(fantasy_data)
        position_mappings = self._extract_position_mappings(fantasy_data)

        player_records = {}

        try:
            players_data = fantasy_data["elements"]
        except KeyError as e:
            raise ValueError("Player elements not found in fantasy data") from e

        for player in players_data:
            try:
                web_name = player.get("web_name", f"Player_{player.get('id', 'Unknown')}")
                player_record = self._build_player_record(player, team_mappings, position_mappings)
                player_records[web_name] = player_record
            except ValueError as e:
                logging.warning(f"Skipping player: {e}")
                continue

        return player_records

    def calculate_stat_points(self, identifier: str, value: int, position: str) -> int:
        """Points a statistic is worth, per SCORING_SYSTEM.

        Several stats are worth different amounts by position (a defender's
        goal outscores a forward's), which is why position is needed here.
        """
        if identifier in ["goals_scored", "clean_sheets"]:
            # Position-dependent scoring
            position_scores = self.SCORING_SYSTEM[identifier]
            return position_scores.get(position, 0) * value
        elif identifier == "assists":
            return self.SCORING_SYSTEM["assists"] * value
        elif identifier in ["own_goals", "penalties_saved", "penalties_missed"]:
            return self.SCORING_SYSTEM[identifier] * value
        elif identifier in ["yellow_cards", "red_cards"]:
            return self.SCORING_SYSTEM[identifier] * value
        elif identifier == "saves":
            return value // self.SCORING_SYSTEM["saves_per_point"]
        elif identifier == "bonus":
            return value  # Bonus points are awarded directly
        else:
            return 0

    def _clean_final_dataframe(self, df: DataFrame) -> DataFrame:
        """Order by total points and give the index and columns their names."""
        # Fill missing values and infer appropriate data types. Silent
        # downcasting is already off and copies are lazy under pandas 3.
        df = df.fillna(0).infer_objects()

        # Set proper index name
        df.index.name = "player"

        # Sort by total points (descending) for better readability
        if "totalPoints" in df.columns:
            df = df.sort_values(by="totalPoints", ascending=False)

        return df

    @timed
    def build(self, raw_data: RawData, display: bool = False) -> None:
        """
        Build a comprehensive Fantasy Premier League DataFrame with player statistics.

        Creates a DataFrame containing all relevant fantasy football statistics for players
        in the current season, sorted by total points in descending order.

        Args:
            raw_data: Raw JSON data from the Fantasy Premier League API
            display: Whether to print the DataFrame after creation (default: False)

        DataFrame Structure:
            Rows: All players in the current season (sorted by totalPoints desc)
            Columns:
                - Basic info: firstName, surname, team, position
                - Performance: form, minutes, points, totalPoints, pointsPerGame
                - Financial: price, selectedBy, transferIn, transferOut
                - Statistics: goals, assists, cleanSheets, saves, etc.
                - Availability: chanceOfPlayingThisRound, chanceOfPlayingNextRound
                - Disciplinary: yellowCards, redCards, ownGoals
                - News: news (injury/status updates)

        Raises:
            ValueError: If required data is missing or malformed
        """
        self.log_building()

        player_records = self._process_all_players(raw_data.fantasy_general)
        if not player_records:
            raise ValueError("No valid player records found")

        df = pd.DataFrame.from_dict(player_records, orient="index")
        df = self._clean_final_dataframe(df)

        if display:
            print(df)

        self.df = df

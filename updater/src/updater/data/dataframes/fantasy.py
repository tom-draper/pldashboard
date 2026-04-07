import logging

import pandas as pd
from pandas import DataFrame
from typing import Any
from timebudget import timebudget

from .df import DF


class Fantasy(DF):

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

    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "fantasy")

    def _build_player_record(
        self,
        player: dict[str, Any],
        team_mappings: dict[int, str],
        position_mappings: dict[int, str],
    ) -> dict[str, Any]:
        record = {
            df_col: player.get(api_field, 0)
            for api_field, df_col in self.PLAYER_COLUMN_MAPPING.items()
        }
        record["team"] = team_mappings.get(player.get("team_code"), "Unknown")
        record["position"] = position_mappings.get(player.get("element_type"), "Unknown")
        return record

    def _process_all_players(self, fantasy_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
        team_mappings = {team["code"]: team["name"] for team in fantasy_data["teams"]}
        position_mappings = {p["id"]: p["singular_name"] for p in fantasy_data["element_types"]}

        player_records = {}
        for player in fantasy_data["elements"]:
            web_name = player.get("web_name", f"Player_{player.get('id', 'Unknown')}")
            try:
                player_records[web_name] = self._build_player_record(
                    player, team_mappings, position_mappings
                )
            except (KeyError, ValueError) as e:
                logging.warning(f"Skipping player {web_name}: {e}")
        return player_records

    def to_dict(self) -> dict:
        if self.df is None or self.df.empty:
            raise ValueError("Cannot convert Fantasy DataFrame to dict: not built.")
        return self.df.to_dict(orient="index")

    def _clean_final_dataframe(self, df: DataFrame) -> DataFrame:
        df = df.fillna(0).infer_objects()
        df.index.name = "player"
        if "totalPoints" in df.columns:
            df = df.sort_values(by="totalPoints", ascending=False)
        return df

    @timebudget
    def build(self, raw_data: dict[str, Any], display: bool = False) -> None:
        """Build a Fantasy Premier League DataFrame with player statistics.

        Rows: All players in the current season (sorted by totalPoints desc)
        Columns: firstName, surname, team, position, form, minutes, points,
            totalPoints, pointsPerGame, price, selectedBy, transferIn,
            transferOut, goals, assists, cleanSheets, saves, yellowCards,
            redCards, ownGoals, bonusPoints, news, chanceOfPlayingThisRound,
            chanceOfPlayingNextRound
        """
        self.log_building(None)

        fantasy_data = raw_data["fantasy"]["general"]
        player_records = self._process_all_players(fantasy_data)

        if not player_records:
            raise ValueError("No valid player records found")

        df = pd.DataFrame.from_dict(player_records, orient="index")
        df = self._clean_final_dataframe(df)

        if display:
            print(df)

        self.df = df

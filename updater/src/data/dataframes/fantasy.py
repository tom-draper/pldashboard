import pandas as pd
from pandas import DataFrame
from timebudget import timebudget

from .df import DF


class Fantasy(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "fantasy")

    @staticmethod
    def get_current_season(json_data: dict):
        return next(iter(json_data["fantasy"].keys()))

    def get_fixtures(
        self, json_data: dict, player_positions: dict[str, str], current_season: int
    ):
        fantasy_fixtures = json_data["fantasy_fixtures"][current_season]

        result = {}
        for fixture in fantasy_fixtures:
            matchday = fixture["event"]
            if matchday not in result:
                result[matchday] = {}

            for stat in fixture["stats"]:
                identifier = stat["identifier"]
                for team in ("h", "a"):
                    for s in stat[team]:
                        player_id = s["element"]
                        points = self.get_stat_points(
                            identifier, player_positions[player_id]
                        )
                        if player_id not in result[matchday]:
                            result[matchday][player_id] = 0
                        result[matchday][player_id] += points

    def get_stat_points(self, value: int, identifier: str, position: str):
        match identifier:
            case "goals_scored":
                if position == "Forward":
                    return 4 * value
                elif position == "Midfielder":
                    return 5 * value
                elif position == "Defender" or position == "Goalkeeper":
                    return 6 * value
            case "assists":
                return 3 * value
            case "clean_sheets":
                if position == "Goalkeeper":
                    return 4
                elif position == "Defender":
                    return 3
            case "own_goals":
                return -2 * value
            case "penalties_saved":
                return 5 * value
            case "penalties_missed":
                return -2 * value
            case "yellow_cards":
                return -1
            case "red_cards":
                return -3
            case "saves":
                return value // 3
            case "bonus":
                return value
        return 0

    @timebudget
    def build(self, raw_data: dict, display: bool = False):
        """ Builds a DataFrame containing the past and future fixtures for the
            current season (matchday 1 to 38) and inserts it into the fixtures
            class variable.

            Rows: all players participating in the current season.

            Args:
                json_data (dict): Raw JSON data from API or local store.
                display (bool, optional): Print DataFrame once built. Defaults to
                    False.
        """

        current_season = self.get_current_season(raw_data)
        self.log_building(current_season)

        # Get first and only key as the current season
        fantasy_data = raw_data["fantasy"][current_season]

        teams = {team["code"]: team["name"] for team in fantasy_data["teams"]}
        player_positions = {
            player_type["id"]: player_type["singular_name"]
            for player_type in fantasy_data["element_types"]
        }

        d = {
            player["web_name"]: {
                "firstName": player["first_name"],
                "surname": player["second_name"],
                "form": player["form"],
                "team": teams[player["team_code"]],
                "minutes": player["minutes"],
                "pointsPerGame": player["points_per_game"],
                "price": player["now_cost"],
                "position": player_positions[player["element_type"]],
                "selectedBy": player["selected_by_percent"],
                "points": player["event_points"],
                "totalPoints": player["total_points"],
                "bonusPoints": player["bonus"],
                "transferIn": player["transfers_in"],
                "transferOut": player["transfers_out"],
                "goals": player["goals_scored"],
                "assists": player["assists"],
                "cleanSheets": player["clean_sheets"],
                "ownGoals": player["own_goals"],
                "penalitiesSaved": player["penalties_saved"],
                "penalitiesMissed": player["penalties_missed"],
                "yellowCards": player["yellow_cards"],
                "news": player["news"],
                "redCards": player["red_cards"],
                "saves": player["saves"],
                "chanceOfPlayingNextRound": player["chance_of_playing_next_round"],
                "chanceOfPlayingThisRound": player["chance_of_playing_this_round"],
            }
            for player in fantasy_data["elements"]
        }

        fantasy = pd.DataFrame.from_dict(d, orient="index")
        fantasy.fillna(0, inplace=True)

        if display:
            print(fantasy)

        self.df = fantasy

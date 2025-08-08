import logging
from collections import defaultdict
from typing import Dict, List, Set, Tuple, Any

import pandas as pd
from pandas import DataFrame
from fmt import clean_full_team_name
from timebudget import timebudget

from .df import DF


class HomeAdvantages(DF):
    """Class for calculating and managing home advantage statistics for football teams."""
    
    PANDEMIC_YEAR = 2020  # Exclude due to anomalous conditions (no fans)
    
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "home_advantages")

    def _initialize_team_season_stats(self, stats: defaultdict, team: str, season: int) -> None:
        """Initialize statistics structure for a team in a given season."""
        if team not in stats:
            stats[team] = {}

        season_key = (season, "home", "wins")
        if season_key not in stats[team]:
            stats[team].update({
                (season, "home", "wins"): 0,
                (season, "home", "draws"): 0,
                (season, "home", "loses"): 0,
                (season, "away", "wins"): 0,
                (season, "away", "draws"): 0,
                (season, "away", "loses"): 0,
            })

    def _process_match_result(self, stats: defaultdict, match: Dict[str, Any], season: int) -> None:
        """Process a single match and update team statistics."""
        home_team = clean_full_team_name(match["homeTeam"]["name"])
        away_team = clean_full_team_name(match["awayTeam"]["name"])

        self._initialize_team_season_stats(stats, home_team, season)
        self._initialize_team_season_stats(stats, away_team, season)

        # Skip matches without a result
        if match["score"]["winner"] is None:
            return

        home_goals = match["score"]["fullTime"]["homeTeam"]
        away_goals = match["score"]["fullTime"]["awayTeam"]
        
        if home_goals > away_goals:
            # Home team wins
            stats[home_team][(season, "home", "wins")] += 1
            stats[away_team][(season, "away", "loses")] += 1
        elif home_goals < away_goals:
            # Away team wins
            stats[home_team][(season, "home", "loses")] += 1
            stats[away_team][(season, "away", "wins")] += 1
        else:
            # Draw
            stats[home_team][(season, "home", "draws")] += 1
            stats[away_team][(season, "away", "draws")] += 1

    def _process_season_matches(self, stats: defaultdict, matches: List[Dict[str, Any]], season: int) -> None:
        """Process all matches for a given season."""
        for match in matches:
            self._process_match_result(stats, match, season)

    def _calculate_season_metrics(self, df: DataFrame, season: int) -> None:
        """Calculate derived metrics for a specific season."""
        # Calculate games played at home
        home_played = (
            df[season]["home"]["wins"] +
            df[season]["home"]["draws"] +
            df[season]["home"]["loses"]
        )
        df[season, "home", "played"] = home_played

        # Calculate home win ratio (avoid division by zero)
        home_win_ratio = df[season]["home"]["wins"] / home_played.replace(0, 1)
        df[season, "home", "winRatio"] = home_win_ratio

        # Calculate total games played
        total_played = (
            home_played +
            df[season]["away"]["wins"] +
            df[season]["away"]["draws"] +
            df[season]["away"]["loses"]
        )
        df[season, "overall", "played"] = total_played

        # Calculate overall win ratio
        total_wins = df[season]["home"]["wins"] + df[season]["away"]["wins"]
        overall_win_ratio = total_wins / total_played.replace(0, 1)
        df[season, "overall", "winRatio"] = overall_win_ratio

        # Calculate home advantage (difference between home and overall win ratios)
        home_advantage = home_win_ratio - overall_win_ratio
        df[season, "homeAdvantage", ""] = home_advantage

    def _calculate_total_home_advantage(self, df: DataFrame, current_season: int, threshold: float) -> DataFrame:
        """Calculate the total home advantage across multiple seasons."""
        # Get all home advantage columns
        home_advantage_cols = df.loc[:, df.columns.get_level_values(1) == "homeAdvantage"]
        
        # Exclude current season if teams haven't played enough home games
        current_season_home_played = df[current_season]["home"]["played"]
        if (current_season_home_played <= threshold).all():
            logging.info(
                f"Home Advantages: Current season ({current_season}) excluded from calculation; "
                f"all teams have not played >= {threshold} home games."
            )
            if (current_season, "homeAdvantage", "") in home_advantage_cols.columns:
                home_advantage_cols = home_advantage_cols.drop(
                    (current_season, "homeAdvantage", ""), axis=1
                )

        # Exclude pandemic year due to anomalous conditions
        pandemic_col = (self.PANDEMIC_YEAR, "homeAdvantage", "")
        if pandemic_col in home_advantage_cols.columns:
            home_advantage_cols = home_advantage_cols.drop(pandemic_col, axis=1)
            logging.info(f"Home Advantages: Excluded {self.PANDEMIC_YEAR} season due to pandemic conditions.")

        # Calculate mean home advantage across seasons
        df["totalHomeAdvantage"] = home_advantage_cols.mean(axis=1).fillna(0)
        
        # Sort by total home advantage (descending)
        df = df.sort_values(by="totalHomeAdvantage", ascending=False)
        
        return df

    def _create_season_template(self, season: int, num_seasons: int) -> Dict[Tuple[int, str, str], int]:
        """Create a template dictionary for initializing team statistics."""
        template = {}
        for i in range(num_seasons):
            season_year = season - i
            template.update({
                (season_year, "home", "wins"): 0,
                (season_year, "home", "draws"): 0,
                (season_year, "home", "loses"): 0,
                (season_year, "away", "wins"): 0,
                (season_year, "away", "draws"): 0,
                (season_year, "away", "loses"): 0,
            })
        return template

    def _clean_dataframe(self, df: DataFrame, current_season_teams: List[str]) -> DataFrame:
        """Clean the dataframe by removing unnecessary columns and formatting."""
        # Remove raw win/loss/draw counts (keep only derived metrics)
        df = df.drop(columns=["wins", "loses", "draws"], level=2)
        
        # Filter to only include current season teams
        df = df.loc[current_season_teams]
        
        # Set proper column and index names
        df.columns.names = ("season", None, None)
        df.index.name = "team"
        
        # Ensure final sorting by totalHomeAdvantage (descending)
        if "totalHomeAdvantage" in df.columns:
            df = df.sort_values(by="totalHomeAdvantage", ascending=False)
        
        return df

    @staticmethod
    def get_season_teams(season_fixtures: List[Dict[str, Any]]) -> List[str]:
        """Extract unique team names from season fixture data."""
        teams: Set[str] = set()
        for match in season_fixtures:
            home_team = clean_full_team_name(match["homeTeam"]["name"])
            away_team = clean_full_team_name(match["awayTeam"]["name"])
            teams.add(home_team)
            teams.add(away_team)
        return sorted(list(teams))  # Sort for consistency

    @timebudget
    def build(
        self,
        json_data: dict,
        season: int,
        threshold: float,
        num_seasons: int = 3,
        display: bool = False,
    ):
        """ Assigns self.df a DataFrame containing team's home advantage data
            for each season with a combined total home advantage value.

            Rows: the 20 teams participating in the current season, ordered descending
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------
            |                     [SEASON YEAR]                     | totalHomeAdvantage |
            |-------------------------------------------------------|--------------------|
            |       home        |      overall      | homeAdvantage |                    |
            |-------------------|-------------------|---------------|                    |
            | played | winRatio | played | winRatio |               |                    |

            [SEASON YEAR]: 4-digit year values that a season began, from current
                season to season no_seasons ago.
            played: the number of games played in the season.
            winRatio: the win ratio of all games played in the season.
            homeAdvantage: the difference between the ratio of games won at home
                and the ratio of games won in total for a given season year.
            totalHomeAdvantage: combined home advantages value from all seasons
               in the table: the average home wins ratio / wins ratio.

        Args:
            json_data dict: the json data storage used to build the DataFrame
            season int: the year of the current season
            threshold float: the minimum number of home games played to incorporate
                a season's home advantage calculation for all teams into the
                Total home Advantage value
            no_seasons (int, optional): number of seasons to include.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        # Initialize statistics storage with template for each team
        stats = defaultdict(lambda: self._create_season_template(season, num_seasons))

        # Process matches for each season
        for i in range(num_seasons):
            season_year = season - i
            season_data = json_data["fixtures"][season_year]
            self._process_season_matches(stats, season_data, season_year)

        # Convert to DataFrame and fill missing values
        df = pd.DataFrame.from_dict(stats, orient="index")
        df = df.fillna(0).astype(int)

        # Calculate derived metrics for each season
        for i in range(num_seasons):
            season_year = season - i
            self._calculate_season_metrics(df, season_year)

        # Calculate total home advantage across seasons
        df = self._calculate_total_home_advantage(df, season, threshold)

        # Clean and format the final DataFrame
        current_season_teams = self.get_season_teams(json_data["fixtures"][season])
        df = self._clean_dataframe(df, current_season_teams)

        if display:
            print(df)

        self.df = df

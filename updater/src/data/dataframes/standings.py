import pandas as pd
from pandas import DataFrame
from typing import Dict, List, Any

from fmt import clean_full_team_name
from timebudget import timebudget

from .df import DF


class Standings(DF):
    """Class for managing and building football league standings across multiple seasons."""
    
    # Column mappings for better maintainability
    STANDINGS_COLUMNS = [
        "position",
        "played", 
        "won",
        "drawn",
        "lost",
        "points",
        "gF",  # goals for
        "gA",  # goals against
        "gD",  # goal difference
    ]
    
    COLUMNS_TO_DROP = ["form", "team"]

    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, "standings")

    @staticmethod
    def extract_team_names(json_data: Dict[str, Any], season: int) -> List[str]:
        """
        Extract and clean team names from standings data for a given season.
        
        Args:
            json_data: The complete JSON data structure
            season: The season year to extract teams from
            
        Returns:
            List of cleaned team names
        """
        try:
            standings_data = json_data["standings"][season]
            teams = [clean_full_team_name(row["team"]["name"]) for row in standings_data]
            return teams
        except (KeyError, TypeError) as e:
            raise ValueError(f"Unable to extract team names for season {season}: {e}")

    def _build_season_standings(self, json_data: Dict[str, Any], current_teams: List[str], season: int) -> DataFrame:
        """
        Build standings DataFrame for a single season.
        
        Args:
            json_data: The complete JSON data structure
            current_teams: List of current season team names to filter by
            season: The season year to process
            
        Returns:
            DataFrame with standings data for the specified season
        """
        try:
            standings_data = json_data["standings"][season]
        except KeyError:
            raise ValueError(f"Standings data not found for season {season}")
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(standings_data)
        
        # Get team names and set as index
        team_names = self.extract_team_names(json_data, season)
        df = df.drop(columns=self.COLUMNS_TO_DROP, errors='ignore')
        df.index = team_names

        # Create multi-level column headers with season
        df.columns = pd.MultiIndex.from_product([[season], self.STANDINGS_COLUMNS])

        # Filter to only include teams that are in the current season
        df = df.loc[df.index.intersection(current_teams)]
        
        return df

    def _validate_data_completeness(self, df: DataFrame, season: int) -> None:
        """
        Validate that the standings data is complete for the given season.
        
        Args:
            df: The standings DataFrame
            season: The season being validated
        """
        expected_teams = 20  # Standard league size
        actual_teams = len(df)
        
        if actual_teams < expected_teams:
            print(f"Warning: Only {actual_teams} teams found for season {season}, expected {expected_teams}")

    def _clean_final_dataframe(self, df: DataFrame) -> DataFrame:
        """
        Apply final cleaning and formatting to the combined standings DataFrame.
        
        Args:
            df: The raw combined standings DataFrame
            
        Returns:
            Cleaned and formatted DataFrame
        """
        # Fill missing values and convert to integers
        df = df.fillna(0).astype(int)
        
        # Set proper names for index and columns
        df.index.name = "team"
        df.columns.names = ("Season", None)
        
        # Sort by current season position (first season in the data)
        if not df.empty:
            current_season = df.columns.get_level_values(0)[0]
            if (current_season, "position") in df.columns:
                df = df.sort_values(by=(current_season, "position"))
        
        return df

    def _combine_season_standings(self, json_data: Dict[str, Any], 
                                current_teams: List[str], 
                                season: int, 
                                num_seasons: int) -> DataFrame:
        """
        Combine standings data from multiple seasons into a single DataFrame.
        
        Args:
            json_data: The complete JSON data structure
            current_teams: List of current season team names
            season: The current season year
            num_seasons: Number of seasons to include
            
        Returns:
            Combined standings DataFrame
        """
        combined_standings = pd.DataFrame()

        # Process seasons from current to oldest
        for i in range(num_seasons):
            season_year = season - i
            try:
                season_df = self._build_season_standings(json_data, current_teams, season_year)
                self._validate_data_completeness(season_df, season_year)
                combined_standings = pd.concat([combined_standings, season_df], axis=1)
            except ValueError as e:
                print(f"Warning: Skipping season {season_year} - {e}")
                continue
        
        return combined_standings

    @timebudget
    def build(
        self, json_data: dict, season: int, num_seasons: int = 3, display: bool = False
    ):
        """ Assigns self.df to a DataFrame containing all table standings for
            each season from current season to season [num_seasons] years ago.

            Rows: the 20 teams participating in the current season, ordered ascending
                by the team's position in the current season
            Columns (multi-index):
            -----------------------------------------------------------------
            |                         [SEASON YEAR]                         |
            |---------------------------------------------------------------|
            | position | played | won | draw | lost | gF | gA | gD | points |

            [SEASON YEAR]: 4-digit year values that a season began, from current
                season to season num_seasons ago
            position: unique integer from 1 to 20 depending on the table position
                the team holds in the season
            played: the number of games the team has played in the season.
            won: the number of games the team has won in the season.
            drawn: the number of games the team has drawn in the season.
            lost: the number of games the team has lost in the season.
            gF: goals for - the number of goals the team has scored in this season.
            gA: goals against - the number of games the team has lost in the season.
            gD: the number of games the team has lost in the season.
            points: the points acquired by the team.

        Args:
            json_data dict: the json data storage used to build the DataFrame.
            season: the year of the current season.
            num_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the DataFrame to console after
                creation. Defaults to False.
        """
        self.log_building(season)

        # Extract current season teams
        try:
            current_teams = self.extract_team_names(json_data, season)
        except ValueError as e:
            raise ValueError(f"Cannot build standings: {e}")

        if not current_teams:
            raise ValueError(f"No teams found for current season {season}")

        # Combine standings from multiple seasons
        df = self._combine_season_standings(json_data, current_teams, season, num_seasons)

        if df.empty:
            raise ValueError("No valid standings data found for any season")

        # Apply final cleaning and formatting
        df = self._clean_final_dataframe(df)

        if display:
            print(f"\nStandings for {len(current_teams)} teams across {num_seasons} seasons:")
            print(f"Seasons: {season} to {season - num_seasons + 1}")
            print(df)
            
            # Show sorting confirmation
            if not df.empty:
                current_season_col = df.columns.get_level_values(0)[0]
                if (current_season_col, "position") in df.columns:
                    is_sorted = df[(current_season_col, "position")].is_monotonic_increasing
                    print(f"\nSorted by current season position: {is_sorted}")

        self.df = df
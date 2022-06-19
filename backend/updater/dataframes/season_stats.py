import pandas as pd
from pandas import DataFrame
from timebudget import timebudget
from utils.utilities import Utilities

from dataframes.df import DF
from dataframes.form import Form

utils = Utilities()

class SeasonStats(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'season_stats')

    @staticmethod
    def _format_position(position: int) -> str:
        j = position % 10
        k = position % 100

        if j == 1 and k != 11:
            postfix = 'st'
        elif j == 2 and k != 12:
            postfix = 'nd'
        elif j == 3 and k != 13:
            postfix = 'rd'
        else:
            postfix = 'th'

        ordinal_position = str(position) + postfix
        return ordinal_position

    def _get_stat(
        self,
        team_name: str,
        col_heading: str,
        ascending: bool
    ) -> tuple[float, str]:
        stat = self.df.at[team_name, col_heading]
        position = self.df[col_heading].sort_values(
            ascending=ascending).index.get_loc(team_name) + 1
        position = self._format_position(position)
        return stat, position

    def get_season_stats(
        self,
        team_name: str
    ) -> tuple[tuple[float, str], tuple[float, str], tuple[float, str]]:
        clean_sheets = self._get_stat(team_name, 'CleanSheetRatio', False)
        goals_per_game = self._get_stat(team_name, 'XG', False)
        conceded_per_game = self._get_stat(team_name, 'XC', True)
        return clean_sheets, goals_per_game, conceded_per_game

    @staticmethod
    def _row_season_goals(
        row: pd.Series,
        matchdays: list[str]
    ) -> tuple[int, int, int, int]:
        n_games = 0
        clean_sheets = 0
        failed_to_score = 0
        goals_scored = 0
        goals_conceded = 0

        for matchday in matchdays:
            at_home = row[matchday]['AtHome']
            score = row[matchday]['Score']
            if score is not None:
                home, away = utils.extract_int_score(score)

                if at_home:
                    goals_scored += home
                    goals_conceded += away
                    if away == 0:
                        clean_sheets += 1
                    if home == 0:
                        failed_to_score += 1
                else:
                    goals_scored += away
                    goals_conceded += home
                    if home == 0:
                        clean_sheets += 1
                    if away == 0:
                        failed_to_score += 1
                n_games += 1

        return n_games, clean_sheets, failed_to_score, goals_scored, goals_conceded

    @timebudget
    def build(self, form: Form, display: bool = False):
        """ Assigns self.df a dataframe for basic season statistics for the current 
            season.

            Rows: the 20 teams participating in the current season.
            Columns (multi-index):
            --------------------------------------------------
            | XG | XC | CleanSheetRatio | NoGoalRatio |

            XG: the total number of goals scored this season divided by 
                the number of games played.
            XC: the total number of goals conceded this season divided 
                by the number of games played.
            CleanSheetRatio: the number of games without a goal conceded this 
                season divided by the number of games played.
            NoGoalRatio: the number of games without a goal scored this 
                season divided by the number of games played.

        Args:
            form Form: a completed dataframe containing a snapshot of information
                regarding each team's form after each completed matchday.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building season stats dataframe... ')
        self._check_dependencies(form)

        if form.df.empty:
            raise ValueError(
                '❌ [ERROR] Cannot build season stats dataframe: Form dataframe empty')

        matchdays = list(form.df.columns.unique(level=0))

        season_stats = {'XG': {},
                        'XC': {},
                        'CleanSheetRatio': {},
                        'NoGoalRatio': {}}  # type: dict[str, dict[str, float]]
        for team_name, row in form.df.iterrows():
            n_games, clean_sheets, failed_to_score, goals_scored, goals_conceded = self._row_season_goals(
                row, matchdays)

            # Initialise
            for d in season_stats.values():
                d[team_name] = 0.0

            if n_games > 0:
                season_stats['XG'][team_name] = round(
                    goals_scored / n_games, 2)
                season_stats['XC'][team_name] = round(
                    goals_conceded / n_games, 2)
                season_stats['CleanSheetRatio'][team_name] = round(
                    clean_sheets / n_games, 2)
                season_stats['NoGoalRatio'][team_name] = round(
                    failed_to_score / n_games, 2)

        season_stats = pd.DataFrame.from_dict(season_stats)
        season_stats.index.name = 'Team'

        if display:
            print(season_stats)

        self.df = season_stats

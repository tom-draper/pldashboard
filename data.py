from collections import defaultdict
from dataclasses import field
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from pandas.core.frame import DataFrame
from timebudget import timebudget

from utilities import Utilities

util = Utilities()


class DF:
    def __init__(self, d: DataFrame = DataFrame(), name: str = None):
        if not d.empty:
            self.df = DataFrame(d)
        self.name = name
        self.last_updated = None  # type: datetime

    def __str__(self):
        return str(self.df)
    
    def _save_to_html(self):
        html = self.df.to_html(justify='center')
        with open(f'./templates/tables/{self.name}.html', 'w') as f:
            f.write(html)

    def _check_dependencies(self, *args):
        for arg in args:
            if arg.df.empty:
                raise ValueError(f'❌ [ERROR] Cannot {self.name} dataframe: {arg.name} dataframe empty')


class Standings(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'standings')

    def get_position(self, team_name: str, season: int) -> DataFrame:
        return self.df.at[team_name, (season, 'Position')]

    def get_table_snippet(
            self, 
            team_name: str, 
            season: int
        ) -> tuple[list[tuple[int, str, int, int]], int]:
        team_df_idx = self.df.index.get_loc(team_name)

        # Get range of table the snippet should cover
        # Typically 3 teams below + 3 teams above, unless near either end of the table
        low_idx = team_df_idx - 3
        high_idx = team_df_idx + 4
        if low_idx < 0:
            # Add overflow amount to the high_idx to ensure 7 teams 
            overflow = low_idx
            high_idx -= low_idx  # Subtracting a negative
            low_idx = 0
        if high_idx > self.df.shape[0] - 1:
            # Subtract overflow amount from the low_idx to ensure 7 teams
            overflow = high_idx - (self.df.shape[0])
            low_idx -= overflow
            high_idx = self.df.shape[0]

        rows = self.df.iloc[low_idx:high_idx]
        team_names = rows.index.values.tolist()
        # Remove 'FC' from end of each team name (nicer to display)
        team_names = list(map(lambda name: ' '.join(name.split(' ')[:-1]), team_names))
        # Get new index of this team, relative to section of rows dataframe
        team_idx = rows.index.get_loc(team_name)

        # Only keep relevant columns
        rows = rows[season][['Position', 'GD', 'Points']]

        # List of table rows: [ [pos, name, gd, points] ... ]
        table_snippet = rows.values.tolist()
        # Add the team names into position 1 of each table row
        for row_list, team_name in zip(table_snippet, team_names):
            row_list.insert(1, team_name)

        return table_snippet, team_idx

    def _fill_rows_from_data(self, data: dict) -> dict[str, dict[str, int]]:
        df_rows = {}  # type: dict[str, dict[str, int]]
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')
            # Init teams if doesn't already exits
            for team in [home_team, away_team]:
                if team not in df_rows:
                    df_rows[team] = {'Position': None, 'Played': 0, 'Won': 0, 'Drawn': 0, 'Lost': 0, 'GF': 0, 'GA': 0,
                                     'GD': 0, 'Points': 0}

            if match['status'] == 'FINISHED':
                home_goals = match['score']['fullTime']['homeTeam']
                away_goals = match['score']['fullTime']['awayTeam']

                # Increment Played
                df_rows[home_team]['Played'] += 1
                df_rows[away_team]['Played'] += 1
                # Add GF
                df_rows[home_team]['GF'] += home_goals
                df_rows[away_team]['GF'] += away_goals
                # Add GA
                df_rows[home_team]['GA'] += away_goals
                df_rows[away_team]['GA'] += home_goals

                # Record result and points
                if home_goals > away_goals:  # Home team win
                    df_rows[home_team]['Won'] += 1
                    df_rows[away_team]['Lost'] += 1
                    # Points
                    df_rows[home_team]['Points'] += 3
                elif home_goals < away_goals:
                    df_rows[home_team]['Lost'] += 1
                    df_rows[away_team]['Won'] += 1
                    # Points
                    df_rows[away_team]['Points'] += 3
                else:  # Draw
                    df_rows[home_team]['Drawn'] += 1
                    df_rows[away_team]['Drawn'] += 1
                    # Points
                    df_rows[home_team]['Points'] += 1
                    df_rows[away_team]['Points'] += 1

        return df_rows

    def _add_gd_col(self, df_rows: dict):
        for team in df_rows.keys():
            df_rows[team]['GD'] = df_rows[team]['GF'] - df_rows[team]['GA']

    def _add_position_col(self, df_rows: dict):
        for idx, team in enumerate(df_rows.keys()):
            # Position is index as they have been sorted by points
            df_rows[team]['Position'] = idx + 1
    
    def _season_standings_from_fixtures(
            self, 
            json_data: dict, 
            team_names: list[str], 
            season: int
        ) -> DataFrame:
        """Slower alternative to _season_standings"""
        data = json_data['fixtures'][season]

        df_rows = self._fill_rows_from_data(data)
        self._add_gd_col(df_rows)

        # Sort rows by Points, then GD, then GF
        df_rows = dict(sorted(df_rows.items(), key=lambda v: [v[1]['Points'], v[1]['GD'], v[1]['GF']], reverse=True))
        # Use df sorted by points to insert table position
        self._add_position_col(df_rows)

        df = pd.DataFrame.from_dict(df_rows, orient='index')
        col_headings = ['Position', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']
        df.columns = pd.MultiIndex.from_product([[season], col_headings])

        # Drop any rows with columns not in the current season
        df = df.drop(df[~df.index.isin(team_names)].index)
        return df

    def _season_standings(
            self, 
            json_data: dict, 
            current_teams: list[str], 
            season: int
        ) -> DataFrame:
        data = json_data['standings'][season]
        df = pd.DataFrame(data)
        
        # Rename teams to their team name
        team_names = [name.replace('&', 'and') for name in [df['team'][x]['name'] for x in range(len(df))]]
        df = df.drop(columns=['form', 'team'])
        df.index = team_names

        # Move points column to the end
        points_col = df.pop('points')
        df.insert(8, 'points', points_col)
        col_headings = ['Position', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']
        df.columns = pd.MultiIndex.from_product([[season], col_headings])
        
        df = df.drop(index=df.index.difference(current_teams))
        return df

    @timebudget
    def update(
            self, 
            json_data: dict, 
            team_names: list[str], 
            season: int, 
            no_seasons: int = 3, 
            display: bool = False
        ):
        """ Assigns self.df to a dataframe containing all table standings for 
            each season from current season to season [no_seasons] years ago.
            
            Rows: the 20 teams participating in the current season, ordered ascending 
                by the team's position in the current season 
            Columns (multi-index):
            -----------------------------------------------------------------
            |                         [SEASON YEAR]                         |
            |---------------------------------------------------------------|
            | Position | Played | Won | Draw | Lost | GF | GA | GD | Points | 
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago
            Position: unique integer from 1 to 20 depending on the table position 
                the team holds in the season
            Played: the number of games the team has played in the season.
            Won: the number of games the team has won in the season.
            Drawn: the number of games the team has drawn in the season.
            Lost: the number of games the team has lost in the season.
            GF: goals for - the number of goals the team has scored in this season.
            GA: goals against - the number of games the team has lost in the season.
            GD: the number of games the team has lost in the season.
            Points: the points aquired by the team.
            
        Args:
            json_data dict: the json data storage used to build the dataframe
            team_names list: the team names of the teams within the current season
            season: the year of the current season
            no_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building standings dataframe...')

        # Check for dependencies
        if not team_names:
            raise ValueError('❌ [ERROR] Cannot build standings dataframe: Team names list not available')

        standings = pd.DataFrame()

        # Loop from current season to the season 2 years ago
        for n in range(no_seasons):
            season_standings = self._season_standings(json_data, team_names, season - n)
            standings = pd.concat((standings, season_standings), axis=1)

        standings = standings.fillna(0).astype(int)
        standings.index.name = 'Team'
        standings.columns.names = ('Season', None)

        if display:
            print(standings)

        self.df = standings


class Fixtures(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'fixtures')
        
    def get_n_games_played(self, team_name: str) -> int:
        return (self.df.loc[team_name, (slice(None), 'Status')] == 'FINISHED').values.sum()
    
    def _inc_avg_scored_conceded(
            self, 
            avg_scored: float, 
            avg_conceded: float, 
            h: int, 
            a: int, 
            at_home: bool
        ):
        if at_home:
            avg_scored += h
            avg_conceded += a
        else:
            avg_conceded += h
            avg_scored += a
            
        return avg_scored, avg_conceded
        
    def get_avg_result(self, team_name: str) -> tuple[float, float]:
        avg_scored = 0
        avg_conceded = 0
        total = 0
        for matchday_no in self.df.columns.unique(level=0):
            if self.df.at[team_name, (matchday_no, 'Status')] == 'FINISHED':
                at_home = self.df.at[team_name, (matchday_no, 'AtHome')]
                score = self.df.at[team_name, (matchday_no, 'Score')]
                h, a = util.extract_int_score(score)
                avg_scored, avg_conceded = self._inc_avg_scored_conceded(avg_scored, avg_conceded, h, a, at_home)
                total += 1
                
        avg_scored = avg_scored / total
        avg_conceded = avg_conceded / total
        
        return avg_scored, avg_conceded

    def n_goals_distribution(self):
        dist = defaultdict(lambda: 0)
        
        for matchday_no in self.df.columns.unique(level=0):
            for _, row in self.df[matchday_no].iterrows():
                score = row['Score']
                if score is not None:
                    h, a = util.extract_int_score(score)
                    dist[h+a] += 1
                    
        total_goals = sum(dist.values())
        for k, v in dist.items():
            dist[k] = v/total_goals
        
        import matplotlib.pyplot as plt
        
        x = list(range(10))
        y = []
        for x_ in x:
            y.append(dist[x_])
        
        print('Over 0.5:', sum(y[1:]))
        print('Over 1.5:', sum(y[2:]))
        print('Over 2.5:', sum(y[3:]))
        print('Over 3.5:', sum(y[4:]))
        print('Over 4.5:', sum(y[5:]))
        
        plt.bar(x, y)
        plt.show()
    
    def _insert_home_team_row(self, matchday: dict, match: dict, team_names: list[str]):
        score = None
        if match['score']['fullTime']['homeTeam'] is not None:
            score = f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}"
        
        matchday[(match["matchday"], 'Date')].append(datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ"))
        matchday[(match["matchday"], 'AtHome')].append(True)
        matchday[(match["matchday"], 'Team')].append(match['awayTeam']['name'].replace('&', 'and'))
        matchday[(match["matchday"], 'Status')].append(match['status'])
        matchday[(match["matchday"], 'Score')].append(score)
        team_names.append(match['homeTeam']['name'].replace('&', 'and'))
    
    def _insert_away_team_row(self, matchday: dict, match: dict, team_names: list[str]):
        score = None
        if match['score']['fullTime']['homeTeam'] is not None:
            score = f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}"

        matchday[(match["matchday"], 'Date')].append(datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ"))
        matchday[(match["matchday"], 'AtHome')].append(False)
        matchday[(match["matchday"], 'Team')].append(match['homeTeam']['name'].replace('&', 'and'))
        matchday[(match["matchday"], 'Status')].append(match['status'])
        matchday[(match["matchday"], 'Score')].append(score)
        team_names.append(match['awayTeam']['name'].replace('&', 'and'))
    
    def _insert_team_row(
            self, 
            matchday: int, 
            match: dict, 
            team_names: list[str], 
            home_team: bool
        ):
        date = datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ")
        
        if home_team:
            team_name = match['homeTeam']['name'].replace('&', 'and')
            opp_team_name = match['awayTeam']['name'].replace('&', 'and')
        else:
            team_name = match['awayTeam']['name'].replace('&', 'and')
            opp_team_name = match['homeTeam']['name'].replace('&', 'and')
        
        score = None
        if match['score']['fullTime']['homeTeam'] is not None:
            score = f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}"
        
        matchday[(match['matchday'], 'Date')].append(date)
        matchday[(match['matchday'], 'AtHome')].append(home_team)
        matchday[(match['matchday'], 'Team')].append(opp_team_name)
        matchday[(match['matchday'], 'Status')].append(match['status'])
        matchday[(match['matchday'], 'Score')].append(score)
        team_names.append(team_name)
        
        

    @timebudget
    def update(self, json_data: dict, season: int, display: bool = False):
        """ Builds a dataframe containing the past and future fixtures for the 
            current season (matchday 1 to 38) and inserts it into the fixtures 
            class variable.
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ---------------------------------------------
            |             Matchday Number]              |
            ---------------------------------------------
            | Date | AtHome | Team  | Status  | Score |
            
            Matchday [X]: where X is integers from 1 to 38
            Date: datetime value for the day a match is scheduled for or taken 
                place on
            AtHome: whether the team is playing that match at home or away, 
                either True or False
            Team: the name of the opposition team
            Status: the current status of that match, either 'FINISHED', 'IN PLAY' 
                or 'SCHEDULED'
            Score: the score of that game, either 'X - Y' if status is 'FINISHED'
                or None if status is 'SCHEDULED' or 'IN-PLAY'
        
        Args:
            json_data dict: the json data storage used to build the dataframe
            season int: the year of the current season
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building fixtures dataframe... ')

        data = json_data['fixtures'][season]

        team_names = []  # type: list[str]
        team_names_index = []  # Specific order of team names to be dataframe index
        matchday = defaultdict(lambda: [])  # type: dict[tuple[int, str], list]
        matchdays = []  # type: list[DataFrame]
        prev_matchday = 0
        for match in sorted(data, key=lambda x: x['matchday']):
            # If moved on to data for the next matchday, or 
            if prev_matchday < match['matchday']:
                # Package matchday dictionary into dataframe to concatenate into main fixtures dataframe
                df_matchday = pd.DataFrame(matchday)
                df_matchday.index = team_names

                matchday = defaultdict(lambda: [])
                # If just finished matchday 1 data, take team name list order as main fixtures dataframe index
                if prev_matchday == 1:
                    team_names_index = team_names[:]
                matchdays.append(df_matchday)

                prev_matchday = match['matchday']
                team_names = []

            self._insert_team_row(matchday, match, team_names, True)
            self._insert_team_row(matchday, match, team_names, False)

        # Add last matchday (38) dataframe to list
        df_matchday = pd.DataFrame(matchday)
        df_matchday.index = team_names
        matchdays.append(df_matchday)

        fixtures = pd.concat(matchdays, axis=1)
        
        fixtures.index = team_names_index
        fixtures.columns.names = ("Matchday", None)
        fixtures.index.name = 'Team'
        
        if display:
            print(fixtures)

        self.df = fixtures


class TeamRatings(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'team_ratings')

    def _calc_rating(self, points: int, gd: int) -> float:
        return points + gd

    def _get_season_weightings(self, no_seasons: int) -> list[float]:
        mult = 2.5  # High = recent weighted more
        season_weights = [0.01*(mult**3), 0.01*(mult**2), 0.01*mult, 0.01]
        weights = np.array(season_weights[:no_seasons])
        return list(weights / sum(weights))  # Normalise list

    def _calc_total_rating_col(
            self, 
            team_ratings: dict, 
            no_seasons: int, 
            include_current_season: bool,
        ):
        # Calculate total rating column
        team_ratings['TotalRating'] = 0
        if include_current_season:
            start_n = 0  # Include current season when calculating total rating
            w = self._get_season_weightings(no_seasons)  # Column weights
        else:
            start_n = 1  # Exclude current season when calculating total rating
            w = self._get_season_weightings(no_seasons - 1)  # Column weights

        for n in range(start_n, no_seasons):
            team_ratings['TotalRating'] += w[n - start_n] * team_ratings[f'NormalisedRating{n}YAgo']

    @timebudget
    def update(
            self, 
            standings: Standings, 
            season: int, 
            games_threshold: int, 
            n_seasons: int = 3, 
            display: bool = False,
        ):
        """ Assigns self.df a dataframe containing each team's calculated 
            'team rating' based on the last [no_seasons] seasons results.
            
            Rows: the 20 teams participating in the current season, ordered 
                descending by the team's rating
            Columns (multi-index):
            ---------------------------------------------------------------------------------------------------
            | RatingCurrent | Rating[N]YAgo | NormalisedRatingCurrent | NormalisedRating[N]YAgo | TotalRating |
            
            RatingCurrent: a calculated positive or negative value that represents
                the team's rating based on the state of the current season's 
                standings table.
            Rating[N]YAgo: a calculated positive or negative value that represents 
                the team's rating based on the state of the standings table [N]
                seasons ago.
            NormalisedRatingCurrent: the Rating Current column value normalised
            NormalisedRating[N]YAgo: the Rating [N]Y Ago column values normalised
            TotalRating: a final normalised rating value incorporating the values 
                from all normalised columns.
                
        Args:
            standings Standings: a completed dataframe filled with standings data 
                for the last n_seasons seasons
            season int: the year of the current season
            games_threshold: the minimum number of home games all teams must have 
                played in any given season for the home advantage calculated for 
                each team during that season to be incorporated into the total home
                advantage value
            n_seasons (int, optional): number of seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building team ratings dataframe... ')
        self._check_dependencies(standings)

        # Add current season team names to the object team dataframe
        team_ratings = pd.DataFrame(index=standings.df.index)

        # Create column for each included season
        for n in range(0, n_seasons):
            team_ratings[f'Rating{n}YAgo'] = np.nan

        # Insert rating values for each row
        for team_name, row in standings.df.iterrows():
            for n in range(n_seasons):
                rating = self._calc_rating(row[season-n]['Points'], row[season-n]['GD'])
                team_ratings.loc[team_name, f'Rating{n}YAgo'] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in team_ratings.columns:
            team_ratings[col] = team_ratings[col].replace(np.nan, team_ratings[col].min())

        # Create normalised versions of the three ratings columns
        for n in range(0, n_seasons):
            team_ratings[f'NormalisedRating{n}YAgo'] = (team_ratings[f'Rating{n}YAgo']
                                                        - team_ratings[f'Rating{n}YAgo'].min()) \
                                                       / (team_ratings[f'Rating{n}YAgo'].max()
                                                          - team_ratings[f'Rating{n}YAgo'].min())

        # Check whether current season data should be included in each team's total rating
        include_current_season = True
        if (standings.df[season]['Played'] <= games_threshold).all():  # If current season hasn't played enough games
            print(f'Current season excluded from team ratings calculation -> all teams must have played {games_threshold} games.')
            include_current_season = False

        self._calc_total_rating_col(team_ratings, n_seasons, include_current_season)

        team_ratings = team_ratings.sort_values(by="TotalRating", ascending=False)
        team_ratings = team_ratings.rename(columns={'Rating0YAgo': 'RatingCurrent', 
                                                    'NormalisedRating0YAgo': 'NormalisedRatingCurrent'})

        if display:
            print(team_ratings)

        self.df = team_ratings


class Form(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'form')
        self.current_matchday = None

    def get_current_form_rating(self, team_name: str):
        current_matchday = self._get_current_matchday()
        matchday = self._get_last_played_matchday(current_matchday, team_name)

        return self._get_form_rating(team_name, matchday, 5)

    def get_long_term_form_rating(self, team_name: str):
        current_matchday = self._get_current_matchday()
        matchday = self._get_last_played_matchday(current_matchday, team_name)

        return self._get_form_rating(team_name, matchday, 10)
        
    def _n_should_have_played(self, current_matchday: int, maximum: int) -> int:
        return min(maximum, current_matchday)

    def _not_played_current_matchday(
            self, 
            recent_games: list[str], 
            current_matchday: int, 
            N: int
        ) -> bool:
        n_should_have_played = self._n_should_have_played(current_matchday, N)
        return len(recent_games) != n_should_have_played
    
    def _get_last_played_matchday(self, current_matchday: int, team_name: str) -> int:
        matchday = current_matchday
        if self._not_played_current_matchday(team_name, current_matchday):
            # Use previous matchday's form
            matchday = self._get_prev_matchday()
        return matchday
        
    def _get_form(self, team_name: str, matchday: int) -> list[str]:
        form = []
        if matchday is not None:
            form = self.df.at[team_name, (matchday, 'Form5')]
            if form is None:
                form = []
            else:
                form = list(form)
        form = form + ['None'] * (5 - len(form))  # Pad list
        form.reverse()
        return form
    
    def _not_played_current_matchday(
            self, 
            team_name: str, 
            current_matchday: int
        ) -> bool:
        return self.df.at[team_name, (current_matchday, 'Score')] == None

    def _get_latest_teams_played(
            self, 
            team_name: str, 
            matchday: int, 
            N: int
        ) -> list[str]:
        latest_teams_played = []
        if matchday is not None:
            latest_teams_played = self._get_last_n_values(team_name, 'Team', matchday, N)
        latest_teams_played.reverse()
        return latest_teams_played

    def _get_form_rating(self, team_name: str, matchday: int, n_games: int) -> float:
        rating = 0
        if matchday is not None:
            rating = (self.df.at[team_name, (matchday, f'FormRating{n_games}')] * 100).round(1)
        return rating

    def _get_won_against_star_team(
            self, 
            team_name: str, 
            matchday: int, 
            N: int
        ) -> list[str]:
        won_against_star_team = []  # 'star-team' or 'not-star-team' elements
        if matchday is not None:
            won_against_star_team = self._get_last_n_values(team_name, 'WonAgainstStarTeam', matchday, N)
            # Replace boolean values with CSS tag for super win image
            won_against_star_team = ['star-team' if x else 'not-star-team' for x in won_against_star_team]
        won_against_star_team.reverse()
        return won_against_star_team
    
    def _get_last_n_values(
            self, 
            team_name: str, 
            column_name: str, 
            start_matchday: int, 
            N: int
        ) -> list:
        col_headings = [(start_matchday-i, column_name) for i in range(N) if start_matchday-i > 0]
        values = [self.df.at[team_name, col] for col in col_headings]
        return values

    def _get_prev_matchday(self):
        return self._get_current_matchday() - 1
    
    def _get_current_matchday(self):
        current_matchday = None
        if len(self.df.columns.unique(level=0)) != 0:
            current_matchday = max(self.df.columns.unique(level=0))
        return current_matchday
        
    def get_recent_form(
            self, 
            team_name: str
        ) -> tuple[list[str], DataFrame, float, list[str]]:
        current_matchday = self._get_current_matchday()
        matchday = self._get_last_played_matchday(current_matchday, team_name)

        form = self._get_form(team_name, matchday)  # List of five 'W', 'D' or 'L'
        latest_teams_played = self._get_latest_teams_played(team_name, matchday, 5)
        rating = self._get_form_rating(team_name, matchday, 5)
        won_against_star_team = self._get_won_against_star_team(team_name, matchday, 5)
        return form, latest_teams_played, rating, won_against_star_team
    
    def _get_points(self, gd: int) -> int:
        if gd > 0:
            pts = 3
        elif gd < 0:
            pts = 0
        else:
            pts = 1
        return pts
    
    def _get_gd(self, score: str, at_home: bool) -> int:
        home, away = util.extract_int_score(score)
        if at_home:
            gd = home - away
        else:
            gd = away - home
        return gd
    
    def _insert_gd_and_pts_col(self, form: DataFrame, matchday_no: int):
        gd_col = []
        pts_col = []
        col = form[(matchday_no, 'Score')]
        for team, score in col.iteritems():
            if score is None:
                gd = 0
                pts = 0
            else:
                at_home = form.at[team, (matchday_no, 'AtHome')]
                gd = self._get_gd(score, at_home)
                pts = self._get_points(gd)
            gd_col.append(gd)
            pts_col.append(pts)
        
        if matchday_no != 1:
            gd_cum_col = form[(matchday_no-1, 'CumulativeGD')] + np.array(gd_col)
            pts_cum_col = form[(matchday_no-1, 'CumulativePoints')] + np.array(pts_col)
        else:
            gd_cum_col = gd_col
            pts_cum_col = pts_col
        
        form[(matchday_no, 'GD')] = gd_col
        form[(matchday_no, 'Points')] = pts_col
        form[(matchday_no, 'CumulativeGD')] = gd_cum_col
        form[(matchday_no, 'CumulativePoints')] = pts_cum_col
    
    def _insert_position_col(self, form: DataFrame, matchday_no: int):
        form.sort_values(by=[(matchday_no, 'CumulativePoints'), (matchday_no, 'CumulativeGD')], ascending=False, inplace=True)
        form[matchday_no, 'Position'] = list(range(1, 21))
    
    def _insert_won_against_star_team_col(
            self, 
            form: DataFrame, 
            team_ratings: TeamRatings, 
            matchday_no: int, 
            star_team_threshold: float
        ):
        won_against_star_team_col = []
        col = form[(matchday_no, 'Team')]
        for opp_team in col:
            opp_team_rating = team_ratings.df.at[opp_team, 'TotalRating']
            won_against_star_team = False
            if opp_team_rating > star_team_threshold:
                won_against_star_team = True
            won_against_star_team_col.append(won_against_star_team)
        form[(matchday_no, 'WonAgainstStarTeam')] = won_against_star_team_col
    
    def _append_to_from_str(self, form_str: list, home: int, away: int, at_home: bool):
        if home == away:
            result = 'D'
        elif at_home:
            if home > away:
                result = 'W'
            elif home < away:
                result = 'L'
        else:
            if home > away:
                result = 'L'
            elif home < away:
                result = 'W'
                
        form_str.append(result)
        
    def _insert_form_string(self, form: DataFrame, matchday_no: int, n_games: int):
        last_n_matchday_nos = [matchday_no-i for i in range(n_games) if matchday_no-i > 0]
        
        form_str_col = []
        cols = form[[(n, 'Score') for n in last_n_matchday_nos]]
        for team, row in cols.iterrows():
            form_str = []
            for i in range(row.size):
                at_home = form.at[team, (matchday_no-i, 'AtHome')]
                score = row[(matchday_no-i, 'Score')]
                if score is not None:
                    home, away = util.extract_int_score(score)
                    self._append_to_from_str(form_str, home, away, at_home)
                else:
                    form_str.append('N')

            form_str_col.append(''.join(form_str))
        
        form[(matchday_no, f'Form{n_games}')] = form_str_col

    def _calc_form_rating(
            self, 
            team_ratings: TeamRatings, 
            teams_played: list[str], 
            form_str: str,
            gds: list[int]
        ) -> float:
        form_rating = 0.5  # Default percentage, moves up or down based on performance
        if form_str is not None:  # If games have been played this season
            n_games = len(form_str)
            for idx, result in enumerate(form_str):
                # Convert opposition team initials to their name 
                opp_team = teams_played[idx]
                opp_team_rating = team_ratings.df.at[opp_team, 'TotalRating']
                # max_team_rating = team_ratings.df['TotalRating'].iloc[0]
                gd = abs(gds[idx])

                # Increment form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    form_rating += (opp_team_rating / n_games) * gd
                elif result == 'L':
                    form_rating -= (opp_team_rating / n_games) * gd

        form_rating = min(max(0, form_rating), 1)  # Cap rating
        return form_rating

    def _insert_form_rating_col(
            self, 
            form: DataFrame, 
            team_ratings: TeamRatings, 
            matchday_no: int, 
            n_games: int
        ):
        form_rating_col = []
        col = form[(matchday_no, f'Form{n_games}')]
        for team, form_str in col.iteritems():
            gds = self._get_form_last_n_values(form, team, 'GD', matchday_no, n_games)
            teams_played = self._get_form_last_n_values(form, team, 'Team', matchday_no, n_games)
            form_rating = self._calc_form_rating(team_ratings, teams_played, form_str, gds)
            form_rating_col.append(form_rating)
            
        form[(matchday_no, f'FormRating{n_games}')] = form_rating_col
    
    def _get_form_last_n_values(
            self,
            form: DataFrame,
            team_name: str,
            column_name: str, 
            start_matchday: int,
            N: int
        ) -> list:
        col_headings = [(start_matchday-i, column_name) for i in range(N) if start_matchday-i > 0]
        values = [form.at[team_name, col] for col in col_headings]
        return values
    
    def _convert_team_cols_to_initials(self, form: DataFrame, matchday_nos: list[int]):
        for matchday_no in matchday_nos:
            team_initials = [util.convert_team_name_or_initials(opp_team) for opp_team in form[(matchday_no, 'Team')]]
            form[(matchday_no, 'Team')] = team_initials
    
    def _get_played_matchdays(self, fixtures: Fixtures) -> list[int]:
        status = fixtures.df.loc[:, (slice(None), 'Status')]
        # Remove cols for matchdays that haven't played yet
        status = status.loc[:, (status == 'FINISHED').any()]
        matchday_nos = sorted(list(status.columns.get_level_values(0)))
        return matchday_nos
    
    def _add_form_columns(
            self, 
            form: DataFrame, 
            team_ratings: TeamRatings, 
            matchday_nos: list[int],
            star_team_threshold: float
        ):
        for matchday_no in matchday_nos:
            self._insert_gd_and_pts_col(form, matchday_no)
            self._insert_position_col(form, matchday_no)
            self._insert_won_against_star_team_col(form, team_ratings, matchday_no, star_team_threshold)
            self._insert_form_string(form, matchday_no, 5)
            self._insert_form_string(form, matchday_no, 10)
            self._insert_form_rating_col(form, team_ratings, matchday_no, 5)
            self._insert_form_rating_col(form, team_ratings, matchday_no, 10)
    
    def _clean_dataframe(self, form: DataFrame, matchday_nos: list[int]) -> DataFrame:
        self._convert_team_cols_to_initials(form, matchday_nos)
        # Drop columns used for working
        form = form.drop(columns=['Points'], level=1)
        form = form.reindex(sorted(form.columns.values), axis=1)
        form = form.sort_values(by=[(max(matchday_nos), 'FormRating5')], ascending=False)
        return form
        
    @timebudget
    def update(
            self, 
            fixtures: Fixtures,
            standings: Standings,
            team_ratings: TeamRatings, 
            star_team_threshold: float,
            display: bool = False
        ):
        """ Assigns self.df to a dataframe containing the form data for each team
            for the matchdays played in the current season.
            
            Rows: the 20 teams participating in the current season.
            Columns (multi-index):
            --------------------------------------------------------------------------------------------------------------------------------------------
            |                                                            [MATCHDAY NUMBER]                                                             |
            |------------------------------------------------------------------------------------------------------------------------------------------|
            | Date | Team | Score | GD | Position | Form5 | Form10 | FormRating5 | FormRating10 | CumulativeGD | CumulativePoints | WonAgainstStarTeam |
            
            [MATCHDAY NUMBER] int: the numbers of the matchdays that have been 
                played.
            Date: the datetime of the team's game played on that matchday.
            Team str: the initials of the opposition team played on that matchday.
            Score str: the score 'X - Y' of the game played on that matchday.
            GD int: the positive or negative goal difference achieved on that 
                matchday from the perspective of the team (row).
            Position int: the league standings position held on that matchday
            Form5 str: the form string up to the last 5 games (e.g. WWLDW) with the
                most recent result on the far left. String can take characters
                W, L, D or N (none - game not played).
            Form10: the form string up to the last 10 games (e.g. WWLDDLWLLW) with 
                the most recent result on the far left. String can take characters
                W, L, D or N (none - game not played).
            FormRating5 float: the calculated form rating based on the results of
                up to the last 5 games.
            FormRating10 float: the calculated form rating based on the results of
                up to the last 5 games.
            CumulativeGD: the total points GD achieved in the current matchday
                and all matchdays prior.
            CumulativePoints: the total points aquired in the current matchday
                and all matchdays prior.
            WonAgainstStarTeam bool: whether the team beat the opposition team
                and that team was considered a 'star team'
                
        Args:
            fixtures Fixtures: a completed dataframe containing past and future
                fixtures for each team within the current season
            standings Standings: a completed dataframe filled with standings data 
                for recent seasons
            team_ratings TeamRatings: a completed dataframe filled with long-term
                ratings for each team
            star_team_threshold float: the minimum team ratings required for a team
                to be considered a star team
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building form dataframe... ')
        self._check_dependencies(fixtures, standings, team_ratings)

        matchday_nos = self._get_played_matchdays(fixtures)
        form = fixtures.df[matchday_nos].drop(columns=['Status'], level=1)
        
        self._add_form_columns(form, team_ratings, matchday_nos, star_team_threshold)
        
        form = self._clean_dataframe(form, matchday_nos)

        if display:
            print(form)
        
        self.df = form


class SeasonStats(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'season_stats')

    def _format_position(self, position: int) -> str:
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
        position = self.df[col_heading].sort_values(ascending=ascending).index.get_loc(team_name) + 1
        position = self._format_position(position)
        return stat, position

    def get_season_stats(
            self, 
            team_name: str
        ) -> tuple[tuple[float, str], tuple[float, str], tuple[float, str]]:
        clean_sheets = self._get_stat(team_name, 'CleanSheetRatio', False)
        goals_per_game = self._get_stat(team_name, 'xG', False)
        conceded_per_game = self._get_stat(team_name, 'xC', True)
        return clean_sheets, goals_per_game, conceded_per_game

    def _row_season_goals(
            self, 
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
                home, away = util.extract_int_score(score)
                
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
    def update(self, form: Form, display: bool = False):
        """ Assigns self.df a dataframe for basic season statistics for the current 
            season.
            
            Rows: the 20 teams participating in the current season.
            Columns (multi-index):
            --------------------------------------------------
            | XG | XC | CleanSheetRatio | FailedToScoreRatio |
            
            xG: the total number of goals scored this season divided by 
                the number of games played.
            xC: the total number of goals conceded this season divided 
                by the number of games played.
            CleanSheetRatio: the number of games without a goal conceded this 
                season divided by the number of games played.
            FailedToScoreRatio: the number of games without a goal scored this 
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
            raise ValueError('❌ [ERROR] Cannot build season stats dataframe: Form dataframe empty')

        matchdays = list(form.df.columns.unique(level=0))

        season_stats = {'xG': {},
                        'xC': {},
                        'CleanSheetRatio': {},
                        'FailedToScoreRatio': {}}  # type: dict[str, dict[str, float]]
        for team_name, row in form.df.iterrows():
            n_games, clean_sheets, failed_to_score, goals_scored, goals_conceded = self._row_season_goals(row, matchdays)
            
            # Initialise
            for d in season_stats.values():
                d[team_name] = 0.0

            if n_games > 0:
                season_stats['xG'][team_name] = round(goals_scored / n_games, 2)
                season_stats['xC'][team_name] = round(goals_conceded / n_games, 2)
                season_stats['CleanSheetRatio'][team_name] = round(clean_sheets / n_games, 2)
                season_stats['FailedToScoreRatio'][team_name] = round(failed_to_score / n_games, 2)

        season_stats = pd.DataFrame.from_dict(season_stats)
        season_stats.index.name = 'Team'

        if display:
            print(season_stats)

        self.df = season_stats


class HomeAdvantages(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'home_advantages')

    def _home_advantages_for_season(self, d: defaultdict, data: dict, season: int):
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')

            if match['score']['winner'] is not None:
                home_goals = match['score']['fullTime']['homeTeam']
                away_goals = match['score']['fullTime']['awayTeam']
                if home_goals > away_goals:
                    # Home team wins
                    d[home_team][(season, 'Home', 'Wins')] += 1
                    d[away_team][(season, 'Away', 'Loses')] += 1
                elif home_goals < away_goals:
                    # Away team wins
                    d[home_team][(season, 'Home', 'Loses')] += 1
                    d[away_team][(season, 'Away', 'Wins')] += 1
                else: 
                    # Draw
                    d[home_team][(season, 'Home', 'Draws')] += 1
                    d[away_team][(season, 'Away', 'Draws')] += 1

    def _create_season_home_advantage_col(
            self,
            home_advantages: DataFrame,
            season: int
        ):
        played_at_home = home_advantages[season]['Home']['Wins'] \
                         + home_advantages[season]['Home']['Draws'] \
                         + home_advantages[season]['Home']['Loses']
        home_advantages[season, 'Home', 'Played'] = played_at_home
        
        # Percentage wins at home = total wins at home / total games played at home 
        win_ratio_at_home = home_advantages[season]['Home']['Wins'] / played_at_home
        home_advantages[season, 'Home', 'WinRatio'] = win_ratio_at_home

        played = played_at_home \
                 + home_advantages[season]['Away']['Wins'] \
                 + home_advantages[season]['Away']['Draws'] \
                 + home_advantages[season]['Away']['Loses']
        home_advantages[season, 'Overall', 'Played'] = played

        # Percentage wins = total wins / total games played
        win_ratio = (home_advantages[season]['Home']['Wins']
                     + home_advantages[season]['Away']['Wins']) / played
        home_advantages[season, 'Overall', 'WinRatio'] = win_ratio

        # Home advantage = percentage wins at home - percentage wins 
        home_advantage = win_ratio_at_home - win_ratio
        home_advantages[season, 'HomeAdvantage', ''] = home_advantage

    def _create_total_home_advantage_col(
            self, 
            home_advantages: DataFrame, 
            season: int,
            threshold: float
        ):
        home_advantages_cols = home_advantages.iloc[:, home_advantages.columns.get_level_values(1) == 'HomeAdvantage']
        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[season]['Home']['Played'] <= threshold).all():
            print(f"Current season excluded from home advantages calculation -> all teams must have played {threshold} home games.")
            # Drop this current seasons column (start from previous season)
            home_advantages_cols = home_advantages_cols.drop(season, level=0, axis=1)
        
        # Drop pandemic year (anomaly, no fans, data shows neutral home advantage)
        if (2020, 'HomeAdvantage', '') in list(home_advantages_cols.columns):
            home_advantages_cols = home_advantages_cols.drop((2020, 'HomeAdvantage', ''), axis=1)

        home_advantages = home_advantages.sort_index(axis=1)
        home_advantages['TotalHomeAdvantage'] = home_advantages_cols.mean(axis=1).fillna(0)
        home_advantages = home_advantages.sort_values(by='TotalHomeAdvantage', ascending=False)
        
        return home_advantages
        
    def _row_template(
            self, 
            season: int,
            no_seasons: int
        ) -> dict[tuple[int, str, str], int]:
        template = {}
        for i in range(no_seasons):
            template.update({(season-i, 'Home', 'Wins'):  0,
                             (season-i, 'Home', 'Draws'): 0,
                             (season-i, 'Home', 'Loses'): 0,
                             (season-i, 'Away', 'Wins'):  0,
                             (season-i, 'Away', 'Draws'): 0,
                             (season-i, 'Away', 'Loses'): 0})
        return template
    
    def _clean_dataframe(self, home_advantages: DataFrame) -> DataFrame:
        home_advantages = home_advantages.drop(columns=['Wins', 'Loses', 'Draws'], level=2)
        home_advantages.columns.names = ('Season', None, None)
        home_advantages.index.name = 'Team'
        
        return home_advantages

    @timebudget
    def update(
            self, 
            json_data: dict, 
            season: int, 
            threshold: float, 
            no_seasons: int = 3, 
            display: bool = False
        ):
        """ Assigns self.df a dataframe containing team's home advantage data 
            for each season with a combined total home advantage value.
            
            Rows: the 20 teams participating in the current season, ordered descending 
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------
            |                     [SEASON YEAR]                     | TotalHomeAdvantage |
            |-------------------------------------------------------|--------------------|
            |       Home        |      Overall      | HomeAdvantage |                    |
            |-------------------|-------------------|---------------|                    |
            | Played | WinRatio | Played | WinRatio |               |                    |
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago.
            Played: the number of games played in the season.
            WinsRatio: the win ratio of all games played in the season.
            HomeAdvantage: the difference between the ratio of games won at home 
                and the ratio of games won in total for a given season year.
            TotalHomeAdvantage: combined home advantages value from all seasons 
               in the table: the average home wins ratio / wins ratio.
                
        Args:
            json_data dict: the json data storage used to build the dataframe
            season int: the year of the current season
            threshold float: the minimum number of home games played to incorporate
                a season's home advantage calculation for all teams into the 
                Total Home Advantage value
            no_seasons (int, optional): number of seasons to include. 
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building home advantages dataframe... ')

        d = defaultdict(lambda: self._row_template(season, no_seasons))
        for i in range(no_seasons):
            data = json_data['fixtures'][season-i]
            self._home_advantages_for_season(d, data, season-i)

        home_advantages = pd.DataFrame.from_dict(d, orient='index')
        # Drop teams from previous seasons
        home_advantages = home_advantages.dropna(subset=home_advantages.loc[[], [season]].columns)
        home_advantages = home_advantages.fillna(0).astype(int)

        # Calculate home advantages for each season
        for i in range(no_seasons):
            self._create_season_home_advantage_col(home_advantages, season-i)

        # Create the final overall home advantage value for each team
        home_advantages = self._create_total_home_advantage_col(home_advantages, season, threshold)
        
        # Remove working columns
        home_advantages = self._clean_dataframe(home_advantages)

        if display:
            print(home_advantages)

        self.df = home_advantages


class Upcoming(DF):
    def __init__(self, current_season, d: DataFrame = DataFrame()):
        super().__init__(d, 'upcoming')
        from predictions import Predictions
        self.predictions = Predictions(current_season)

    def _get_opposition(self, team_name: str) -> str:
        return self.df.at[team_name, 'NextTeam']

    def _get_previous_matches(self, team_name: str) -> list:
        return self.df.at[team_name, 'PreviousMatches']

    def _get_at_home(self, team_name: str) -> str:
        return self.df.at[team_name, 'AtHome']

    def get_details(self, team_name: str) -> tuple[str, str, list]:
        opp_team_name = ''
        at_home = ''
        prev_matches = []
        if not self.df.empty:
            # If season not finished
            opp_team_name = self._get_opposition(team_name)
            at_home = self._get_at_home(team_name)
            prev_matches = self._get_previous_matches(team_name)

        return opp_team_name, at_home, prev_matches

    def _get_next_game(
            self, 
            team_name: str, 
            fixtures: Fixtures
        ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        date = None  # type: Optional[str]
        next_team = None  # type: Optional[str]
        at_home = None  # type: Optional[str]
        # Scan through list of fixtures to find the first that is 'scheduled'
        for matchday_no in fixtures.df.columns.unique(level=0):
            if fixtures.df.at[team_name, (matchday_no, 'Status')] == 'SCHEDULED':
                date = fixtures.df.at[team_name, (matchday_no, 'Date')]
                next_team = fixtures.df.at[team_name, (matchday_no, 'Team')]
                at_home = fixtures.df.at[team_name, (matchday_no, 'AtHome')]
                break

        return date, next_team, at_home

    def _get_next_game_prediction(
            self, 
            team_name: str
        ) -> tuple[str, int, str, int]:
        at_home = self.df.at[team_name, 'AtHome']
        
        if at_home:
            home_initials = util.convert_team_name_or_initials(team_name)
            away_initials = util.convert_team_name_or_initials(self.df.at[team_name, 'NextTeam'])
        else:
            home_initials = util.convert_team_name_or_initials(self.df.at[team_name, 'NextTeam'])
            away_initials = util.convert_team_name_or_initials(team_name)
        
        prediction = self.df.at[team_name, 'Prediction']
        xg_home = prediction['homeGoals']
        xg_away = prediction['awayGoals']
        
        return home_initials, xg_home, away_initials, xg_away

    def _get_next_game_prediction_scoreline(self, team_name: str) -> str:
        home_initials, xg_home, away_initials, xg_away = self._get_next_game_prediction(team_name)
        return f'{home_initials} {xg_home} - {xg_away} {away_initials}'

    def _game_result_tuple(self, match: dict) -> tuple[str, str]:
        home_score = match['score']['fullTime']['homeTeam']
        away_score = match['score']['fullTime']['awayTeam']
        if home_score == away_score:
            result = ('Drew', 'Drew')
        elif home_score > away_score:
            result = ('Won', 'Lost')
        else:
            result = ('Lost', 'Won')

        return result

    def _prev_match(
            self, 
            date: datetime,
            home_team: str,
            away_team: str, 
            home_goals: int,
            away_goals: int,
            result: str
        ) -> dict:
        readable_date = self._readable_date(date)
        prev_match = {'Date': date,
                      'ReadableDate': readable_date,
                      'HomeTeam': home_team,
                      'AwayTeam': away_team,
                      'HomeGoals': home_goals,
                      'AwayGoals': away_goals,
                      'Result': result}
        return prev_match

    def _append_prev_match(
            self, 
            next_games: dict,
            home_team: str,
            away_team: str, 
            home_goals: int,
            away_goals: int,
            date: str,
            result: tuple[str, str]
        ):
        # From the perspective from the home team
        # If this match's home team has their next game against this match's away team
        if next_games[home_team]['NextTeam'] == away_team:
            prev_match = self._prev_match(date, home_team, away_team, home_goals, away_goals, result[0])
            next_games[home_team]['PreviousMatches'].append(prev_match)

        if next_games[away_team]['NextTeam'] == home_team:
            prev_match = self._prev_match(date, home_team, away_team, home_goals, away_goals, result[1])
            next_games[away_team]['PreviousMatches'].append(prev_match)
    
    def _ord(self, n: int) -> str:
        return str(n) + ("th" if 4<=n%100<=20 else {1:"st",2:"nd",3:"rd"}.get(n%10, "th"))
    
    def _readable_date(self, date: datetime) -> str:
        dt = datetime.strptime(date[:10], "%Y-%m-%d")
        day = self._ord(dt.day)
        return day + dt.date().strftime(' %B %Y')

    def _sort_prev_matches_by_date(self, next_games: dict):
        for _, row in next_games.items():
            row['PreviousMatches'] = sorted(row['PreviousMatches'], key=lambda x: x['Date'], reverse=True)

    def _append_season_prev_matches(
            self, 
            next_games: dict, 
            json_data: dict, 
            season: int,
            team_names: list[str]
        ):
        if team_names is None:
            raise ValueError()
        
        data = json_data['fixtures'][season]

        for match in data:
            if match['status'] == 'FINISHED':
                home_team = match['homeTeam']['name'].replace('&', 'and')  # type: str
                away_team = match['awayTeam']['name'].replace('&', 'and')  # type: str

                if home_team in team_names and away_team in team_names:
                    home_goals = match['score']['fullTime']['homeTeam']
                    away_goals = match['score']['fullTime']['homeTeam']
                    date = match['utcDate']
                    result = self._game_result_tuple(match)
                    self._append_prev_match(next_games, home_team, away_team, 
                                            home_goals, away_goals, date, result)
        
    @timebudget
    def update(
            self, 
            json_data: dict,
            fixtures: Fixtures,
            form: Form, 
            home_advantages: HomeAdvantages,
            team_names: list[str], 
            season: int,
            n_seasons: int = 3,
            display: bool = False
        ):
        """ Assigns self.df a dataframe for details about the next game each team 
            has to play.
            
            Rows: the 20 teams participating in the current season
            Columns:
            --------------------------------------------
            | NextGame | AtHome | Previous Meetings |
            
            NextGame: name of the opposition team in a team's next game
            AtHome: whether the team is playing the next match at home or away, 
                either True or False
            PreviousMatches: list of (String Date, Home Team, Away Team, Home Score, 
                Away Score, Winning Team) tuples of each previous game between the
                two teams
                
        Args:
            json_dict dict: the json data storage used to build the dataframe.
            fixtures Fixtures: a completed dataframe containing past and future
                fixtures for each team within the current season.
            form Form: a completed dataframe containing a snapshot of information
                regarding each team's form after each completed matchday.
            home_advantages HomeAdvantages: a completed dataframe containing the
                quantified home advantage each team recieves.
            team_names list: a list of the 20 teams participating in the current 
                season.
            season int: the year of the current season.
            n_seasons (int, optional): number of seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🛠️  Building upcoming dataframe... ')
        self._check_dependencies(fixtures, form)
        if not team_names:
            raise ValueError('❌ [ERROR] Cannot build upcoming dataframe: Teams names list empty')
        
        d = {}  # type: dict[str, dict[str, Optional[str] | list]]
        for team_name in team_names:
            date, next_team, at_home = self._get_next_game(team_name, fixtures)
            d[team_name] = {'Date': date, 
                            'NextTeam': next_team,  
                            'AtHome': at_home,
                            'PreviousMatches': []}

        for i in range(n_seasons):
            self._append_season_prev_matches(d, json_data, season-i, team_names)

        # Format previous meeting dates as long, readable str
        self._sort_prev_matches_by_date(d)
        
        upcoming = pd.DataFrame.from_dict(d, orient='index')
        
        predictions = self.predictions.update(fixtures, form, upcoming, home_advantages)
        upcoming = pd.concat([upcoming, predictions], axis=1)
        
        upcoming.index.name = 'Team'
        
        if display:
            print(upcoming)

        self.df = upcoming


class Data:
    def __init__(self, current_season: int):
        self.current_season = current_season
        self.team_names: list[str] = field(default_factory=list)
        self.logo_urls: dict = defaultdict
        
        self.fixtures: Fixtures = Fixtures()
        self.standings: Standings = Standings()
        self.team_ratings: TeamRatings = TeamRatings()
        self.home_advantages: HomeAdvantages = HomeAdvantages()
        self.form: Form = Form()
        self.upcoming: Upcoming = Upcoming(current_season)
        self.season_stats: SeasonStats = SeasonStats()        

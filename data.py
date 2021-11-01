import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import timebudget
from pandas.core.frame import DataFrame
from timebudget import timebudget

from predictions import Predictions
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
    
    def save_to_html(self):
        html = self.df.to_html(justify='center')
        with open(f'./templates/tables/{self.name}.html', 'w') as f:
            f.write(html)


class Fixtures(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'fixtures')

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
                or None - None if status is 'SCHEDULED' or 'IN-PLAY'
        
        Args:
            json_data dict: the json data storage used to build the dataframe
            season int: the year of the current season
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building fixtures dataframe... ')

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

            # Home team row
            matchday[(match["matchday"], 'Date')].append(datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ"))
            matchday[(match["matchday"], 'AtHome')].append(True)
            matchday[(match["matchday"], 'Team')].append(match['awayTeam']['name'].replace('&', 'and'))
            matchday[(match["matchday"], 'Status')].append(match['status'])
            matchday[(match["matchday"], 'Score')].append(f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}")
            team_names.append(match['homeTeam']['name'].replace('&', 'and'))
            # Away team row
            matchday[(match["matchday"], 'Date')].append(datetime.strptime(match['utcDate'], "%Y-%m-%dT%H:%M:%SZ"))
            matchday[(match["matchday"], 'AtHome')].append(False)
            matchday[(match["matchday"], 'Team')].append(match['homeTeam']['name'].replace('&', 'and'))
            matchday[(match["matchday"], 'Status')].append(match['status'])
            matchday[(match["matchday"], 'Score')].append(f"{match['score']['fullTime']['homeTeam']} - {match['score']['fullTime']['awayTeam']}")
            team_names.append(match['awayTeam']['name'].replace('&', 'and'))

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

    def calc_rating(self, position: int, points: int, gd: int) -> float:
        rating = (20 - position) / 2
        if gd != 0:
            rating *= gd
        if points != 0:
            rating *= points
        return rating

    def get_season_weightings(self, no_seasons: int) -> list[float]:
        mult = 2.5  # High = recent weighted more
        season_weights = [0.01*(mult**3), 0.01*(mult**2), 0.01*mult, 0.01]
        weights = np.array(season_weights[:no_seasons])
        return list(weights / sum(weights))  # Normalise list

    def calc_total_rating_col(self, team_ratings: dict, no_seasons: int, 
                              include_current_season: bool):
        # Calculate total rating column
        team_ratings['TotalRating'] = 0
        if include_current_season:
            start_n = 0  # Include current season when calculating total rating
            w = self.get_season_weightings(no_seasons)  # Column weights
        else:
            start_n = 1  # Exclude current season when calculating total rating
            w = self.get_season_weightings(no_seasons - 1)  # Column weights

        for n in range(start_n, no_seasons):
            team_ratings['TotalRating'] += w[n - start_n] * team_ratings[f'NormalisedRating{n}YAgo']

    @timebudget
    def update(self, standings: DataFrame, season: int, games_threshold: int, 
               n_seasons: int = 3, display: bool = False):
        """ Builds a dataframe containing each team's calculated 'team rating' 
            based on the last [no_seasons] seasons results and inserts it into the 
            team_ratings class variable.
            
            Rows: the 20 teams participating in the current season, ordered 
                descending by the team's rating
            Columns:
            -------------------------------------------------------------------------------------------------------------------------------------
            | RatingCurrent | Rating1YAgo | Rating2YAgo | NormalisedRatingCurrent | NormalisedRating1YAgo | NormalisedRating2YAgo | TotalRating |
            
            RatingCurrent: a calculated positive or negative value that represents
                the team's rating based on the state of the current season's 
                standings table
            Rating1YAgo: a calculated positive or negative value that represents 
                the team's rating based on the state of last season's standings
                table
            Rating2YAgo: a calculated positive or negative value that represents 
                the team's rating based on the state of the standings table two
                seasons ago
            NormalisedRatingCurrent: the Rating Current column value normalised
            NormalisedRating1YAgo: the Rating 1Y Ago column values normalised
            NormalisedRating2YAgo: the Rating 2Y Ago column values normalised
            TotalRating: a final normalised rating value incorporating the values 
                from all three normalised columns
                
        Args:
            standings DataFrame: a completed dataframe filled with standings data 
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
        print('🔨 Building team ratings dataframe... ')

        # Check for dependencies
        if standings.df.empty:
            raise ValueError('❌ [ERROR] Cannot build team ratings dataframe: Standings dataframe empty')

        # Add current season team names to the object team dataframe
        team_ratings = pd.DataFrame(index=standings.df.index)

        # Create column for each included season
        for n in range(0, n_seasons):
            team_ratings[f'Rating{n}YAgo'] = np.nan

        # Insert rating values for each row
        for team_name, row in standings.df.iterrows():
            for n in range(n_seasons):
                rating = self.calc_rating(row[season - n]['Position'], row[season - n]['Points'], row[season - n]['GD'])
                team_ratings.loc[team_name, f'Rating{n}YAgo'] = rating

        # Replace any NaN with the lowest rating in the same column
        for col in team_ratings.columns:
            team_ratings[col].replace(np.nan, team_ratings[col].min(), inplace=True)

        # Create normalised versions of the three ratings columns
        for n in range(0, n_seasons):
            team_ratings[f'NormalisedRating{n}YAgo'] = (team_ratings[f'Rating{n}YAgo']
                                                        - team_ratings[f'Rating{n}YAgo'].min()) \
                                                       / (team_ratings[f'Rating{n}YAgo'].max()
                                                          - team_ratings[f'Rating{n}YAgo'].min())

        # Check whether current season data should be included in each team's total rating
        if (standings.df[season]['Played'] <= games_threshold).all():  # If current season hasn't played enough games
            print(
                f"Current season excluded from team ratings calculation -> all teams must have played {games_threshold} games.")
            include_current_season = False
        else:
            include_current_season = True

        self.calc_total_rating_col(team_ratings, n_seasons, include_current_season)

        team_ratings = team_ratings.sort_values(by="TotalRating", ascending=False)
        team_ratings = team_ratings.rename(columns={'Rating0YAgo': 'RatingCurrent', 'NormalisedRating0YAgo': 'NormalisedRatingCurrent'})

        if display:
            print(team_ratings)

        self.df = team_ratings


class Form(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'form')

    def get_current_matchday(self) -> int:
        if len(self.df.columns) > 0:
            current_matchday = list(self.df.columns.unique(level=0))[-1]
            return current_matchday
        raise ValueError('❌ ERROR: Cannot get current matchday number')

    def get_prev_matchday(self) -> int:
        if len(self.df.columns) > 0:
            prev_matchday = list(self.df.columns.unique(level=0))[-2]
            return prev_matchday
        raise ValueError('❌ ERROR: Cannot get previous matchday number')

    def n_should_have_played(self, current_matchday: int, maximum: int) -> int:
        n_should_have_played = maximum
        if current_matchday < maximum:
            n_should_have_played = current_matchday
        return n_should_have_played

    def not_played_current_matchday(self, recent_games: list[str], 
                                    current_matchday: int) -> bool:
        n_should_have_played = self.n_should_have_played(current_matchday, 5)
        return len(recent_games) != n_should_have_played

    def get_form(self, team_name: str) -> list[str]:
        form = []
        if (current_matchday := self.get_current_matchday()):
            form = self.df[current_matchday, 'Form'].loc[team_name]

            if self.not_played_current_matchday(form, current_matchday):
                # Use previous matchday's form
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                form = self.df[previous_matchday, 'Form'].loc[team_name]
            if form is None:
                form = []
            else:
                form = list(form)
            form = form + ['None'] * (5 - len(form))  # Pad list

        return form

    def get_recent_teams_played(self, team_name: str) -> DataFrame:
        if (current_matchday := self.get_current_matchday()):
            recent_teams_played = self.df[current_matchday, 'TeamsPlayed'].loc[team_name]

            if self.not_played_current_matchday(recent_teams_played, current_matchday):
                # Use previous matchday's games played list
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                recent_teams_played = self.df[previous_matchday, 'TeamsPlayed'].loc[team_name]
        else:
            recent_teams_played = DataFrame()

        return recent_teams_played

    def get_current_form_rating(self, team_name: str) -> float:
        rating = 0
        if (current_matchday := self.get_current_matchday()):
            latest_teams_played = self.df[current_matchday, 'TeamsPlayed'].loc[team_name]
            matchday = current_matchday

            if self.not_played_current_matchday(latest_teams_played, current_matchday):
                # Use previous matchday data
                matchday = self.get_prev_matchday()
            rating = (self.df[matchday].loc[team_name]['FormRating'] * 100).round(1)

        return rating

    def get_won_against_star_team(self, team_name: str) -> list[str]:
        won_against_star_team = []  # 'star-team' or 'not-star-team' elements
        if current_matchday := self.get_current_matchday():
            won_against_star_team = self.df[current_matchday, 'WonAgainstStarTeam'].loc[team_name]

            if self.not_played_current_matchday(won_against_star_team, current_matchday):
                # Use previous matchday data
                previous_matchday = list(self.df.columns.unique(level=0))[-2]
                won_against_star_team = self.df[previous_matchday, 'WonAgainstStarTeam'].loc[team_name]

            # Replace boolean values with CSS tag for super win image
            won_against_star_team = ['star-team' if x else 'not-star-team' 
                                     for x in won_against_star_team]

        return won_against_star_team

    def get_recent_form(self, team_name: str) -> tuple[list[str], DataFrame, 
                                                       float, list[str]]:
        form_str = self.get_form(team_name)  # list of five 'W', 'D' or 'L'
        recent_teams_played = self.get_recent_teams_played(team_name)
        rating = self.get_current_form_rating(team_name)
        won_against_star_team = self.get_won_against_star_team(team_name)
        return form_str, recent_teams_played, rating, won_against_star_team

    def form_string(self, scores: list[str], at_homes: list[bool]) -> str:
        form = []  # type: list[str]
        for score, at_home in zip(scores, at_homes):
            home, away = util.extract_str_score(score)
            if home != 'None' and away != 'None':
                h = int(home)
                a = int(away)
                if h == a:
                    form.append('D')
                elif h > a and at_home or h < a and not at_home:
                    form.append('W')
                else:
                    form.append('L')

        return ''.join(form)  # Convert to string

    def calc_form_rating(self, teams_played: list[str], form_str: str, gds: list[int],
                         team_ratings: TeamRatings) -> float:
        form_rating = 0.5  # Default percentage, moves up or down based on performance
        if form_str is not None:  # If games have been played this season
            for form_idx, result in enumerate(form_str):
                # Convert opposition team initials to their name 
                opp_team = util.convert_team_name_or_initials(teams_played[form_idx])

                # Increament form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    form_rating += (team_ratings.df['TotalRating'].loc[opp_team] / len(form_str)) * abs(gds[form_idx])
                # elif result == 'D':
                #     form_rating += (team_ratings.df['TotalRating'].loc[opp_team] - team_ratings.df['TotalRating'].loc[opp_team]) / len(form_str)
                elif result == 'L':
                    form_rating -= ((team_ratings.df['TotalRating'].iloc[0] - team_ratings.df['TotalRating'].loc[opp_team]) / len(form_str)) * abs(gds[form_idx])

        # Cap rating
        if form_rating > 1:
            form_rating = 1
        elif form_rating < 0:
            form_rating = 0

        return form_rating

    def calc_won_against_star_team_col(self, played_star_team_col, form_str_col):
        won_against_star_team_col = []
        for played_star_team, form_str in zip(played_star_team_col, form_str_col):  # Team has played games this season
            won_against_star_team_col.append(
                [(result == 'W' and pst == True) for result, pst in zip(form_str, played_star_team)])
        return won_against_star_team_col

    def calc_played_star_team_col(self, team_ratings, teams_played_col, star_team_threshold):
        played_star_team_col = []
        for teams_played in teams_played_col:
            ratings = [team_ratings.df['TotalRating'][team_name] for team_name in
                       list(map(util.convert_team_name_or_initials, teams_played))]
            played_star_team_col.append([team_rating > star_team_threshold for team_rating in ratings])
        return played_star_team_col

    def calc_form_rating_col(self, team_ratings, teams_played_col, form_str_col, goal_differences_col):
        form_rating_col = []
        for teams_played, form_str, gds in zip(teams_played_col, form_str_col, goal_differences_col):
            rating = self.calc_form_rating(teams_played, form_str, gds, team_ratings)
            form_rating_col.append(rating)
        return form_rating_col

    def calc_form_str_and_gd_cols(self, scores_col, at_homes_col: list[list]):
        form_str_col = []  # type: list[list[str]]
        gds_col = []  # type: list[list[int]]

        # Loop through each matchday and record the goal different for each team
        for scores, at_homes in zip(scores_col, at_homes_col):
            # Append 'W', 'L' or 'D' depending on result
            form_str_col.append(self.form_string(scores, at_homes))

            # Build goal differences of last games played from perspective of current team
            gds = []
            for score, at_home in zip(scores, at_homes):
                home, away = util.extract_str_score(score)
                if home != 'None' and away != 'None':
                    diff = int(home) - int(away)
                    if diff == 0:
                        gds.append(0)
                    elif at_home:
                        gds.append(diff)
                    elif not at_home:
                        gds.append(-1 * diff)
            gds_col.append(gds)

        return form_str_col, gds_col

    def last_n_games(self, games_played: list, n_games: int, 
                     date: datetime) -> tuple[list[str], list[str], list[str]]:
        """ Slice games played data to return only the last 'n_games' games from 
            the given date """

        teams_played = []
        scores = []
        at_homes = []

        if len(games_played) > 0:
            dates, teams_played, scores, at_homes = list(zip(*games_played))
            index = len(dates) - 1  # Default to latest game

            # Find index of dates where this matchday would fit
            for i in range(len(dates)):
                if i == len(dates) - 1 or date < dates[i + 1]:
                    index = i
                    break

            # Get the last n_games matchday values from this index
            if len(dates) > n_games:
                low = index - n_games + 1
                high = index + 1
                
            if low < 0:
                low = 0
            
            teams_played = teams_played[low:high]
            scores = scores[low:high]
            at_homes = at_homes[low:high]

        return list(teams_played), list(scores), list(at_homes)

    def last_n_games_cols(self, fixtures: Fixtures, n_games: int, 
                          matchday_no: int) -> tuple[list[list[str]], 
                                                     list[list[str]], 
                                                     list[list[str]]]:
        teams_played_col = []
        scores_col = []
        at_home_col = []

        matchday_dates = fixtures.df[matchday_no, 'Date']
        median_matchday_date = matchday_dates[len(matchday_dates) // 2].asm8

        for team_name, row in fixtures.df.iterrows():
            dates = fixtures.df.loc[team_name, (slice(None), 'Date')].values
            teams_played = fixtures.df.loc[team_name, (slice(None), 'Team')].values
            scores = fixtures.df.loc[team_name, (slice(None), 'Score')].values
            at_homes = fixtures.df.loc[team_name, (slice(None), 'AtHome')].values

            # List containing a tuple for each game
            games_played = list(zip(dates, teams_played, scores, at_homes))
            # Remove matchdays that haven't played yet and don't have a score
            games_played = [game for game in games_played if game[2] != 'None - None']
            games_played = sorted(games_played, key=lambda x: x[0])  # Sort by date

            matchday_date = row[matchday_no]['Date'].asm8

            # If matchday date is far away from the mean and this matchday has 
            # been rescheduled, use the mean matchday date insead
            # Check within 2 weeks either side
            if not (median_matchday_date - np.timedelta64(14,'D') < 
                    matchday_date < 
                    median_matchday_date + np.timedelta64(14, 'D')):
                matchday_date = median_matchday_date
            
            teams_played, scores, at_home = self.last_n_games(games_played, n_games, matchday_date)
            teams_played_col.append(teams_played)
            scores_col.append(scores)
            at_home_col.append(at_home)

        # Convert full team names to team initials
        teams_played_col = [list(map(util.convert_team_name_or_initials, teams_played)) 
                            for teams_played in teams_played_col]
        
        return teams_played_col, scores_col, at_home_col

    @timebudget
    def update(self, fixtures: Fixtures, team_ratings: TeamRatings, 
               star_team_threshold: float, display: bool = False):
        """ Assigns self.df a dataframe containing data about the team's form 
            for each matchday played this season.
            
            Rows: the 20 teams participating in the current season
            Columns (multi-index):
            ----------------------------------------------------------------------------------------------------------
            |                                             [Matchday Number]                                          |
            ----------------------------------------------------------------------------------------------------------
            | Date | TeamsPlayed | Scores | AtHome | Form | GDs | FormRating | PlayedStarTeam | WonAgainstStarTeam |
            
            [Matchday Numbers]: integers from 1 to the most recent matchday
                with a game played
            Date: list of datetime values for the day a match is scheduled for 
                or taken place on for the last 5 games, with the most left-most
                value the most recent game played
            AtHome: list of whether the team is playing that match at home or away, 
                either True or False for the last 5 games, with the most left-most
                value the most recent game played
            Team: list of the initials of the opposition team for the last 5 games, 
                with the most left-most value the most recent game played
            Status: list of the current status of that match, either 'FINISHED', 
                'IN PLAY' or 'SCHEDULED' for the last 5 games, with the most left-most
                value the most recent game played
            Score: list of the scores of the last 5 games, either 'X - Y' if status 
                is 'FINISHED' or None - None if status is 'SCHEDULED', with the 
                most left-most value the most recent game played
                
        Args:
            fixtures DataFrame: a completed dataframe contining all past and 
                future fixtures for the current season
            team_ratings DataFrame: a completed dataframe containing long-term 
                ratings for each team based on the current season and recent seasons 
            star_team_threshold: the minimum team rating for a team to be 
                considered a 'star team'. If a team wins against a star team,
                it is recorded, and the achievement is highlighted in the UI.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building form dataframe... ')

        # Check for dependencies
        if fixtures.df.empty:
            raise ValueError('❌ [ERROR] Cannot form over time dataframe: Fixures dataframe empty')
        elif team_ratings.df.empty:
            raise ValueError('❌ [ERROR] Cannot form over time dataframe: Team ratings dataframe empty')

        # Get number of matchdays that have had all teams played
        score = fixtures.df.loc[:, (slice(None), 'Score')]
        # Remove cols for matchdays that haven't played yet
        score = score.replace("None - None", np.nan).dropna(axis=1, how='all')

        matchday_nos = sorted(list(score.columns.get_level_values(0)))

        d = {}  # type: dict[tuple[int, str], list]
        for n in matchday_nos:
            d[(n, 'Date')] = fixtures.df[n, 'Date']

            # Get data about last 5 matchdays
            teams_played_col, scores_col, at_home_col  = self.last_n_games_cols(fixtures, 5, n)
            d[(n, 'TeamsPlayed')] = teams_played_col
            d[(n, 'Scores')] = scores_col
            d[(n, 'AtHome')] = at_home_col

            # Form string and goal differences column
            form_str_col, gd_col = self.calc_form_str_and_gd_cols(scores_col, at_home_col)
            d[(n, 'Form')] = form_str_col
            d[(n, 'GDs')] = gd_col

            form_rating_col = self.calc_form_rating_col(team_ratings, teams_played_col, form_str_col, gd_col)
            d[(n, 'FormRating')] = form_rating_col

            # Column (list of booleans) for whether last 5 games have been against 
            # a team with a long term (multiple season) rating over a certain 
            # threshold (a star team)
            played_star_team_col = self.calc_played_star_team_col(team_ratings, teams_played_col, star_team_threshold)
            d[(n, 'PlayedStarTeam')] = played_star_team_col

            # Column (list of booleans) for whether last 5 games have won against 
            # a star team
            won_against_star_team_col = self.calc_won_against_star_team_col(played_star_team_col, form_str_col)
            d[(n, 'WonAgainstStarTeam')] = won_against_star_team_col

            # Remove column after use, data is not that useful to keep
            del d[(n, 'PlayedStarTeam')]

        form = pd.DataFrame.from_dict(d)
        form.columns.names = ["Matchday", None]
        form.index.name = "Team"

        if display:
            print(form[10])

        self.df = form


class Standings(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'standings')

    def get_position(self, team_name: str, season: int) -> DataFrame:
        return self.df.at[team_name, (season, 'Position')]

    def get_table_snippet(self, team_name: str, 
                          season: int) -> tuple[list[tuple[int, str, int, int]], int]:
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
        # Add the team name into position 1 of each table row
        for row_list, team_name in zip(table_snippet, team_names):
            row_list.insert(1, team_name)

        return table_snippet, team_idx

    def fill_rows_from_data(self, data: dict) -> dict[str, dict[str, int]]:
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

    def add_gd_col(self, df_rows: dict):
        for team in df_rows.keys():
            df_rows[team]['GD'] = df_rows[team]['GF'] - df_rows[team]['GA']

    def add_position_col(self, df_rows: dict):
        for idx, team in enumerate(df_rows.keys()):
            # Position is index as they have been sorted by points
            df_rows[team]['Position'] = idx + 1

    def season_standings_from_fixtures(self, json_data: dict, team_names: list[str], 
                         season: int) -> DataFrame:
        data = json_data['fixtures'][season]

        df_rows = self.fill_rows_from_data(data)
        self.add_gd_col(df_rows)

        # Sort rows by Points, then GD, then GF
        df_rows = dict(sorted(df_rows.items(), key=lambda v: [v[1]['Points'], v[1]['GD'], v[1]['GF']], reverse=True))
        # Use df sorted by points to insert table position
        self.add_position_col(df_rows)

        df = pd.DataFrame.from_dict(df_rows, orient='index')
        col_headings = ['Position', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']
        df.columns = pd.MultiIndex.from_product([[season], col_headings])

        # Drop any rows with columns not in the current season
        df = df.drop(df[~df.index.isin(team_names)].index)

        return df

    def season_standings(self, json_data: dict, current_teams: list[str], season: int) -> DataFrame:
        data = json_data['standings'][season]
        df = pd.DataFrame(data)
        
        # Rename teams to their team name
        team_names = pd.Series([name.replace('&', 'and') for name in [df['team'][x]['name'] for x in range(len(df))]])
        del df['form']
        del df['team']
        df.index = team_names

        # Move points column ot the end
        points_col = df.pop('points')
        df.insert(8, 'points', points_col)
        col_headings = ['Position', 'Played', 'Won', 'Drawn', 'Lost', 'GF', 'GA', 'GD', 'Points']
        df.columns = pd.MultiIndex.from_product([[season], col_headings])
        
        df.drop(index=df.index.difference(current_teams), inplace=True)

        return df    

    @timebudget
    def update(self, json_data: dict, team_names: list[str], season: int, 
               no_seasons: int = 3, display: bool = False):
        """ Assigns self.df to a dataframe containing all table standings for 
            each season from current season to season [no_seasons] years ago.
            
            Rows: the 20 teams participating in the current season, ordered ascending 
                by the team's position in the current season 
            Columns (multi-index):
            ------------------------------------------------------------------------
            |                            [SEASON YEAR]                             |
            ------------------------------------------------------------------------
            | Position | Played | Form | Won | Draw | Lost | Points | GF | GA | GD |
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago
            Position: unique integer from 1 to 20 depending on the table position 
                a team holds in the season
            Played: the number of games a team has played in the season
            Won: the number of games a team has won in the season
            Drawn: the number of games a team has drawn in the season
            Lost: the number of games a team has lost in the season
            GF: goals for - the number of goals a team has scored in this season
            GA: goals against - the number of games a team has lost in the season
            GD: the number of games a team has lost in the season
            
        Args:
            json_data dict: the json data storage used to build the dataframe
            team_names list: the team names of the teams within the current season
            season: the year of the current season
            no_seasons (int): number of previous seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building standings dataframe...')

        # Check for dependencies
        if not team_names:
            raise ValueError('❌ [ERROR] Cannot build standings dataframe: Team names list not available')

        standings = pd.DataFrame()

        # Loop from current season to the season 2 years ago
        for n in range(no_seasons):
            season_standings = self.season_standings(json_data, team_names, season - n)
            standings = pd.concat((standings, season_standings), axis=1)

        standings = standings.fillna(0).astype(int)
        standings.index.name = 'Team'
        standings.columns.names = ('Season', None)

        if display:
            print(standings)

        self.df = standings


class FormNew(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'form')
    
    def check_for_dependencies(self, *args):
        for df_obj in args:
            if df_obj.df.empty:
                raise ValueError(f'❌ [ERROR] Cannot form over time dataframe: {df_obj.name.title()} dataframe empty')
    
    def insert_gd_and_pts_col(self, form, matchday_no):
        gd_col = []
        pts_col = []
        for team, score in form[(matchday_no, 'Score')].iteritems():
            if score == 'None - None':
                gd = None
                pts = None
            else:
                home, away = util.extract_int_score(score)
                if form.at[team, (matchday_no, 'AtHome')]:
                    gd = home-away
                else:
                    gd = away-home
                if gd > 0:
                    pts = 3
                elif gd < 0:
                    pts = 0
                else:
                    pts = 1
            gd_col.append(gd)
            pts_col.append(pts)
        
        if matchday_no != 1:
            gd_cum_col = form[(matchday_no-1, 'GD')] + np.array(gd_col)
            pts_cum_col = form[(matchday_no-1, 'Points')] + np.array(pts_col)
        else:
            gd_cum_col = gd_col
            pts_cum_col = pts_col
        
        form[(matchday_no, 'GD')] = gd_col
        form[(matchday_no, 'Points')] = pts_col
        form[(matchday_no, 'CumulativeGD')] = gd_cum_col
        form[(matchday_no, 'CumulativePoints')] = pts_cum_col
    
    def insert_position_col(self, form, matchday_no):
        form.sort_values(by=[(matchday_no, 'CumulativePoints'), (matchday_no, 'CumulativeGD')], ascending=False, inplace=True)
        form[matchday_no, 'Position'] = list(range(1, 21))
    
    def insert_won_against_star_team_col(self, form, team_ratings, matchday_no, star_team_threshold):
        won_against_star_team_col = []
        for opp_team in form[(matchday_no, 'Team')]:
            opp_team_rating = team_ratings.df.at[opp_team, 'TotalRating']
            won_against_star_team = False
            if opp_team_rating > star_team_threshold:
                won_against_star_team = True
            won_against_star_team_col.append(won_against_star_team)
        form[(matchday_no, 'WonAgainstStarTeam')] = won_against_star_team_col
    
    
    def append_to_from_str(self, form_str, home, away, at_home):
        if home == away:
            form_str.append('D')
        elif at_home:
            if home > away:
                form_str.append('W')
            elif home < away:
                form_str.append('L')
        else:
            if home > away:
                form_str.append('L')
            elif home < away:
                form_str.append('W')
        
    
    def insert_form_string(self, form, matchday_no, n_games):
        last_n_matchday_nos = [matchday_no-i for i in range(n_games) if matchday_no-i > 0]
        
        form_str_col = []
        score_col_headings = [(n, 'Score') for n in last_n_matchday_nos]
        for team, row in form[score_col_headings].iterrows():
            form_str = []
            for i in range(row.size):
                at_home = form.at[team, (matchday_no-i, 'AtHome')]
                score = row[(matchday_no-i, 'Score')]
                if score != 'None - None':
                    home, away = util.extract_int_score(score)
                    self.append_to_from_str(form_str, home, away, at_home)

            form_str_col.append(''.join(form_str))
        
        form[(matchday_no, 'Form')] = form_str_col
        
    def calc_form_rating2(self, team_ratings, team, teams_played, form_str, gds) -> float:
        team_rating = team_ratings.df.at[team, 'TotalRating']
        
        form_rating = 0.5  # Default percentage, moves up or down based on performance
        if form_str is not None:  # If games have been played this season
            for form_idx, result in enumerate(form_str):
                opp_team = teams_played[form_idx]
                opp_team_rating = team_ratings.df.at[opp_team, 'TotalRating']

                # Increament form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    # print("Win, add ", (opp_team_rating / len(form_str)) * abs(gds[form_idx]))
                    form_rating += (opp_team_rating / len(form_str)) * abs(gds[form_idx])
                elif result == 'D':
                    # print("Draw, add ", (opp_team_rating - team_rating) / len(form_str))
                    form_rating += (opp_team_rating - team_rating) / len(form_str)
                elif result == 'L':
                    # print("Loss, subtract ", ((team_rating - opp_team_rating) / len(form_str)) * abs(gds[form_idx]))
                    form_rating -= ((team_rating - opp_team_rating) / len(form_str)) * abs(gds[form_idx])

        # Cap rating
        form_rating = min(max(0, form_rating), 1)

        return form_rating

    def calc_form_rating(self, team_ratings, team, teams_played, form_str, gds) -> float:
        form_rating = 0.5  # Default percentage, moves up or down based on performance
        if form_str is not None:  # If games have been played this season
            for form_idx, result in enumerate(form_str):
                # Convert opposition team initials to their name 
                opp_team = teams_played[form_idx]

                # Increament form score based on rating of the team they've won, drawn or lost against
                if result == 'W':
                    if team=='Liverpool FC':
                        print("Win, add ", (team_ratings.df['TotalRating'].loc[opp_team] / len(form_str)) * abs(gds[form_idx]))
                    form_rating += (team_ratings.df['TotalRating'].loc[opp_team] / len(form_str)) * abs(gds[form_idx])
                # elif result == 'D':
                #     form_rating += (team_ratings.df['TotalRating'].loc[opp_team] - team_ratings.df['TotalRating'].loc[opp_team]) / len(form_str)
                elif result == 'L':
                    if team=='Liverpool FC':
                        print('Lose subtract', ((team_ratings.df['TotalRating'].iloc[0] - team_ratings.df['TotalRating'].loc[opp_team]) / len(form_str)) * abs(gds[form_idx]))
                    form_rating -= ((team_ratings.df['TotalRating'].iloc[0] - team_ratings.df['TotalRating'].loc[opp_team]) / len(form_str)) * abs(gds[form_idx])

        # Cap rating
        if form_rating > 1:
            form_rating = 1
        elif form_rating < 0:
            form_rating = 0

        return form_rating
    
    def insert_form_rating_col(self, form, team_ratings, matchday_no):
        form_rating_col = []
        for team, form_str in form[(matchday_no, 'Form')].iteritems():
            gds = self.get_last_n_values(form, team, 'GD', matchday_no, 5)
            teams_played = self.get_last_n_values(form, team, 'Team', matchday_no, 5)
            
            form_rating = self.calc_form_rating(team_ratings, team, teams_played, form_str, gds)
            if (team == 'Liverpool FC'):
                print(team, teams_played, form_str, gds, '=>', form_rating)
            
            form_rating_col.append(form_rating)
        form[(matchday_no, 'FormRating')] = form_rating_col

    def get_last_n_values(self, form, team_name, column_name, start_matchday, N):
        matchday_nos = [start_matchday-i for i in range(N) if start_matchday-i > 0]
        col_headings = [(n, column_name) for n in matchday_nos]

        values = []        
        for value in form[col_headings].loc[team_name]:
            values.append(value)
            
        return values
    
    def convert_team_col_to_initials(self, form, matchday_no):
        for team, opp_team in form[(matchday_no, 'Team')].iteritems():
            form.at[team, (matchday_no, 'Team')] = util.convert_team_name_or_initials(opp_team)
    
    def get_played_matchdays(self, fixtures: Fixtures):
        status = fixtures.df.loc[:, (slice(None), 'Status')]
        # Remove cols for matchdays that haven't played yet
        status = status.replace("SCHEDULED", np.nan).dropna(axis=1, how='all')
        matchday_nos = sorted(list(status.columns.get_level_values(0)))
        return matchday_nos
        
    @timebudget
    def update(self, fixtures: Fixtures, standings: Standings, team_ratings: TeamRatings, 
               star_team_threshold: float, display: bool = False):
        print('🔨 Building form (new) dataframe... ')
        self.check_for_dependencies(fixtures, standings, team_ratings)

        matchday_nos = self.get_played_matchdays(fixtures)
        
        form = fixtures.df[matchday_nos]
            
        form = form.drop(columns=['Status'], level=1)
        
        for matchday_no in matchday_nos:
            self.insert_gd_and_pts_col(form, matchday_no)
            self.insert_position_col(form, matchday_no)
            self.insert_won_against_star_team_col(form, team_ratings, matchday_no, star_team_threshold)
            self.insert_form_string(form, matchday_no, 5)
            self.insert_form_rating_col(form, team_ratings, matchday_no)
        
        for matchday_no in matchday_nos:
            self.convert_team_col_to_initials(form, matchday_no)
        
        # Drop columns used for working
        form = form.drop(columns=['Score', 'Points'], level=1)
        
        form = form.reindex(sorted(form.columns.values), axis=1)
        
        # print(form)
        form = form.sort_values(by=[(max(matchday_nos), 'FormRating')])

        if display:
            print(form[10])
            
        self.df = form


class SeasonStats(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'season_stats')

    def format_position(self, position: int) -> str:
        j = position % 10
        k = position % 100
        position_str = str(position)

        if j == 1 and k != 11:
            return position_str + 'st'
        if j == 2 and k != 12:
            return position_str + 'nd'
        if j == 3 and k != 13:
            return position_str + 'rd'
        return position_str + 'th'

    def get_stat(self, team_name: str, col_heading: str, ascending: bool) -> tuple[float, str]:
        stat = self.df.at[team_name, col_heading]
        position = self.df[col_heading].sort_values(ascending=ascending).index.get_loc(team_name) + 1
        position = self.format_position(position)
        return stat, position

    def get_season_stats(self, team_name: str) -> tuple[float, str, 
                                                        float, str, 
                                                        float, str]:
        clean_sheets = self.get_stat(team_name, 'CleanSheetRatio', False)
        goals_per_game = self.get_stat(team_name, 'GoalsPerGame', False)
        conceded_per_game = self.get_stat(team_name, 'ConcededPerGame', True)
        return clean_sheets, goals_per_game, conceded_per_game

    def row_season_goals(self, row: pd.Series, matchdays: list[str]) -> tuple[int, int, int, int]:
        n_games = 0
        clean_sheets = 0
        goals_scored = 0
        goals_conceded = 0

        for matchday in matchdays:
            match = row[matchday]
            if type(match['Score']) is str:
                home, away = util.extract_int_score(match['Score'])
                if match['AtHome']:
                    goals_scored += home
                    if away == 0:
                        clean_sheets += 1
                    else:
                        goals_conceded += away
                elif not match['AtHome']:
                    goals_scored += away
                    if home == 0:
                        clean_sheets += 1
                    else:
                        goals_conceded += home
                n_games += 1

        return n_games, clean_sheets, goals_scored, goals_conceded

    @timebudget
    def update(self, position_over_time: DataFrame, display: bool = False):
        """ Builds a dataframe for season statistics for the current season and 
            inserts it into the season_stats class variable.
            
            Rows: the 20 teams participating in the current season
            Columns:
            ----------------------------------------------------
            | CleanSheetRatio | GoalsPerGame | ConcededPerGame |
            
            CleanSheetRatio: the number of games without a goal conceded this 
                season divided by the number of games played
            GoalsPerGame: the total number of goals scored this season divided by 
                the number of games played
            ConcededPerGame: the total number of goals conceded this season divided 
                by the number of games played
                
        Args:
            position_over_time DataFrame: a completed dataframe containing a snapshot 
                of each team's league position at each completed matchday so far 
                this season
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building season stats dataframe... ')

        # Check for dependencies
        if position_over_time.df.empty:
            raise ValueError('❌ [ERROR] Cannot build season stats dataframe: Position over time dataframe empty')

        matchdays = list(position_over_time.df.columns.unique(level=0))

        season_stats = {'CleanSheetRatio': {},
                        'GoalsPerGame': {},
                        'ConcededPerGame': {}}  # type: dict[str, dict[str, float]]
        for team_name, row in position_over_time.df.iterrows():
            n_games, clean_sheets, goals_scored, goals_conceded = self.row_season_goals(row, matchdays)

            if n_games > 0:
                season_stats['CleanSheetRatio'][team_name] = round(clean_sheets / n_games, 2)
                season_stats['GoalsPerGame'][team_name] = round(goals_scored / n_games, 2)
                season_stats['ConcededPerGame'][team_name] = round(goals_conceded / n_games, 2)
            else:
                season_stats['CleanSheetRatio'][team_name] = 0
                season_stats['GoalsPerGame'][team_name] = 0
                season_stats['ConcededPerGame'][team_name] = 0

        season_stats = pd.DataFrame.from_dict(season_stats)
        season_stats.index.name = 'Team'

        if display:
            print(season_stats)

        self.df = season_stats


class PositionOverTime(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'position_over_time')

    def get_gd_and_pts(self, score: str, at_home: bool) -> tuple[int, int]:
        gd = 0
        pts = 0
        if type(score) == str:  # If score exists and game has been played
            home, away = util.extract_int_score(score)

            if home == away:
                pts = 1
            if at_home:
                gd = home - away
                if home > away:
                    pts = 3
            elif not at_home:
                gd = away - home
                if home < away:
                    pts = 3

        return gd, pts

    def goal_diff_and_pts_cols(self, matchday_no: int, matchday_nums: list[int], 
                               matchday_nums_idx: int, 
                               position_over_time: pd.DataFrame) -> tuple[list[int], list[int]]:
        gd_col = []
        pts_col = []
        matchday_col = position_over_time[matchday_no]
        for team_name, row in matchday_col.iterrows():
            gd = 0
            pts = 0
            if matchday_nums_idx != 0:
                # Add previous weeks cumulative gd
                prev_matchday_no_idx = matchday_nums_idx - 1
                previous_matchday_no = matchday_nums[prev_matchday_no_idx]
                prev_gd = position_over_time[previous_matchday_no, 'GD'].loc[team_name]
                prev_pts = position_over_time[previous_matchday_no, 'Points'].loc[team_name]
                gd += prev_gd
                pts += prev_pts
            # If this matchday has had all games played and is in score table
            # Add this weeks gd
            new_gd, new_pts = self.get_gd_and_pts(row['Score'], row['AtHome'])
            gd += new_gd
            pts += new_pts

            gd_col.append(gd)
            pts_col.append(pts)

        return gd_col, pts_col

    @timebudget
    def update(self, fixtures: DataFrame, standings: DataFrame, display: bool = False):
        """ Assigns self.df a dataframe containing data about the 
            team's past and present league positions at each matchday played this 
            season.
            
            Builds a dataframe containing data about the team's past and present 
            league positions at each matchday played this season and inserts it 
            into the fixtures class variable.
            
            Rows: the 20 teams participating in the current season, ordered ascending
                by row team name
            Columns (multi-index):
            -----------------------------------------------------
            |                 [Matchday Number]                 |
            -----------------------------------------------------
            | Score | AtHome | Date | GDs | Points | Position |
            
            [Matchday Number]: integers from 1 to the most recent matchday
                with a game played
            Score: the score of that game 'X - Y', or 'None - None' in the final 
                (most recent) matchday column for some games that are soon to be
                played
            AtHome: whether the team is playing that match at home or away, 
                either True or False
            Date: datetime values for the day a match is scheduled for 
                or has taken place on
            GDs: the goal difference the team held after that matchday
            Points: the points the team held after that matchday
            Position: the position in the table that the team held after that 
                matchday
                
        Args:
            fixtures DataFrame: a completed dataframe contining all past and 
                future fixtures for the current season
            standings DataFrame: a completed dataframe filled with standings data 
                for the last n_seasons seasons
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building position over time dataframe... ')

        # Check dependencies
        if fixtures.df.empty:
            raise ValueError('❌ [ERROR] Cannot build team ratings dataframe: Fixtures dataframe empty')
        elif standings.df.empty:
            raise ValueError('❌ [ERROR] Cannot build team ratings dataframe: Standings dataframe empty')

        position_over_time = pd.DataFrame()

        score = fixtures.df.loc[:, (slice(None), 'Score')]
        at_home = fixtures.df.loc[:, (slice(None), 'AtHome')]
        date = fixtures.df.loc[:, (slice(None), 'Date')]

        # Remove cols for matchdays that haven't played any games yet
        score = score.replace("None - None", np.nan).dropna(axis=1, how='all')
        no_cols = score.shape[1]
        # Only keep the same columns that remain in the score dataframe
        date = date[list(score.columns.unique(level=0))]
        at_home = at_home[list(score.columns.unique(level=0))]

        position_over_time = pd.concat([score, at_home, date], axis=1)

        matchday_nos = sorted(list(score.columns.get_level_values(0)))
        # Remove 'Matchday' prefix and just store sorted integers
        for idx, matchday_no in enumerate(matchday_nos):
            gd_col, pts_col = self.goal_diff_and_pts_cols(matchday_no, matchday_nos, idx, position_over_time)
            position_over_time[matchday_no, 'GD'] = gd_col
            position_over_time[matchday_no, 'Points'] = pts_col

            position_over_time.sort_values(by=[(matchday_no, 'Points'), (matchday_no, 'GD')], ascending=False,
                                           inplace=True)
            # If on the last and most recent column, ensure matchday positions is 
            # exactly the same order as from API standings data 
            if idx == no_cols - 1:
                # Reorder to the order as standings data
                position_over_time = position_over_time.reindex(standings.df.index)

            position_over_time[matchday_no, 'Position'] = np.arange(1, 21)

        position_over_time = position_over_time.reindex(sorted(position_over_time.columns.values), axis=1)
        position_over_time.columns.names = ["Matchday", None]

        if display:
            print(position_over_time)

        self.df = position_over_time


class HomeAdvantages(DF):
    def __init__(self, d: DataFrame = DataFrame()):
        super().__init__(d, 'home_advantages')

    def home_advantages_for_season(self, d: defaultdict, data: dict, season: int):
        for match in data:
            home_team = match['homeTeam']['name'].replace('&', 'and')
            away_team = match['awayTeam']['name'].replace('&', 'and')

            if match['score']['winner'] is not None:
                if match['score']['fullTime']['homeTeam'] > match['score']['fullTime']['awayTeam']:
                    # Home team wins
                    d[home_team][(season, 'Home', 'Wins')] += 1
                    d[away_team][(season, 'Away', 'Loses')] += 1
                elif match['score']['fullTime']['homeTeam'] < match['score']['fullTime']['awayTeam']:
                    # Away team wins
                    d[home_team][(season, 'Home', 'Loses')] += 1
                    d[away_team][(season, 'Away', 'Wins')] += 1
                else: 
                    # Draw
                    d[home_team][(season, 'Home', 'Draws')] += 1
                    d[away_team][(season, 'Away', 'Draws')] += 1

    def create_season_home_advantage_col(self, home_advantages, season):
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
                     + home_advantages[season]['Away']['Wins']) \
                    / played
        home_advantages[season, 'Overall', 'WinRatio'] = win_ratio

        # Home advantage = percentage wins at home - percentage wins 
        home_advantage = win_ratio_at_home - win_ratio
        home_advantages[season, 'HomeAdvantage', ''] = home_advantage

    def create_total_home_advantage_col(self, home_advantages, season, threshold):
        home_advantages_cols = home_advantages.iloc[:, home_advantages.columns.get_level_values(1) == 'HomeAdvantage']
        # Check whether all teams in current season have played enough home games to meet threshold for use
        if (home_advantages[season]['Home']['Played'] <= threshold).all():
            print(f"Current season excluded from home advantages calculation -> all teams must have played {threshold} home games.")
            # Drop this current seasons column (start from previous season)
            home_advantages_cols = home_advantages_cols.iloc[:, 1:]
        
        # Drop pandemic year (anomaly, no fans, data shows neutral home advantage)
        if (2020, 'HomeAdvantage', '') in list(home_advantages_cols.columns):
            home_advantages_cols = home_advantages_cols.drop((2020, 'HomeAdvantage', ''), axis=1)

        home_advantages = home_advantages.sort_index(axis=1)
        home_advantages['TotalHomeAdvantage'] = home_advantages_cols.mean(axis=1).fillna(0)
        home_advantages = home_advantages.sort_values(by='TotalHomeAdvantage', ascending=False)

        return home_advantages

    def row_template(self, season, no_seasons):
        template = {}
        for i in range(no_seasons):
            template.update({(season-i, 'Home', 'Wins'): 0,
                             (season-i, 'Home', 'Draws'): 0,
                             (season-i, 'Home', 'Loses'): 0,
                             (season-i, 'Away', 'Wins'): 0,
                             (season-i, 'Away', 'Draws'): 0,
                             (season-i, 'Away', 'Loses'): 0})
        return template

    @timebudget
    def update(self, json_data: dict, season: int, threshold: float, 
               no_seasons: int = 3, display: bool = False):
        """ Builds a dataframe containing team's home advantage information for 
            each season with a final column for combined total home advantage 
            values and inserts it into the fixtures class variable.
            
            Rows: the 20 teams participating in the current season, ordered descending 
                by the team's total home advantage
            Columns (multi-index):
            ------------------------------------------------------------------------------------------------------------------------
            |                                         [SEASON YEAR]                                           | TotalHomeAdvantage |
            --------------------------------------------------------------------------------------------------|                    |
            |                         Home                         |         Away         |      Overall      |                    |
            --------------------------------------------------------------------------------------------------|                    |
            | Draws | Loses | Wins | Played | WinRatio | Advantage | Draws | Loses | Wins | Played | WinRatio |                    |
            
            [SEASON YEAR]: 4-digit year values that a season began, from current 
                season to season no_seasons ago.
            Draws: the total [home/away] games drawn this season.
            Loses: the total [home/away] games lost this season.
            Wins: the total [home/away] games won this season.
            Played: the number of games played in the season.
            WinsRatio: the win ratio of all games played in the season.
            Advantage: the difference between the ratio of games won at home 
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
        print('🔨 Building home advantages dataframe... ')

        d = defaultdict(lambda: self.row_template(season, no_seasons))
        for i in range(no_seasons):
            data = json_data['fixtures'][season-i]
            self.home_advantages_for_season(d, data, season-i)

        home_advantages = pd.DataFrame.from_dict(d, orient='index')
        # Drop teams from previous seasons
        home_advantages = home_advantages.dropna(subset=home_advantages.loc[[], [season]].columns)
        home_advantages = home_advantages.fillna(0).astype(int)

        # Calculate home advantages for each season
        for i in range(no_seasons):
            self.create_season_home_advantage_col(home_advantages, season - i)

        # Create the final overall home advantage value for each team
        home_advantages = self.create_total_home_advantage_col(home_advantages, season, threshold)
        
        # Remove working columns
        home_advantages = home_advantages.drop(columns=['Wins', 'Loses', 'Draws'], level=2)

        home_advantages.columns.names = ('Season', None, None)
        home_advantages.index.name = 'Team'

        if display:
            print(home_advantages)

        self.df = home_advantages


class Upcoming(DF):
    def __init__(self, current_season, d: DataFrame = DataFrame()):
        super().__init__(d, 'upcoming')
        self.predictions = Predictions(current_season)

    def get_opposition(self, team_name: str) -> str:
        return self.df.at[team_name, 'NextTeam']

    def get_previous_matches(self, team_name: str) -> list:
        return self.df.at[team_name, 'PreviousMatches']

    def get_at_home(self, team_name: str) -> str:
        return self.df.at[team_name, 'AtHome']

    def get_details(self, team_name: str) -> tuple[str, str, list]:
        opp_team_name = ''
        at_home = ''
        prev_matches = []
        if not self.df.empty:
            # If season not finished
            opp_team_name = self.get_opposition(team_name)
            at_home = self.get_at_home(team_name)
            prev_matches = self.get_previous_matches(team_name)

        return opp_team_name, at_home, prev_matches

    def get_next_game(self, team_name: str, fixtures: Fixtures) -> tuple[Optional[str], 
                                                                         Optional[str], 
                                                                         Optional[str]]:
        date = None  # type: Optional[str]
        next_team = None  # type: Optional[str]
        at_home = None  # type: Optional[str]
        # Scan through list of fixtures to find the first that is 'scheduled'
        for matchday_no in fixtures.df.columns.unique(level=0):
            if fixtures.df[matchday_no, 'Status'].loc[team_name] == 'SCHEDULED':
                date = fixtures.df[matchday_no, 'Date'].loc[team_name]
                next_team = fixtures.df[matchday_no, 'Team'].loc[team_name]
                at_home = fixtures.df[matchday_no, 'AtHome'].loc[team_name]
                break

        return date, next_team, at_home

    def get_next_game_prediction(self, team_name: str) -> tuple[str, int, str, int]:
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

    def get_next_game_prediction_scoreline(self, team_name: str) -> str:
        home_initials, xg_home, away_initials, xg_away = self.get_next_game_prediction(team_name)
        return f'{home_initials} {xg_home} - {xg_away} {away_initials}'

    def game_result_tuple(self, match: dict) -> tuple[str, str]:
        home_score = match['score']['fullTime']['homeTeam']
        away_score = match['score']['fullTime']['awayTeam']
        if home_score == away_score:
            result = ('Drew', 'Drew')
        elif home_score > away_score:
            result = ('Won', 'Lost')
        else:
            result = ('Lost', 'Won')

        return result

    def append_prev_match(self, next_games: dict, home_team: str, away_team: str, 
                            date: str, result: tuple[str, str], match: dict):
        readable_date = self.readable_date(date)
        # From the perspective from the home team
        # If this match's home team has their next game against this match's away team
        if next_games[home_team]['NextTeam'] == away_team:
            prev_match = {'Date': date,
                          'ReadableDate': readable_date,
                          'HomeTeam': home_team,
                          'AwayTeam': away_team,
                          'HomeGoals': match['score']['fullTime']['homeTeam'],
                          'AwayGoals': match['score']['fullTime']['awayTeam'],
                          'Result': result[0]}
            next_games[home_team]['PreviousMatches'].append(prev_match)

        if next_games[away_team]['NextTeam'] == home_team:
            prev_match = {'Date': date,
                          'ReadableDate': readable_date,
                          'HomeTeam': home_team,
                          'AwayTeam': away_team,
                          'HomeGoals': match['score']['fullTime']['homeTeam'],
                          'AwayGoals': match['score']['fullTime']['awayTeam'],
                          'Result': result[1]}
            next_games[away_team]['PreviousMatches'].append(prev_match)
    
    def ord(self, n):
        return str(n) + ("th" if 4<=n%100<=20 else {1:"st",2:"nd",3:"rd"}.get(n%10, "th"))
    
    def readable_date(self, date):
        dt = datetime.strptime(date[:10], "%Y-%m-%d")
        day = self.ord(dt.day)
        return day + dt.date().strftime(' %B %Y')

    def convert_to_readable_dates(self, next_games: dict):
        for _, row in next_games.items():
            for i, prev_match in enumerate(row['PreviousMatches']):
                row['PreviousMatches'][i]['Date'] = self.readable_date(prev_match['Date'])

    def sort_prev_matches_by_date(self, next_games: dict):
        for _, row in next_games.items():
            row['PreviousMatches'] = sorted(row['PreviousMatches'], key=lambda x: x['Date'], reverse=True)

    def append_season_prev_matches(self, next_games: dict, json_data: dict, 
                                    season: int, team_names: list[str]):
        if team_names is None:
            raise ValueError()
        
        data = json_data['fixtures'][season]

        for match in data:
            if match['status'] == 'FINISHED':
                home_team = match['homeTeam']['name'].replace('&', 'and')  # type: str
                away_team = match['awayTeam']['name'].replace('&', 'and')  # type: str

                if home_team in team_names and away_team in team_names:
                    result = self.game_result_tuple(match)
                    self.append_prev_match(next_games, home_team, away_team, match['utcDate'], result, match)
        
    @timebudget
    def update(self, json_data: dict, fixtures: Fixtures, form: Form, 
               home_advantages: HomeAdvantages, team_names: list[str], 
               season: int, n_seasons: int = 3, display: bool = False):
        """ Builds a dataframe for details about the next game each team has to 
            play and inserts it into the next_games class variable.
            
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
            json_dict dict: the json data storage used to build the dataframe
            fixtures DataFrame: a completed dataframe contining all past and 
                future fixtures for the current season
            team_names list:
            season int: the year of the current season
            n_seasons (int, optional): number of seasons to include. Defaults to 3.
            display (bool, optional): flag to print the dataframe to console after 
                creation. Defaults to False.
        """
        print('🔨 Building upcoming dataframe... ')

        # Check for dependencies
        if fixtures.df.empty:
            raise ValueError('❌ [ERROR] Cannot build upcoming dataframe: Fixtures dataframe empty')
        elif not team_names:
            raise ValueError('❌ [ERROR] Cannot build upcoming dataframe: Teams names list empty')

        d = {}  # type: dict[str, dict[str, Optional[str] | list]]
        for team_name in team_names:
            date, next_team, at_home = self.get_next_game(team_name, fixtures)
            d[team_name] = {'Date': date, 
                            'NextTeam': next_team,  
                            'AtHome': at_home,
                            'PreviousMatches': []}

        for i in range(n_seasons):
            self.append_season_prev_matches(d, json_data, season-i, team_names)

        # Format previous meeting dates as long, readable str
        self.sort_prev_matches_by_date(d)
        
        upcoming = pd.DataFrame.from_dict(d, orient='index')
        
        predictions = self.predictions.update(fixtures, form, upcoming, home_advantages)
        upcoming = pd.concat([upcoming, predictions], axis=1)
        
        upcoming.index.name = 'Team'
        
        if display:
            print(upcoming)

        self.df = upcoming


class Data:
    def __init__(self, current_season):
        self.current_season = current_season
        self.team_names: list[str] = field(default_factory=list)
        self.logo_urls: dict = defaultdict
        
        self.fixtures: Fixtures = Fixtures()
        self.standings: Standings = Standings()
        self.team_ratings: TeamRatings = TeamRatings()
        self.home_advantages: HomeAdvantages = HomeAdvantages()
        self.form: Form = Form()
        self.form_new: FormNew = FormNew()
        self.position_over_time: PositionOverTime = PositionOverTime()
        self.upcoming: Upcoming = Upcoming(current_season)
        self.season_stats: SeasonStats = SeasonStats()        
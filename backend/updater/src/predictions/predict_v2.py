from datetime import datetime

import numpy as np
import pandas as pd
from pandas.core.frame import DataFrame
from src.dataframes import Fixtures, Form, HomeAdvantages, TeamRatings

from .form import calc_form
from .market import fetch_odds
from .scoreline import Scoreline


class Predictor:
    def __init__(
            self,
            json_data: dict,
            fixtures: Fixtures,
            form: Form,
            team_ratings: TeamRatings,
            home_advantages: HomeAdvantages,
            season: int,
            num_seasons: int
    ):
        self.fixtures = self._build_long_term_fixtures(
            json_data,
            fixtures,
            season,
            num_seasons
        )
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages
        self.HOME_AWAY_WEIGHTING = 0.2
        self.FIXTURE_WEIGHTING = 0.4
        self.MARKET_URL = "https://www.betfair.com/exchange/plus/en/football/english-premier-league-betting-10932509"

        self.odds = fetch_odds(self.MARKET_URL, js_rendered=False)

    @staticmethod
    def _build_long_term_fixtures(
            json_data: dict,
            current_season_fixtures: Fixtures,
            current_season: int,
            num_seasons: int
    ) -> DataFrame:
        # [last season, 2 seasons ago, 3 seasons ago]
        total_fixtures = {current_season: current_season_fixtures.df}
        prev_fixtures = [Fixtures(), Fixtures(), Fixtures()]
        for i in range(num_seasons-1):
            prev_fixtures[i].build(json_data, current_season-i-1)
            total_fixtures[current_season-i-1] = prev_fixtures[i].df

        total_fixtures = pd.concat(total_fixtures, axis=1)

        # Drop rows for teams not featured in current season
        total_fixtures = total_fixtures.drop(
            index=total_fixtures.index.difference(current_season_fixtures.df.index.tolist()), axis=0)

        return total_fixtures

    def _team_scoreline_freq(
            self,
            team: str
    ) -> dict[Scoreline, int]:
        freq = {}

        team_row = self.fixtures.loc[team]
        # Remove higher-level multi-index
        team_row.index = team_row.index.get_level_values(2)
        scores = team_row.loc['score']  # type: list[dict[str, int]]
        at_homes = team_row.loc['atHome']  # type: list[bool]

        for score, at_home in zip(scores, at_homes):
            if pd.isna(score):
                continue

            if at_home:
                home_team = team
                away_team = None
            else:
                home_team = None
                away_team = team

            scoreline = Scoreline(
                score['homeGoals'], score['awayGoals'], home_team, away_team)

            if scoreline in freq:
                freq[scoreline] += 1
            else:
                freq[scoreline] = 1

        return freq

    def _fixture_scoreline_freq(
            self,
            team1: str,
            team2: str
    ) -> dict[Scoreline, int]:
        freq = {}  # type: dict[str, int]

        team1_row = self.fixtures.loc[team1]
        # Remove higher-level multi-index
        team1_row.index = team1_row.index.get_level_values(2)
        teams = team1_row.loc['team']  # type: list[str]
        scores = team1_row.loc['score']  # type: list[dict[str, int]]
        at_homes = team1_row.loc['atHome']  # type: list[bool]

        for team, score, at_home in zip(teams, scores, at_homes):
            if pd.isna(score) or team != team2:
                continue

            if at_home:
                home_team = team1
                away_team = team2
            else:
                home_team = team2
                away_team = team1

            scoreline = Scoreline(
                score['homeGoals'], score['awayGoals'], home_team, away_team)

            if scoreline in freq:
                freq[scoreline] += 1
            else:
                freq[scoreline] = 1

        return freq

    @staticmethod
    def _separate_scoreline_freq_by_home_away(
            team: str,
            freq: dict[Scoreline, int],
            at_home: bool
    ) -> dict[Scoreline, int]:
        freq_subset = {}  # type: dict[str, int]

        # If at_home, only keep scoreline frequencies where team is at home
        # If not at_home, only keep scoreline frequencies where team is away
        for scoreline in freq:
            if ((at_home and scoreline.home_team == team) or
                    (not at_home and scoreline.away_team == team)):
                freq_subset[scoreline] = freq[scoreline]

        return freq_subset

    @staticmethod
    def _display_scoreline_freq(freq: dict[Scoreline, int | float]):
        sorted_freq = []  # list[tuple[Scoreline], int | float]
        for scoreline, count in freq.items():
            sorted_freq.append((scoreline, count))

        # Sort by frequency count descending
        sorted_freq.sort(key=lambda x: x[1], reverse=True)

        for scoreline, count in sorted_freq:
            print(scoreline, count)

    @staticmethod
    def _scoreline_freq_probability(freq: dict[Scoreline, int]) -> dict[Scoreline, float]:
        total_scorelines = sum(freq.values())

        probabilities = {}  # type: dict[str, float]
        if total_scorelines > 0:
            for scoreline in freq:
                probabilities[scoreline] = freq[scoreline] / total_scorelines

        return probabilities

    @staticmethod
    def _remove_scoreline_freq_teams(
            freq: dict[Scoreline, int]
    ) -> dict[Scoreline, int]:
        new_freq = {}
        for scoreline, count in freq.items():
            scoreline.show_team = False
            if scoreline in new_freq:
                new_freq[scoreline] += count
            else:
                new_freq[scoreline] = count

        return new_freq

    @staticmethod
    def _remove_scoreline_freq_home_away(
            freq: dict[Scoreline, int],
            intended_home_team: str = None,
            intended_away_team: str = None,
    ) -> dict[Scoreline, int]:
        new_freq = {}
        for scoreline, count in freq.items():
            # If wrong way around, swap scoreline team order
            if ((intended_home_team is not None and scoreline.away_team == intended_home_team) or
                    (intended_away_team is not None and scoreline.home_team == intended_away_team)):
                scoreline.reverse()

            if scoreline in new_freq:
                new_freq[scoreline] += count
            else:
                new_freq[scoreline] = count

        return new_freq

    @staticmethod
    def _merge_scoreline_freq(
            freq1: dict[Scoreline, int],
            freq2: dict[Scoreline, int]
    ) -> dict[Scoreline, int]:
        merged_freq = {}  # type: dict[Scoreline, int]
        for freq in (freq1, freq2):
            for scoreline, count in freq.items():
                if scoreline in merged_freq:
                    merged_freq[scoreline] += count
                else:
                    merged_freq[scoreline] = count

        return merged_freq

    def _avg_goals_scored(
            freq: dict[Scoreline, int],
            team1: str,
            team2: str
    ) -> tuple[float, float]:
        team1_played = 0
        team2_played = 0
        team1_goals = 0
        team2_goals = 0
        for scoreline, count in freq.items():
            if scoreline.home_team == team1:
                team1_played += count
                team1_goals += scoreline.home_goals
            elif scoreline.home_team == team2:
                team2_played += count
                team2_goals += scoreline.home_goals

            if scoreline.away_team == team1:
                team1_played += count
                team1_goals += scoreline.away_goals
            elif scoreline.away_team == team2:
                team2_played += count
                team2_goals += scoreline.away_goals

        team1_avg_goals = 0
        if team1_played > 0:
            team1_avg_goals = team1_goals / team1_played

        team2_avg_goals = 0
        if team2_played > 0:
            team2_avg_goals = team2_goals / team2_played

        return (team1_avg_goals, team2_avg_goals)

    @staticmethod
    def _insert_scaled_into_freq(
            freq: dict[Scoreline, int | float],
            insert_freq: dict[Scoreline, int | float],
            scale: float = 1.0
    ):
        for scoreline, count in insert_freq.items():
            if scoreline in freq:
                freq[scoreline] += count * scale
            else:
                freq[scoreline] = count * scale

    @staticmethod
    def _subtract_scaled_from_freq(
            freq: dict[Scoreline, int | float],
            subtract_freq: dict[Scoreline, int | float],
            scale: float = 1.0
    ):
        for scoreline, count in subtract_freq.items():
            if scoreline in freq:
                freq[scoreline] -= count * scale

    @staticmethod
    def _insert_scorelines_into_freq(
            freq: dict[Scoreline, int],
            scorelines: list[Scoreline],
            weightings: list[float] = None
    ) -> dict[Scoreline, int]:
        if weightings is None:
            # Even weightings
            weightings = [1] * len(scorelines)
        elif len(weightings) != len(scorelines):
            return

        for scoreline, weight in zip(scorelines, weightings):
            if scoreline in freq:
                freq[scoreline] += 1 * weight
            else:
                freq[scoreline] = 1 * weight

    @staticmethod
    def _remove_recent_scorelines_home_away(
            scorelines: list[Scoreline],
            intended_home_team: str = None,
            intended_away_team: str = None
    ) -> list[Scoreline]:
        for scoreline in scorelines:
            # If wrong way around, swap scoreline team order
            if ((intended_home_team is not None and scoreline.away_team == intended_home_team) or
                    (intended_away_team is not None and scoreline.home_team == intended_away_team)):
                scoreline.reverse()
        return scorelines

    @staticmethod
    def _remove_recent_scorelines_teams(scorelines: list[Scoreline]) -> list[Scoreline]:
        new_scorelines = []  # type: list[str]
        for scoreline in scorelines:
            scoreline.show_team = False
            new_scorelines.append(scoreline)
        return new_scorelines

    @staticmethod
    def _inserted_weighted_recent_scorelines(
            freq: dict[Scoreline, float],
            scorelines: list[Scoreline],
            weightings: list[float]
    ) -> dict[Scoreline, float]:
        for scoreline, weight in zip(scorelines, weightings):
            if scoreline in freq:
                freq[scoreline] += 1 * weight
            else:
                freq[scoreline] = 1 * weight

    def get_recent_scorelines(self, team: str, num_matches: int | None) -> list[Scoreline]:
        team_row = self.fixtures.loc[team]
        # Remove higher-level multi-index
        team_row.index = team_row.index.get_level_values(2)
        teams = team_row.loc['team']  # type: list[str]
        scores = team_row.loc['score']  # type: list[dict[str, int]]
        at_homes = team_row.loc['atHome']  # type: list[bool]
        dates = team_row.loc['date']  # type: list[datetime]

        dated_scorelines = []  # type: list[tuple[datetime, Scoreline]]
        for date, opp_team, score, at_home in zip(dates, teams, scores, at_homes):
            if pd.isna(score):
                continue

            if at_home:
                home_team = team
                away_team = opp_team
            else:
                home_team = opp_team
                away_team = team

            scoreline = Scoreline(
                score['homeGoals'], score['awayGoals'], home_team, away_team)
            dated_scorelines.append((date, scoreline))

        dated_scorelines.sort(key=lambda x: x[0])
        scorelines = [scoreline for (_, scoreline) in dated_scorelines]
        if num_matches is not None:  # If None, return all matches
            scorelines = scorelines[-num_matches:]
        return scorelines

    def scoreline_probabilities(
            self,
            home_team: str,
            away_team: str
    ) -> dict[Scoreline, float]:

        # All multi-season scorelines available for each team
        home_scoreline_freq = self._team_scoreline_freq(home_team)
        away_scoreline_freq = self._team_scoreline_freq(away_team)

        home_scoreline_freq_home = self._separate_scoreline_freq_by_home_away(
            home_team,
            home_scoreline_freq,
            True
        )
        away_scoreline_freq_away = self._separate_scoreline_freq_by_home_away(
            away_team,
            away_scoreline_freq,
            False
        )

        # Get our small set of previous results between these two teams
        fixture_scoreline_freq = self._fixture_scoreline_freq(
            home_team,
            away_team
        )

        # Force all scoreline orders into upcoming home team as the home team
        fixture_scoreline_freq = self._remove_scoreline_freq_home_away(
            fixture_scoreline_freq,
            home_team,
            away_team
        )
        home_scoreline_freq = self._remove_scoreline_freq_home_away(
            home_scoreline_freq,
            home_team,
            away_team
        )
        away_scoreline_freq = self._remove_scoreline_freq_home_away(
            away_scoreline_freq,
            home_team,
            away_team
        )

        # Base - Combine all previous results from both teams
        # Note: This creates duplicate results for the fixtures between these
        # two specific teams since they are found in both sets of results
        scoreline_freq = self._merge_scoreline_freq(
            home_scoreline_freq,
            away_scoreline_freq
        )
        # Make team agnostic before folding in more scorelines
        scoreline_freq = self._remove_scoreline_freq_teams(scoreline_freq)

        # Subtract one set of this fixture scorelines to remove the duplication
        self._subtract_scaled_from_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(fixture_scoreline_freq)
        )

        # Re-insert home scorelines for home team (scaled down)
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(home_scoreline_freq_home),
            self.HOME_AWAY_WEIGHTING
        )
        # Re-insert away scorelines for away team (scaled down)
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(away_scoreline_freq_away),
            self.HOME_AWAY_WEIGHTING
        )
        # After the subtracting earlier, we can now fully control any additional
        # weighting for fixture scorelines
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(fixture_scoreline_freq),
            self.FIXTURE_WEIGHTING
        )

        # Insert recent scorelines for each team weighted by recency
        home_team_recent_scorelines = self.get_recent_scorelines(home_team, 20)
        away_team_recent_scorelines = self.get_recent_scorelines(away_team, 20)
        home_team_form = calc_form(home_team, home_team_recent_scorelines, np.linspace(0.2, 1, len(away_team_recent_scorelines)), self.team_ratings)
        away_team_form = calc_form(away_team, away_team_recent_scorelines, np.linspace(0.2, 1, len(away_team_recent_scorelines)), self.team_ratings)
        # scale_by_form(scoreline_freq, home_team_form, away_team_form)
        form_scale = (home_team_form, 0.5, away_team_form)

        # Scale all home win probabilities by home odds, draw probabilities by
        # draw odds and away win probabilities by away odds with the current
        # odds for this match
        if (home_team, away_team) in self.odds:
            fixture_odds = self.odds[(home_team, away_team)]
            fixture_odds.convert_to_probabilities()
            # scale_by_odds(scoreline_freq, fixture_odds)
            odds_scale = (fixture_odds.home, fixture_odds.draw, fixture_odds.away)
        else:
            odds_scale = (1, 1, 1)
        
        scale = tuple(f/2 + o/2 for f, o in zip(form_scale, odds_scale))
        self.scale_results(scoreline_freq, scale)

        # Convert frequency counts into probability values
        scoreline_probabilities = self._scoreline_freq_probability(scoreline_freq)
        # self._display_scoreline_freq(scoreline_probabilities)
        return scoreline_probabilities
    
    @staticmethod
    def scale_results(scoreline_freq: dict[Scoreline, float], scale: tuple[float, float, float]):
        home, draw, away = scale
        for scoreline in scoreline_freq:
            if scoreline.home_goals > scoreline.away_goals:
                scoreline_freq[scoreline] *= home
            elif scoreline.home_goals < scoreline.away_goals:
                scoreline_freq[scoreline] *= away
            elif scoreline.home_goals == scoreline.away_goals:
                scoreline_freq[scoreline] *= draw

    @staticmethod
    def maximum_likelihood(scoreline_probabilities: dict[Scoreline, float]) -> Scoreline | None:
        predicted = None
        best = 0
        for scoreline, probability in scoreline_probabilities.items():
            if probability > best:
                best = probability
                predicted = scoreline
        return predicted

    def predict_score(
            self,
            home_team: str,
            away_team: str,
    ) -> Scoreline:
        scoreline_probabilities = self.scoreline_probabilities(home_team, away_team)
        predicted = self.maximum_likelihood(scoreline_probabilities)
        # Overwrite predicted scoreline teams with fixture
        predicted = Scoreline(predicted.home_goals, predicted.away_goals, home_team, away_team)
        return predicted

from datetime import datetime
from typing import NamedTuple, Optional

import numpy as np
import pandas as pd
from pandas import DataFrame

from updater.data.dataframes import Fixtures, Form, HomeAdvantages, TeamRatings
from updater.data.raw_data import RawData
from updater.predictions.form import calc_form
from updater.predictions.scoreline import Scoreline


class Match(NamedTuple):
    """One completed match from a single team's perspective."""

    date: datetime
    opposition: str
    score: dict[str, int]
    at_home: bool


class FormPredictor:
    def __init__(
        self,
        raw_data: RawData,
        fixtures: Fixtures,
        form: Form,
        team_ratings: TeamRatings,
        home_advantages: HomeAdvantages,
        season: int,
        num_seasons: int,
    ):
        self.fixtures = self._build_long_term_fixtures(
            raw_data, fixtures, season, num_seasons
        )
        # Parse each team's completed matches once. The frequency and recent-form
        # helpers below are called several times per fixture, and re-slicing the
        # (wide, multi-season) fixtures frame each time was the bulk of the
        # prediction cost.
        self._matches_by_team = self._index_matches(self.fixtures)
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages
        self.HOME_AWAY_WEIGHTING = 0.2
        self.FIXTURE_WEIGHTING = 0.4

    @staticmethod
    def _build_long_term_fixtures(
        raw_data: RawData,
        current_season_fixtures: Fixtures,
        current_season: int,
        num_seasons: int,
    ):
        # [last season, 2 seasons ago, ...] for however many seasons were asked
        # for. Sized from num_seasons rather than fixed at three, which raised
        # IndexError for num_seasons > 4.
        total_fixtures = {current_season: current_season_fixtures.df}
        for i in range(num_seasons - 1):
            previous_season = current_season - i - 1
            frame = Fixtures()
            frame.build(raw_data, previous_season)
            total_fixtures[previous_season] = frame.df

        total_fixtures = pd.concat(total_fixtures, axis=1)

        # Drop rows for teams not featured in current season
        total_fixtures = total_fixtures.drop(
            index=total_fixtures.index.difference(
                current_season_fixtures.df.index.tolist()
            ),
            axis=0,
        )

        return total_fixtures

    @staticmethod
    def _index_matches(fixtures: DataFrame) -> dict[str, list[Match]]:
        """Pull every team's completed matches out of the fixtures frame once."""
        matches_by_team: dict[str, list[Match]] = {}
        for team in fixtures.index:
            row = fixtures.loc[team]
            # Collapse the (season, matchday, field) columns down to field.
            row.index = row.index.get_level_values(2)
            oppositions = row.loc["team"]
            scores = row.loc["score"]
            at_homes = row.loc["atHome"]
            dates = row.loc["date"]

            team_matches: list[Match] = []
            for date, opposition, score, at_home in zip(
                dates, oppositions, scores, at_homes
            ):
                if pd.isna(score):
                    continue
                team_matches.append(Match(date, opposition, score, at_home))
            matches_by_team[team] = team_matches
        return matches_by_team

    def _team_scoreline_freq(self, team: str):
        freq: dict[Scoreline, int] = {}
        for match in self._matches_by_team[team]:
            if match.at_home:
                home_team, away_team = team, None
            else:
                home_team, away_team = None, team

            scoreline = Scoreline(
                match.score["homeGoals"], match.score["awayGoals"], home_team, away_team
            )
            freq[scoreline] = freq.get(scoreline, 0) + 1

        return freq

    def _fixture_scoreline_freq(self, team1: str, team2: str):
        freq: dict[Scoreline, int] = {}
        for match in self._matches_by_team[team1]:
            if match.opposition != team2:
                continue

            if match.at_home:
                home_team, away_team = team1, team2
            else:
                home_team, away_team = team2, team1

            scoreline = Scoreline(
                match.score["homeGoals"], match.score["awayGoals"], home_team, away_team
            )
            freq[scoreline] = freq.get(scoreline, 0) + 1

        return freq

    @staticmethod
    def _separate_scoreline_freq_by_home_away(
        team: str, freq: dict[Scoreline, int], at_home: bool
    ):
        freq_subset: dict[Scoreline, int] = {}

        # If at_home, only keep scoreline frequencies where team is at home
        # If not at_home, only keep scoreline frequencies where team is away
        for scoreline in freq:
            if (at_home and scoreline.home_team == team) or (
                not at_home and scoreline.away_team == team
            ):
                freq_subset[scoreline] = freq[scoreline]

        return freq_subset

    @staticmethod
    def _scoreline_freq_probability(freq: dict[Scoreline, int]):
        total_scorelines = sum(freq.values())

        probabilities: dict[Scoreline, float] = {}
        if total_scorelines > 0:
            for scoreline in freq:
                probabilities[scoreline] = freq[scoreline] / total_scorelines

        return probabilities

    @staticmethod
    def _remove_scoreline_freq_teams(freq: dict[Scoreline, int]):
        """Pool counts by goals alone, ignoring who played.

        Builds new keys rather than clearing show_team on the existing ones:
        the callers pass in dicts that share Scoreline instances, so mutating
        a key here would reach into dicts this function was never given.
        """
        new_freq: dict[Scoreline, int] = {}
        for scoreline, count in freq.items():
            key = scoreline.without_teams()
            new_freq[key] = new_freq.get(key, 0) + count

        return new_freq

    @staticmethod
    def _remove_scoreline_freq_home_away(
        freq: dict[Scoreline, int],
        intended_home_team: Optional[str] = None,
        intended_away_team: Optional[str] = None,
    ):
        new_freq: dict[Scoreline, int] = {}
        for scoreline, count in freq.items():
            # If wrong way around, swap scoreline team order
            if (
                intended_home_team is not None
                and scoreline.away_team == intended_home_team
            ) or (
                intended_away_team is not None
                and scoreline.home_team == intended_away_team
            ):
                scoreline = scoreline.reversed()

            new_freq[scoreline] = new_freq.get(scoreline, 0) + count

        return new_freq

    @staticmethod
    def _merge_scoreline_freq(freq1: dict[Scoreline, int], freq2: dict[Scoreline, int]):
        merged_freq: dict[Scoreline, int] = {}
        for freq in (freq1, freq2):
            for scoreline, count in freq.items():
                merged_freq[scoreline] = merged_freq.get(scoreline, 0) + count

        return merged_freq

    @staticmethod
    def _insert_scaled_into_freq(
        freq: dict[Scoreline, int | float],
        insert_freq: dict[Scoreline, int | float],
        scale: float = 1.0,
    ):
        for scoreline, count in insert_freq.items():
            freq[scoreline] = freq.get(scoreline, 0) + count * scale

    @staticmethod
    def _subtract_scaled_from_freq(
        freq: dict[Scoreline, int | float],
        subtract_freq: dict[Scoreline, int | float],
        scale: float = 1.0,
    ):
        for scoreline, count in subtract_freq.items():
            if scoreline in freq:
                freq[scoreline] -= count * scale

    def get_recent_scorelines(self, team: str, num_matches: Optional[int]):
        dated_scorelines: list[tuple[datetime, Scoreline]] = []
        for match in self._matches_by_team[team]:
            if match.at_home:
                home_team, away_team = team, match.opposition
            else:
                home_team, away_team = match.opposition, team

            scoreline = Scoreline(
                match.score["homeGoals"], match.score["awayGoals"], home_team, away_team
            )
            dated_scorelines.append((match.date, scoreline))

        dated_scorelines.sort(key=lambda x: x[0])
        scorelines = [scoreline for (_, scoreline) in dated_scorelines]
        if num_matches is not None:  # If None, return all matches
            scorelines = scorelines[-num_matches:]
        return scorelines

    def scoreline_probabilities(self, home_team: str, away_team: str):
        # All multi-season scorelines available for each team
        home_scoreline_freq = self._team_scoreline_freq(home_team)
        away_scoreline_freq = self._team_scoreline_freq(away_team)

        home_scoreline_freq_home = self._separate_scoreline_freq_by_home_away(
            home_team, home_scoreline_freq, True
        )
        away_scoreline_freq_away = self._separate_scoreline_freq_by_home_away(
            away_team, away_scoreline_freq, False
        )

        # Get our small set of previous results between these two teams
        fixture_scoreline_freq = self._fixture_scoreline_freq(home_team, away_team)

        # Force all scoreline orders into upcoming home team as the home team
        fixture_scoreline_freq = self._remove_scoreline_freq_home_away(
            fixture_scoreline_freq, home_team, away_team
        )
        home_scoreline_freq = self._remove_scoreline_freq_home_away(
            home_scoreline_freq, home_team, away_team
        )
        away_scoreline_freq = self._remove_scoreline_freq_home_away(
            away_scoreline_freq, home_team, away_team
        )

        # Base - Combine all previous results from both teams
        # Note: This creates duplicate results for the fixtures between these
        # two specific teams since they are found in both sets of results
        scoreline_freq = self._merge_scoreline_freq(
            home_scoreline_freq, away_scoreline_freq
        )
        # Make team agnostic before folding in more scorelines
        scoreline_freq = self._remove_scoreline_freq_teams(scoreline_freq)

        # Subtract one set of this fixture scorelines to remove the duplication
        self._subtract_scaled_from_freq(
            scoreline_freq, self._remove_scoreline_freq_teams(fixture_scoreline_freq)
        )

        # Re-insert home scorelines for home team (scaled down)
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(home_scoreline_freq_home),
            self.HOME_AWAY_WEIGHTING,
        )
        # Re-insert away scorelines for away team (scaled down)
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(away_scoreline_freq_away),
            self.HOME_AWAY_WEIGHTING,
        )
        # After the subtracting earlier, we can now fully control any additional
        # weighting for fixture scorelines
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(fixture_scoreline_freq),
            self.FIXTURE_WEIGHTING,
        )

        # Insert recent scorelines for each team weighted by recency
        home_team_recent_scorelines = self.get_recent_scorelines(home_team, 20)
        away_team_recent_scorelines = self.get_recent_scorelines(away_team, 20)
        home_team_form = calc_form(
            home_team,
            home_team_recent_scorelines,
            np.linspace(0.2, 1, len(away_team_recent_scorelines)),
            self.team_ratings,
        )
        away_team_form = calc_form(
            away_team,
            away_team_recent_scorelines,
            np.linspace(0.2, 1, len(away_team_recent_scorelines)),
            self.team_ratings,
        )
        form_scale = (home_team_form, 0.5, away_team_form)

        # Market-odds scaling is disabled; an identity odds_scale keeps the
        # form/odds blend below numerically unchanged.
        odds_scale = (1, 1, 1)
        scale = tuple(f / 2 + o / 2 for f, o in zip(form_scale, odds_scale))
        self.scale_results(scoreline_freq, scale)

        # Convert frequency counts into probability values
        scoreline_probabilities = self._scoreline_freq_probability(scoreline_freq)
        return scoreline_probabilities

    @staticmethod
    def scale_results(
        scoreline_freq: dict[Scoreline, float], scale: tuple[float, float, float]
    ):
        home, draw, away = scale
        for scoreline in scoreline_freq:
            if scoreline.home_goals > scoreline.away_goals:
                scoreline_freq[scoreline] *= home
            elif scoreline.home_goals < scoreline.away_goals:
                scoreline_freq[scoreline] *= away
            elif scoreline.home_goals == scoreline.away_goals:
                scoreline_freq[scoreline] *= draw

    @staticmethod
    def maximum_likelihood(scoreline_probabilities: dict[Scoreline, float]):
        predicted: Optional[Scoreline] = None
        best = 0.0
        for scoreline, probability in scoreline_probabilities.items():
            if probability > best:
                best = probability
                predicted = scoreline
        return predicted

    def predict_score(
        self,
        home_team: str,
        away_team: str,
    ):
        scoreline_probabilities = self.scoreline_probabilities(home_team, away_team)
        predicted = self.maximum_likelihood(scoreline_probabilities)
        # Overwrite predicted scoreline teams with fixture
        predicted = Scoreline(
            predicted.home_goals, predicted.away_goals, home_team, away_team
        )
        return predicted

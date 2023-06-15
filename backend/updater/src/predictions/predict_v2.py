from datetime import datetime
from typing import Literal, NamedTuple

import pandas as pd
from src.data import Fixtures, Form, HomeAdvantages, TeamRatings
from src.fmt import (convert_team_name_or_initials,
                     extract_int_score_from_scoreline)


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
            json_data, fixtures, season, num_seasons)
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages

    def _build_long_term_fixtures(
        json_data: dict,
        current_season_fixtures: Fixtures,
        current_season: int,
        num_seasons: int
    ) -> pd.DataFrame:
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
        team: str,
        home_away: bool = True
    ) -> dict[str, int]:
        freq = {}
        team_initials = convert_team_name_or_initials(team)

        team_row = self.fixtures.loc[team]
        # Remove higher-level multi-index
        team_row.index = team_row.index.get_level_values(2)
        scores = team_row.loc['score']  # type: list[dict[str, int]]
        at_homes = team_row.loc['atHome']  # type: list[bool]

        for score, at_home in zip(scores, at_homes):
            if at_home:
                home_initials = team_initials
                away_initials = '___'
            else:
                home_initials = '___'
                away_initials = team_initials

            if home_away:
                scoreline = f'{home_initials} {score["homeGoals"]} - {score["awayGoals"]} {away_initials}'
            else:
                scoreline = f'{score["homeGoals"]} - {score["awayGoals"]}'

            if scoreline in freq:
                freq[scoreline] += 1
            else:
                freq[scoreline] = 0

        return freq

    def _fixture_scoreline_freq(
        self,
        team1: str,
        team2: str,
        home_away: bool = True
    ) -> dict[str, int]:
        freq = {}  # type: dict[str, int]

        team1_initials = convert_team_name_or_initials(team1)
        team2_initials = convert_team_name_or_initials(team2)

        team1_row = self.fixtures.loc[team1]
        # Remove higher-level multi-index
        team1_row.index = team1_row.index.get_level_values(2)
        teams = team1_row.loc['teams']  # type: list[str]
        scores = team1_row.loc['score']  # type: list[dict[str, int]]
        at_homes = team1_row.loc['atHome']  # type: list[bool]

        for team, score, at_home in zip(teams, scores, at_homes):
            if team == team2:
                if at_home:
                    home_initials = team1_initials
                    away_initials = team2_initials
                else:
                    home_initials = team2_initials
                    away_initials = team1_initials

                if home_away:
                    scoreline = f'{home_initials} {score["homeGoals"]} - {score["awayGoals"]} {away_initials}'
                else:
                    scoreline = f'{score["homeGoals"]} - {score["awayGoals"]}'

                if scoreline in freq:
                    freq[scoreline] += 1
                else:
                    freq[scoreline] = 0

        return freq

    @staticmethod
    def _separate_scoreline_freq_by_home_away(
        team: str,
        freq: dict[str, int],
        at_home: bool
    ) -> dict[str, int]:
        freq_subset = {}  # type: dict[str, int]

        # If at_home, only keep scoreline frequencies where team is at home
        # If not at_home, only keep scoreline frequencies where team is away
        team_initials = convert_team_name_or_initials(team)
        for scoreline in freq:
            if ((at_home and scoreline[:3] == team_initials) or
                    (not at_home and scoreline[-3:] == team_initials)):
                freq_subset[scoreline] = freq[scoreline]

        return freq_subset

    @staticmethod
    def _display_scoreline_freq(freq: dict[str, int | float]):
        sorted_freq = []
        for scoreline, count in freq.items():
            sorted_freq.append((scoreline, count))

        # Sort by frequency count descending
        sorted_freq.sort(key=lambda x: x[1], reverse=True)

        for scoreline, count in sorted_freq:
            print(scoreline, count)

    @staticmethod
    def _scoreline_freq_probability(freq: dict[str, int]) -> dict[str, float]:
        total_scorelines = sum(freq.values())

        probabilities = {}  # type: dict[str, float]
        for scoreline in freq:
            probabilities[scoreline] = freq[scoreline] / total_scorelines

        return probabilities

    @staticmethod
    def _remove_scoreline_freq_teams(
        freq: dict[str, int | float]
    ) -> dict[str, int | float]:
        new_freq = {}
        for scoreline, count in freq.items():
            # Remove team initials and space on either side
            new_scoreline = scoreline[4:-4]
            new_freq[new_scoreline] = count

        return new_freq

    @staticmethod
    def _remove_scoreline_freq_home_away(
        freq: dict[str, int | float],
        home_team: str = None,
        away_team: str = None,
    ) -> dict[str, int | float]:
        new_freq = {}
        if home_team is not None:
            home_team_initials = convert_team_name_or_initials(home_team)
        if away_team is not None:
            away_team_initials = convert_team_name_or_initials(away_team)
        for scoreline, count in freq.items():
            # Remove team initials and space on either side
            home_initials, home_goals, _, away_goals, away_initials = scoreline.split(
                ' ')

            # If wrong way around, swap scoreline team order
            if ((home_team is not None and away_initials == home_team_initials) or
                    (away_team is not None and home_initials == away_team_initials)):
                new_scoreline = f'{away_initials} {away_goals} - {home_goals} {home_initials}'
                if new_scoreline in new_freq:
                    new_freq[new_scoreline] += count
                else:
                    new_freq[new_scoreline] = count

        return new_freq

    @staticmethod
    def _merge_scoreline_freq(
        freq1: dict[str, int | float],
        freq2: dict[str, int | float]
    ) -> dict[str, int | float]:
        merged_freq = {}  # type: dict[str, int | float]
        for freq in (freq1, freq2):
            for scoreline, count in freq.items():
                if scoreline in merged_freq:
                    merged_freq[scoreline] += count
                else:
                    merged_freq[scoreline] = count

        return merged_freq

    def _avg_goals_scored(
            freq: dict[str, int],
            team1: str,
            team2: str
    ) -> tuple[float, float]:
        team1_played = 0
        team2_played = 0
        team1_goals = 0
        team2_goals = 0
        team1_initials = convert_team_name_or_initials(team1)
        team2_initials = convert_team_name_or_initials(team2)
        for scoreline, count in freq.items():
            home, away = extract_int_score_from_scoreline(scoreline)
            if scoreline[:3] == team1_initials:
                team1_played += count
                team1_goals += home
            elif scoreline[:3] == team2_initials:
                team2_played += count
                team2_goals += home
            if scoreline[-3:] == team1_initials:
                team1_played += count
                team1_goals += away
            elif scoreline[-3:] == team2_initials:
                team2_played += count
                team2_goals += away

        team1_avg_goals = 0
        if team1_played > 0:
            team1_avg_goals = team1_goals / team1_played

        team2_avg_goals = 0
        if team2_played > 0:
            team2_avg_goals = team2_goals / team2_played

        return (team1_avg_goals, team2_avg_goals)

    @staticmethod
    def _insert_scaled_into_freq(
        freq: dict[str, int | float],
        insert_freq: dict[str, int | float],
        scale: float = 1.0
    ):
        for scoreline, count in insert_freq.items():
            if scoreline in freq:
                freq[scoreline] += count * scale
            else:
                freq[scoreline] = count * scale

    @staticmethod
    def _subtract_scaled_from_freq(
        freq: dict[str, int | float],
        subtract_freq: dict[str, int | float],
        scale: float = 1.0
    ):
        for scoreline, count in subtract_freq.items():
            if scoreline in freq:
                freq[scoreline] -= count * scale

    class Odds:
        def __init__(self, home: float, draw: float, away: float):
            self.home = home
            self.draw = draw
            self.away = away
            self.representation: Literal['odds', 'probabilities'] = 'odds'

        def _toggle_reciprocal(self):
            self.home = 1 / self.home
            self.draw = 1 / self.draw
            self.away = 1 / self.away

        def convert_to_probabilities(self):
            if self.representation == 'odds':
                self._toggle_reciprocal()
                self.representation = 'probabilities'

        def convert_to_odds(self):
            if self.representation == 'probabilities':
                self._toggle_reciprocal()
                self.representation = 'odds'

    @staticmethod
    def scale_by_odds(freq: dict[str, int | float], odds: Odds):
        odds.convert_to_probabilities()
        for scoreline in freq:
            home, away = extract_int_score_from_scoreline(scoreline)
            if home > away:
                freq[scoreline] *= odds.home
            elif home < away:
                freq[scoreline] *= odds.away
            elif home == away:
                freq[scoreline] *= odds.draw

    class Match(NamedTuple):
        date: datetime
        home_team: str
        away_team: str
        score: dict[str, int]

    def _get_recent_matches(self, team: str, num_matches: int) -> list[Match]:
        team_row = self.fixtures.loc[team]
        # Remove higher-level multi-index
        team_row.index = team_row.index.get_level_values(2)
        teams = team_row.loc['teams']  # type: list[str]
        scores = team_row.loc['score']  # type: list[dict[str, int]]
        at_homes = team_row.loc['atHome']  # type: list[bool]
        dates = team_row.loc['date']  # type: list[datetime]

        matches = []  # type: list[self.Match]
        for date, opp_team, score, at_home in zip(dates, teams, scores, at_homes):
            if at_home:
                home_team = team
                away_team = opp_team
            else:
                home_team = opp_team
                away_team = team
            match = self.Match(date, home_team, away_team, score)
            matches.append(match)

        matches.sort(lambda match: match.date)
        matches = matches[-num_matches:]

        return matches

    @staticmethod
    def _get_scorelines_from_recent_matches(matches: list[Match]) -> list[str]:
        scorelines = []  # type: list[str]
        for match in matches:
            home_initials = convert_team_name_or_initials(match.home_team)
            away_initials = convert_team_name_or_initials(match.away_team)
            scoreline = f'{home_initials} {match.score["homeGoals"]} - {match.score["awayGoals"]} {away_initials}'
            scorelines.append(scoreline)

        return scorelines

    @staticmethod
    def _insert_scorelines_into_freq(
        freq: dict[str, int],
        scorelines: list[str],
        weightings: list[float] = None
    ) -> dict[str, int]:
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
    def _remove_recent_matches_scorelines_home_away(
        scorelines: list[str],
        home_team: str = None,
        away_team: str = None
    ) -> list[str]:
        new_scorelines = []  # type: list[str]

        if home_team is not None:
            home_team_initials = convert_team_name_or_initials(home_team)
        if away_team is not None:
            away_team_initials = convert_team_name_or_initials(away_team)
        for scoreline in scorelines:
            # Remove team initials and space on either side
            home_initials, home_goals, _, away_goals, away_initials = scoreline.split(
                ' ')

            # If wrong way around, swap scoreline team order
            if ((home_team is not None and away_initials == home_team_initials) or
                    (away_team is not None and home_initials == away_team_initials)):
                new_scoreline = f'{away_initials} {away_goals} - {home_goals} {home_initials}'
                new_scorelines.append(new_scoreline)

        return new_scorelines

    @staticmethod
    def _remove_recent_matches_scorelines_teams(scorelines: list[str]) -> list[str]:
        new_scorelines = []  # type: list[str]
        for scoreline in scorelines:
            new_scoreline = scoreline[4:-4]
            new_scorelines.append(new_scoreline)

        return new_scorelines

    def scoreline_probabilities(
        self,
        home_team: str,
        away_team: str
    ) -> dict[str, float]:
        HOME_AWAY_WEIGHTING = 0.2
        FIXTURE_WEIGHTING = 0.4

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

        # Combine all fixtures from both teams
        scoreline_freq = self._merge_scoreline_freq(
            self._remove_scoreline_freq_teams(home_scoreline_freq),
            self._remove_scoreline_freq_teams(away_scoreline_freq)
        )

        # Force all scoreline orders into upcoming home team as the home team
        home_scoreline_freq_home = self._remove_scoreline_freq_home_away(
            home_scoreline_freq_home, home_team)
        away_scoreline_freq_away = self._remove_scoreline_freq_home_away(
            away_scoreline_freq_away, None, away_team)
        fixture_scoreline_freq = self._remove_scoreline_freq_home_away(
            fixture_scoreline_freq, home_team)
        scoreline_freq = self._remove_scoreline_freq_home_away(
            scoreline_freq, home_team)

        # Subtract one set of this fixture scorelines, since merging the two teams
        # total fixtures will double up this set meaning scoreline_freq has duplicates
        self._subtract_scaled_from_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(fixture_scoreline_freq)
        )
        # Re-insert home scorelines for home team (scaled down)
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(home_scoreline_freq_home),
            HOME_AWAY_WEIGHTING
        )
        # Re-insert away scorelines for away team (scaled down)
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(away_scoreline_freq_away),
            HOME_AWAY_WEIGHTING
        )
        # After the subtracting earlier, we can now fully control any additional
        # weighting for fixture scorelines
        self._insert_scaled_into_freq(
            scoreline_freq,
            self._remove_scoreline_freq_teams(fixture_scoreline_freq),
            FIXTURE_WEIGHTING
        )

        home_team_recent_matches = self._get_recent_matches(home_team, 20)
        away_team_recent_matches = self._get_recent_matches(away_team, 20)
        home_team_recent_scorelines = self._get_scorelines_from_recent_matches(
            home_team_recent_matches)
        away_team_recent_scorelines = self._get_scorelines_from_recent_matches(
            away_team_recent_matches)

        scoreline_probabilities = self._scoreline_freq_probability(
            scoreline_freq)
        return scoreline_probabilities

    def maximum_likelihood(scoreline_probabilities: dict[str, float]) -> str | None:
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
    ) -> dict:
        scoreline_probabilities = self.scoreline_probabilities(
            home_team, away_team)
        self._display_scoreline_freq(scoreline_probabilities)

        predicted = self.maximum_likelihood(scoreline_probabilities)
        return predicted

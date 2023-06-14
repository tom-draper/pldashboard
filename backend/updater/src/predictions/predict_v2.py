from dataclasses import dataclass
import pandas as pd
from src.data import Form, HomeAdvantages, TeamRatings, Fixtures
from src.fmt import convert_team_name_or_initials, extract_int_score_from_scoreline
from typing import Literal


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
        # [last season, 2 seasons ago, 3 seasons ago]
        total_fixtures = {season: fixtures.df}
        prev_fixtures = [Fixtures(), Fixtures(), Fixtures()]
        for i in range(num_seasons-1):
            prev_fixtures[i].build(json_data, season-i-1)
            total_fixtures[season-i-1] = prev_fixtures[i].df

        total_fixtures = pd.concat(total_fixtures, axis=1)
        
        # Drop rows for teams not featured in current season
        total_fixtures = total_fixtures.drop(
            index=total_fixtures.index.difference(fixtures.df.index.tolist()), axis=0)

        self.fixtures = total_fixtures
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages

    def _team_scoreline_freq(
        self,
        team: str,
        home_away: bool = True
    ) -> dict[str, int]:
        freq = {}
        team_initials = convert_team_name_or_initials(team)

        team_row = self.fixtures.loc[team]
        # Remove higher-level multiindex
        team_row.index = team_row.index.get_level_values(2)
        scores = team_row.loc['score']
        at_homes = team_row.loc['atHome']

        for score, at_home in zip(scores, at_homes):
            if home_away:
                if at_home:
                    scoreline = f'{team_initials} {score["homeGoals"]} - {score["awayGoals"]} ___'
                else:
                    scoreline = f'___ {score["homeGoals"]} - {score["awayGoals"]} {team_initials}'
            else:
                scoreline = f'{score["homeGoals"]} - {score["awayGoals"]}'

            if scoreline in freq:
                freq[scoreline] += 1
            else:
                freq[scoreline] = 1

        return freq

    def _fixture_scoreline_freq(
        self,
        team1: str,
        team2: str,
        home_away: bool = True
    ) -> dict[str, int]:
        freq = {}

        team1_initials = convert_team_name_or_initials(team1)
        team2_initials = convert_team_name_or_initials(team2)

        team1_row = self.fixtures.loc[team1]

        for (season, matchday, column) in team1_row.index:
            if column == "team" and team1_row[(season, matchday, column)] == team2:
                at_home = team1_row[(season, matchday, 'atHome')]
                score = team1_row[(season, matchday, 'score')]

                if home_away:
                    if at_home:
                        scoreline = f'{team1_initials} {score["homeGoals"]} - {score["awayGoals"]} {team2_initials}'
                    else:
                        scoreline = f'{team2_initials} {score["homeGoals"]} - {score["awayGoals"]} {team1_initials}'
                else:
                    scoreline = f'{score["homeGoals"]} - {score["awayGoals"]}'

                if scoreline in freq:
                    freq[scoreline] += 1
                else:
                    freq[scoreline] = 1

        return freq

    @staticmethod
    def _separate_scoreline_freq_by_home_away(
        team: str,
        freq: dict[str, int],
        at_home: bool
    ) -> dict[str, int]:
        separated_freq = {}

        team_initials = convert_team_name_or_initials(team)
        for scoreline in freq:
            if ((at_home and scoreline[:3] == team_initials) or
                    (not at_home and scoreline[-3:] == team_initials)):
                separated_freq[scoreline] = freq[scoreline]

        return separated_freq

    @staticmethod
    def _display_scoreline_freq(freq: dict[str, int | float]):
        sorted_freq = []
        for scoreline, count in freq.items():
            sorted_freq.append((scoreline, count))

        # Sort by frequency count descending
        sorted_freq.sort(key=lambda x: x[1], reverse=True)

        for scoreline, count in sorted_freq.items():
            print(scoreline, count)

    @staticmethod
    def _scoreline_freq_probability(freq: dict[str, int]) -> dict[str, float]:
        total_scorelines = sum(freq.values())

        probabilities = {}
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
            home_initials, home_goals, _, away_goals, away_initials = scoreline.split(' ')

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
        merged_freq = {}
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
        for scoreline, count in insert_freq:
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
        home_scoreline_freq_home = self._remove_scoreline_freq_home_away(home_scoreline_freq_home, home_team)
        away_scoreline_freq_away = self._remove_scoreline_freq_home_away(away_scoreline_freq_away, None, away_team)
        fixture_scoreline_freq = self._remove_scoreline_freq_home_away(fixture_scoreline_freq, home_team)
        scoreline_freq = self._remove_scoreline_freq_home_away(scoreline_freq, home_team)

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

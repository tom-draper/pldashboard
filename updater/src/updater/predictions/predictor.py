from typing import Optional

import numpy as np
from updater.data.dataframes import Form, HomeAdvantages, TeamRatings
from updater.fmt import clean_full_team_name, get_full_time_goals

from updater.predictions.scoreline import Scoreline


def _calc_form(
    team: str,
    recent_matches: list[Scoreline],
    weightings: list[float],
    team_ratings: TeamRatings,
):
    weightings = weightings / np.sum(weightings)
    form = 0.5
    for scoreline, weight in zip(recent_matches, weightings):
        if scoreline.home_team == team:
            gd = scoreline.home_goals - scoreline.away_goals
            opposition = scoreline.away_team
        elif scoreline.away_team == team:
            gd = scoreline.away_goals - scoreline.home_goals
            opposition = scoreline.home_team
        else:
            continue
        opposition_rating = 0
        if opposition in team_ratings.df.index:
            opposition_rating = team_ratings.df.at[opposition, "total"]
        form += opposition_rating * gd * weight
    return min(max(0, form), 1)


class Predictor:
    def __init__(
        self,
        json_data: dict,
        form: Form,
        team_ratings: TeamRatings,
        home_advantages: HomeAdvantages,
        season: int,
        num_seasons: int,
    ):
        self.team_records = self._build_team_records(json_data, season, num_seasons)
        self.form = form
        self.team_ratings = team_ratings
        self.home_advantages = home_advantages
        self.HOME_AWAY_WEIGHTING = 0.2
        self.FIXTURE_WEIGHTING = 0.4

    @staticmethod
    def _build_team_records(
        json_data: dict, season: int, num_seasons: int
    ) -> dict[str, list[dict]]:
        """Build a flat per-team records dict from raw fixtures JSON across all seasons.

        Each record: {date, team (opposition), score {homeGoals, awayGoals}, atHome}.
        Only includes finished matches (non-null scores).
        """
        records: dict[str, list[dict]] = {}
        for i in range(num_seasons):
            for match in json_data["fixtures"][season - i]:
                home_goals, away_goals = get_full_time_goals(match["score"]["fullTime"])
                if home_goals is None:
                    continue
                home_team = clean_full_team_name(match["homeTeam"]["name"])
                away_team = clean_full_team_name(match["awayTeam"]["name"])
                score = {"homeGoals": home_goals, "awayGoals": away_goals}
                date = match["utcDate"]
                records.setdefault(home_team, []).append(
                    {"date": date, "team": away_team, "score": score, "atHome": True}
                )
                records.setdefault(away_team, []).append(
                    {"date": date, "team": home_team, "score": score, "atHome": False}
                )
        return records

    def _team_scoreline_freq(self, team: str):
        freq: dict[Scoreline, int] = {}
        for record in self.team_records.get(team, []):
            at_home = record["atHome"]
            score = record["score"]
            home_team = team if at_home else None
            away_team = None if at_home else team
            scoreline = Scoreline(score["homeGoals"], score["awayGoals"], home_team, away_team)
            freq[scoreline] = freq.get(scoreline, 0) + 1
        return freq

    def _fixture_scoreline_freq(self, team1: str, team2: str):
        freq: dict[Scoreline, int] = {}
        for record in self.team_records.get(team1, []):
            if record["team"] != team2:
                continue
            at_home = record["atHome"]
            score = record["score"]
            home_team = team1 if at_home else team2
            away_team = team2 if at_home else team1
            scoreline = Scoreline(score["homeGoals"], score["awayGoals"], home_team, away_team)
            freq[scoreline] = freq.get(scoreline, 0) + 1
        return freq

    @staticmethod
    def _separate_scoreline_freq_by_home_away(
        team: str, freq: dict[Scoreline, int], at_home: bool
    ):
        return {
            scoreline: count
            for scoreline, count in freq.items()
            if (at_home and scoreline.home_team == team)
            or (not at_home and scoreline.away_team == team)
        }

    @staticmethod
    def _remove_scoreline_freq_home_away(
        freq: dict[Scoreline, int],
        intended_home_team: Optional[str] = None,
        intended_away_team: Optional[str] = None,
    ):
        new_freq: dict[Scoreline, int] = {}
        for scoreline, count in freq.items():
            if (
                intended_home_team is not None
                and scoreline.away_team == intended_home_team
            ) or (
                intended_away_team is not None
                and scoreline.home_team == intended_away_team
            ):
                scoreline.reverse()

            new_freq[scoreline] = new_freq.get(scoreline, 0) + count

        return new_freq

    @staticmethod
    def _merge_scoreline_freq(freq1: dict[Scoreline, int], freq2: dict[Scoreline, int]):
        merged: dict[Scoreline, int] = dict(freq1)
        for scoreline, count in freq2.items():
            merged[scoreline] = merged.get(scoreline, 0) + count
        return merged

    @staticmethod
    def _strip_teams(freq: dict[Scoreline, int]) -> dict[tuple[int, int], int | float]:
        """Collapse scoreline frequencies to score-only keys, summing counts for identical scores."""
        result: dict[tuple[int, int], int | float] = {}
        for scoreline, count in freq.items():
            key = (scoreline.home_goals, scoreline.away_goals)
            result[key] = result.get(key, 0) + count
        return result

    @staticmethod
    def _scoreline_freq_probability(freq: dict[tuple[int, int], int | float]):
        total = sum(freq.values())
        if total <= 0:
            return {}
        return {key: count / total for key, count in freq.items()}

    @staticmethod
    def _insert_scaled_into_freq(
        freq: dict[tuple[int, int], int | float],
        insert_freq: dict[tuple[int, int], int | float],
        scale: float = 1.0,
    ):
        for key, count in insert_freq.items():
            freq[key] = freq.get(key, 0) + count * scale

    @staticmethod
    def _subtract_scaled_from_freq(
        freq: dict[tuple[int, int], int | float],
        subtract_freq: dict[tuple[int, int], int | float],
        scale: float = 1.0,
    ):
        for key, count in subtract_freq.items():
            if key in freq:
                freq[key] -= count * scale

    def get_recent_scorelines(self, team: str, num_matches: Optional[int]):
        dated_scorelines: list[tuple[str, Scoreline]] = []
        for record in self.team_records.get(team, []):
            score = record["score"]
            opposition = record["team"]
            at_home = record["atHome"]
            home_team = team if at_home else opposition
            away_team = opposition if at_home else team
            scoreline = Scoreline(score["homeGoals"], score["awayGoals"], home_team, away_team)
            dated_scorelines.append((record["date"], scoreline))

        dated_scorelines.sort(key=lambda x: x[0])
        scorelines = [s for (_, s) in dated_scorelines]
        if num_matches is not None:
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
        scoreline_freq = self._strip_teams(
            self._merge_scoreline_freq(home_scoreline_freq, away_scoreline_freq)
        )

        # Subtract one set of this fixture scorelines to remove the duplication
        self._subtract_scaled_from_freq(scoreline_freq, self._strip_teams(fixture_scoreline_freq))

        # Re-insert home/away scorelines with home advantage weighting
        self._insert_scaled_into_freq(
            scoreline_freq, self._strip_teams(home_scoreline_freq_home), self.HOME_AWAY_WEIGHTING
        )
        self._insert_scaled_into_freq(
            scoreline_freq, self._strip_teams(away_scoreline_freq_away), self.HOME_AWAY_WEIGHTING
        )
        # Re-insert fixture scorelines with extra weighting
        self._insert_scaled_into_freq(
            scoreline_freq, self._strip_teams(fixture_scoreline_freq), self.FIXTURE_WEIGHTING
        )

        # Scale by recent form
        home_team_recent = self.get_recent_scorelines(home_team, 20)
        away_team_recent = self.get_recent_scorelines(away_team, 20)
        home_form = _calc_form(
            home_team,
            home_team_recent,
            np.linspace(0.2, 1, len(away_team_recent)),
            self.team_ratings,
        )
        away_form = _calc_form(
            away_team,
            away_team_recent,
            np.linspace(0.2, 1, len(away_team_recent)),
            self.team_ratings,
        )
        scale = (home_form / 2 + 0.5, 1.0, away_form / 2 + 0.5)
        self._scale_results(scoreline_freq, scale)

        return self._scoreline_freq_probability(scoreline_freq)

    @staticmethod
    def _scale_results(
        scoreline_freq: dict[tuple[int, int], float], scale: tuple[float, float, float]
    ):
        home_scale, draw_scale, away_scale = scale
        for key in scoreline_freq:
            home_goals, away_goals = key
            if home_goals > away_goals:
                scoreline_freq[key] *= home_scale
            elif home_goals < away_goals:
                scoreline_freq[key] *= away_scale
            else:
                scoreline_freq[key] *= draw_scale

    @staticmethod
    def maximum_likelihood(
        scoreline_probabilities: dict[tuple[int, int], float],
    ) -> Optional[tuple[int, int]]:
        if not scoreline_probabilities:
            return None
        return max(scoreline_probabilities, key=scoreline_probabilities.get)

    def predict_score(self, home_team: str, away_team: str):
        probabilities = self.scoreline_probabilities(home_team, away_team)
        home_goals, away_goals = self.maximum_likelihood(probabilities)
        return Scoreline(home_goals, away_goals, home_team, away_team)

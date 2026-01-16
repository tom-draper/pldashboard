from dataclasses import dataclass
from datetime import datetime

import pandas as pd
from updater.data.dataframes import Fixtures, Form, HomeAdvantages, Upcoming
from updater.database import Database
from updater.fmt import convert_team_name_or_initials, identical_fixtures


class Predictor:
    def __init__(self, form_diff_multiplier: int = 0.5, home_adv_multiplier: int = 1):
        self.form_diff_multiplier = form_diff_multiplier
        self.home_adv_multiplier = home_adv_multiplier

    @staticmethod
    def _outdated_prediction_already_made(
        date: str, new_prediction: str, predictions: dict
    ):
        if date not in predictions.keys():
            return False

        for prediction in predictions[date]:
            predicted_score = prediction["prediction"]
            actual_score = prediction["actual"]
            if predicted_score is None:
                continue
            if identical_fixtures(predicted_score, new_prediction):
                # If fixture match perfectly but predicted scoreline different (outdated)
                return (predicted_score != new_prediction) and (actual_score is None)
        return False

    @staticmethod
    def _avg_previous_result(team: str, prev_matches: list[dict[str, str]]):
        goals_scored = 0
        goals_conceded = 0
        for prev_match in prev_matches:
            if team == prev_match["homeTeam"]:
                # Played at home
                goals_scored += prev_match["homeGoals"]
                goals_conceded += prev_match["awayGoals"]
            elif team == prev_match["awayTeam"]:
                # Played away
                goals_scored += prev_match["awayGoals"]
                goals_conceded += prev_match["homeGoals"]

        # Average scored and conceded
        avg_scored = goals_scored / len(prev_matches)
        avg_conceded = goals_conceded / len(prev_matches)

        return avg_scored, avg_conceded

    def _adjust_by_form(
        self,
        form_rating: float,
        opposition_form_rating: float,
        predicted_scored: float = 0,
        predicted_conceded: float = 0,
    ):
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = form_rating - opposition_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            predicted_scored += predicted_scored * (form_diff / 100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            predicted_conceded += (
                predicted_conceded * abs(form_diff / 100) * self.form_diff_multiplier
            )

        return predicted_scored, predicted_conceded

    def _adjust_by_form_new(
        self,
        home_form_rating: float,
        away_form_rating: float,
        home_goals: float = 0,
        away_goals: float = 0,
    ):
        # Boost the score of the team better in form based on the absolute difference in form
        form_diff = home_form_rating - away_form_rating

        if form_diff > 0:
            # This team in better form -> increase predicted scored
            home_goals += home_goals * (form_diff / 100) * self.form_diff_multiplier
        else:
            # Opposition team in better form -> increase predicted coneded
            away_goals += away_goals * abs(form_diff / 100) * self.form_diff_multiplier
        return home_goals, away_goals

    def _adjust_by_home_advantage(
        self,
        home_advantage: float,
        opposition_home_advantage: float,
        at_home: bool,
        predicted_scored: float = 0,
        predicted_conceded: float = 0,
    ):
        # Use the home advantge to adjust the pred scored and conceded
        # for a team in opposite directions by an equal amount
        if at_home:
            # Decrease conceded (assuming team has a positive home advantage)
            predicted_conceded *= 1 - (home_advantage * self.home_adv_multiplier * 0.5)
            # Increase scored (assuming team has a positive home advantage)
            predicted_scored *= 1 + (home_advantage * self.home_adv_multiplier * 0.5)
        else:
            # Decrease scored (assuming opposition team has a positive home advantage)
            predicted_scored *= 1 - (opposition_home_advantage * self.home_adv_multiplier * 0.5)
            # Increase conceded (assuming opposition team has a positive home advantage)
            predicted_conceded *= 1 + (opposition_home_advantage * self.home_adv_multiplier * 0.5)

        return predicted_scored, predicted_conceded

    def _adjust_by_home_advantage_new(
        self, home_advantage: float, home_goals: float = 0, away_goals: float = 0
    ):
        home_goals *= 1 + (home_advantage * self.home_adv_multiplier * 0.5)
        away_goals *= 1 - (home_advantage * self.home_adv_multiplier * 0.5)
        return home_goals, away_goals

    @staticmethod
    def _neutral_prev_matches(prev_matches: list[dict[str, str]]):
        neutral_prev_matches: list[dict[str, str]] = []
        for match in prev_matches:
            neutral_match = {}
            # Rename to match json format
            for k, v in match.items():
                neutral_match[k[0].lower() + k[1:]] = v
            neutral_match.pop("result")  # Remove result key
            neutral_prev_matches.append(neutral_match)

        return neutral_prev_matches

    @staticmethod
    def _starting_score(
        avg_result: tuple[float, float], opp_avg_result: tuple[float, float]
    ):
        # Midway between team's avg scored and opposition's avg conceded
        predicted_scored = (avg_result[0] + opp_avg_result[1]) / 2
        predicted_conceded = (avg_result[1] + opp_avg_result[0]) / 2

        return predicted_scored, predicted_conceded

    @staticmethod
    def _starting_score_new(
        home_avg_result: tuple[float, float], away_avg_result: tuple[float, float]
    ):
        # Midway between team's avg scored and opposition's avg conceded
        home_goals = (home_avg_result[0] + away_avg_result[1]) / 2
        away_goals = (home_avg_result[1] + away_avg_result[0]) / 2
        return home_goals, away_goals

    def _adjust_by_prev_matches(
        self,
        team: str,
        predicted_scored: float,
        predicted_conceded: float,
        prev_matches: list[dict[str, str]],
        prev_meeting_weight: float = 0.5,
    ):
        if not prev_matches:
            return 0, 0

        # Modify with average scored and conceded in previous meetings
        prev_meeting_scored, prev_meeting_conceded = self._avg_previous_result(
            team, prev_matches
        )

        predicted_scored = (prev_meeting_scored * prev_meeting_weight) + (
            predicted_scored * (1 - prev_meeting_weight)
        )
        predicted_conceded = (prev_meeting_conceded * prev_meeting_weight) + (
            predicted_conceded * (1 - prev_meeting_weight)
        )

        return predicted_scored, predicted_conceded

    def _adjust_by_prev_matches_new(
        self,
        team: str,
        home_goals: float,
        away_goals: float,
        at_home: float,
        prev_matches: list[dict[str, str]],
        prev_meeting_weight: float = 0.5,
    ):
        if not prev_matches:
            return home_goals, away_goals

        # Get avg scored and conceded from perspective of current team
        avg_scored, avg_conceded = self._avg_previous_result(team, prev_matches)

        # Allocated to home and away goals depending on at_home
        if at_home:
            avg_home_goals = avg_scored
            avg_away_goals = avg_conceded
        else:
            avg_home_goals = avg_conceded
            avg_away_goals = avg_scored

        home_goals = (avg_home_goals * prev_meeting_weight) + (
            home_goals * (1 - prev_meeting_weight)
        )
        away_goals = (avg_away_goals * prev_meeting_weight) + (
            away_goals * (1 - prev_meeting_weight)
        )

        return home_goals, away_goals

    def _calc_score_prediction(
        self,
        team: str,
        avg_result: tuple[float, float],
        opposition_avg_result: tuple[float, float],
        home_advantage: float,
        opposition_home_advantage: float,
        at_home: bool,
        form_rating: float,
        long_term_form_rating: float,
        opposition_form_rating: float,
        opposition_long_term_form_rating: float,
        prev_matches: list[dict[str, str]],
    ):
        predicted_scored, predicted_conceded = self._starting_score(avg_result, opposition_avg_result)

        predicted_scored, predicted_conceded = self._adjust_by_prev_matches(
            team, predicted_scored, predicted_conceded, prev_matches
        )

        # Modify based on difference in current form (last 5 games) between two teams
        predicted_scored, predicted_conceded = self._adjust_by_form(
            form_rating, opposition_form_rating, predicted_scored, predicted_conceded
        )

        # Modify based on difference in longer-term (10 games) form between two teams
        predicted_scored, predicted_conceded = self._adjust_by_form(
            long_term_form_rating, opposition_long_term_form_rating, predicted_scored, predicted_conceded
        )

        # Decrease scores conceded if playing at home
        predicted_scored, predicted_conceded = self._adjust_by_home_advantage(
            home_advantage, opposition_home_advantage, at_home, predicted_scored, predicted_conceded
        )

        return predicted_scored, predicted_conceded

    def _calc_score_prediction_new(
        self,
        team: str,
        home_avg_result: tuple[float, float],
        away_avg_result: tuple[float, float],
        home_form_rating: float,
        away_form_rating: float,
        home_long_term_form_rating: float,
        away_long_term_form_rating: float,
        at_home: bool,
        home_advantage: float,
        prev_matches: list[dict[str, str]],
    ):
        home_goals, away_goals = self._starting_score_new(
            home_avg_result, away_avg_result
        )

        home_goals, away_goals = self._adjust_by_prev_matches_new(
            team, home_goals, away_goals, at_home, prev_matches
        )

        # Modify based on difference in current form (last 5 games) between two teams
        home_goals, away_goals = self._adjust_by_form_new(
            home_form_rating, away_form_rating, home_goals, away_goals
        )

        # Modify based on difference in longer-term (10 games) form between two teams
        home_goals, away_goals = self._adjust_by_form_new(
            home_long_term_form_rating,
            away_long_term_form_rating,
            home_goals,
            away_goals,
        )

        # Decrease scores conceded if playing at home
        home_goals, away_goals = self._adjust_by_home_advantage_new(
            home_advantage, home_goals, away_goals
        )

        return home_goals, away_goals

    @staticmethod
    def _prediction_details(
        team: str,
        opposition: str,
        predicted_scored: float,
        predicted_conceded: float,
        at_home: bool,
    ):
        team_initials = convert_team_name_or_initials(team)
        opposition_initials = convert_team_name_or_initials(opposition)

        # Construct prediction string for display
        if at_home:
            home = team_initials
            away = opposition_initials
            prediction = {
                "homeGoals": round(predicted_scored, 4),
                "awayGoals": round(predicted_conceded, 4),
            }
        else:
            home = opposition_initials
            away = team_initials
            prediction = {
                "homeGoals": round(predicted_conceded, 4),
                "awayGoals": round(predicted_scored, 4),
            }

        return home, away, prediction

    def gen_score_predictions(
        self,
        fixtures: Fixtures,
        form: Form,
        upcoming: Upcoming,
        home_advantages: HomeAdvantages,
    ):
        predictions: dict[dict[str, datetime | str | float]] = {}
        teams = form.df.index.values.tolist()

        # Check ALL teams as two teams can have different next games
        for team in teams:
            if upcoming is None:
                predictions[team] = None
                continue

            form_rating = form.get_current_form_rating(team)
            long_term_form_rating = form.get_long_term_form_rating(team)

            opposition = upcoming.at[team, "team"]
            at_home = upcoming.at[team, "atHome"]
            prev_matches = upcoming.at[team, "prevMatches"]

            opp_form_rating = form.get_current_form_rating(opposition)
            opp_long_term_form_rating = form.get_long_term_form_rating(opposition)

            avg_result = fixtures.get_avg_result(team)
            opposition_avg_result = fixtures.get_avg_result(opposition)

            home_advantage = home_advantages.df.loc[team, "totalHomeAdvantage"][0]
            opposition_home_advantage = home_advantages.df.loc[
                opposition, "totalHomeAdvantage"
            ][0]

            predicted_scored, predicted_conceded = self._calc_score_prediction(
                team,
                avg_result,
                opposition_avg_result,
                home_advantage,
                opposition_home_advantage,
                at_home,
                form_rating,
                long_term_form_rating,
                opp_form_rating,
                opp_long_term_form_rating,
                prev_matches,
            )

            home_initials, away_initials, pred = self._prediction_details(
                team, opposition, predicted_scored, predicted_conceded, at_home
            )

            date = upcoming.at[team, "date"].to_pydatetime()

            prediction = {
                "date": date,
                "homeInitials": home_initials,
                "awayInitials": away_initials,
                "prediction": pred,
            }

            predictions[team] = prediction

        return predictions

    def gen_score_predictions_new(
        self,
        fixtures: Fixtures,
        form: Form,
        upcoming: Upcoming,
        home_advantages: HomeAdvantages,
    ):
        predictions: dict[dict[str, datetime | str | float]] = {}
        teams: list[str] = form.df.index.values.tolist()

        # Check ALL teams as two teams can have different next games
        for team in teams:
            if upcoming is None:
                predictions[team] = None
                continue

            at_home = upcoming.at[team, "atHome"]
            if at_home:
                home_team = team
                away_team = upcoming.at[home_team, "team"]
            else:
                away_team = team
                home_team = upcoming.at[away_team, "team"]

            home_form_rating = form.get_current_form_rating(home_team)
            home_long_term_form_rating = form.get_long_term_form_rating(home_team)
            home_avg_result = fixtures.get_avg_result(home_team)

            away_form_rating = form.get_current_form_rating(away_team)
            away_long_term_form_rating = form.get_long_term_form_rating(away_team)
            away_avg_result = fixtures.get_avg_result(away_team)

            home_advantage = home_advantages.df.loc[
                home_team, "totalHomeAdvantage"
            ][0]
            prev_matches = upcoming.at[team, "prevMatches"]

            home_goals, away_goals = self._calc_score_prediction_new(
                team,
                home_avg_result,
                away_avg_result,
                home_form_rating,
                away_form_rating,
                home_long_term_form_rating,
                away_long_term_form_rating,
                at_home,
                home_advantage,
                prev_matches,
            )

            prediction = {
                "homeGoals": round(home_goals, 4),
                "awayGoals": round(away_goals, 4),
            }

            predictions[team] = prediction

        return predictions


class Predictions:
    def __init__(self, current_season: int):
        self.predictor = Predictor()
        self.database = Database(current_season)
        self.prediction_file = f"data/predictions_{current_season}.json"

    @dataclass
    class PredictionsCount:
        total: int
        correct: int
        result_correct: int
        num_predicted_home: int
        num_predicted_away: int
        num_actual_home: int
        num_actual_away: int

    @staticmethod
    def _signed_float_str(value: float):
        value = round(value, 2)
        if value >= 0:
            return f"+{value}"
        return str(value)

    def _predictions_to_df(self, predictions: dict[str, dict[str, float]]):
        d: dict[str, dict[tuple[str, str], int]] = {}
        for team, prediction in predictions.items():
            p: dict[tuple[str, str], int] = {}
            for goals_type, goals in prediction.items():
                p[("prediction", goals_type)] = goals
            d[team] = p

        df = pd.DataFrame.from_dict(d, orient="index")
        return df

    def build(
        self,
        fixtures: Fixtures,
        form: Form,
        upcoming: Upcoming,
        home_advantages: HomeAdvantages,
    ):
        predictions = self.predictor.gen_score_predictions_new(
            fixtures, form, upcoming, home_advantages
        )
        upcoming_predictions = self._predictions_to_df(predictions)
        return upcoming_predictions

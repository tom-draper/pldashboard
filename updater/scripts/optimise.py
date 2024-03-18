import numpy as np
from src.database import Database
from src.fmt import convert_team_name_or_initials
from src.predictions import Predictor
from updater import Updater


class OptimisePredictions:
    @staticmethod
    def correct_result(
        ph: int | float, pa: int | float, ah: int | float, aa: int | float
    ):
        return (ph > pa and ah > aa) or (ph == pa and ah == aa) or (ph < pa and ah < aa)

    @staticmethod
    def game_result_tuple(match: dict):
        home_score = match["score"]["fullTime"]["homeTeam"]
        away_score = match["score"]["fullTime"]["awayTeam"]
        if home_score == away_score:
            return ("Drew", "Drew")
        elif home_score > away_score:
            return ("Won", "Lost")
        return ("Lost", "Won")

    def get_prev_matches(self, json_data: dict, teams: list[str]):
        prev_matches: list[dict[str, str | int]] = []
        for i in range(4):
            data = json_data["fixtures"][current_season - i]
            for match in data:
                if match["status"] != "FINISHED":
                    continue

                home_team: str = match["homeTeam"]["name"].replace("&", "and")
                away_team: str = match["awayTeam"]["name"].replace("&", "and")

                if home_team not in teams or away_team not in teams:
                    continue

                result = self.game_result_tuple(match)
                prev_match = {
                    "HomeTeam": home_team,
                    "AwayTeam": away_team,
                    "HomeGoals": match["score"]["fullTime"]["homeTeam"],
                    "AwayGoals": match["score"]["fullTime"]["awayTeam"],
                    "Result": result[0],
                }
                prev_matches.append(prev_match)
        return prev_matches

    def prediction_performance(
        self,
        predictor,
        actual_scores,
        json_data,
        teams,
        form,
        fixtures,
        home_advantages,
    ):
        correct = 0
        correct_result = 0
        loss = 0
        # Check ALL teams as two teams can have different next games
        for team, opposition, actual_score in actual_scores:
            form_rating = form.get_current_form_rating(team)
            long_term_form_rating = form.get_long_term_form_rating(team)
            opp_form_rating = form.get_current_form_rating(opposition)
            opp_long_term_form_rating = form.get_long_term_form_rating(opposition)
            avg_result = fixtures.get_avg_result(team)
            opp_avg_result = fixtures.get_avg_result(opposition)
            home_advantage = home_advantages.df.loc[team, "TotalHomeAdvantage"][0]
            opp_home_advantage = home_advantages.df.loc[
                opposition, "TotalHomeAdvantage"
            ][0]
            prev_matches = self.get_prev_matches(json_data, teams)

            predicted_scored, predicted_conceded = predictor._calc_score_prediction(
                team,
                avg_result,
                opp_avg_result,
                home_advantage,
                opp_home_advantage,
                True,
                form_rating,
                long_term_form_rating,
                opp_form_rating,
                opp_long_term_form_rating,
                prev_matches,
            )

            predicted_scored = int(round(predicted_scored))
            predicted_conceded = int(round(predicted_conceded))

            if (
                predicted_scored == actual_score["homeGoals"]
                and predicted_conceded == actual_score["awayGoals"]
            ):
                correct += 1
            if self.correct_result(
                predicted_scored,
                predicted_conceded,
                actual_score["homeGoals"],
                actual_score["awayGoals"],
            ):
                correct_result += 1
            loss += (
                abs(predicted_scored - actual_score["homeGoals"])
                + abs(predicted_conceded - actual_score["awayGoals"])
            ) ** 2

        accuracy = correct / len(actual_scores)
        results_accuracy = correct_result / len(actual_scores)
        loss = loss / len(actual_scores)

        return accuracy, results_accuracy, loss

    @staticmethod
    def get_actual_scores():
        database = Database()
        predictions = database.get_predictions()

        actual_scores = []
        for prediction in predictions:
            if prediction["actual"] is None:
                continue

            actual_score = (
                convert_team_name_or_initials(prediction["home"]),
                convert_team_name_or_initials(prediction["away"]),
                prediction["actual"],
            )
            actual_scores.append(actual_score)

        return actual_scores

    def brute_force(self, current_season: int):
        updater = Updater(current_season)
        updater.build_all(request_new=True, update_db=False)

        actual_scores = self.get_actual_scores()

        home_advantage_multiplier = 1
        best = (np.inf, -1, home_advantage_multiplier)
        for home_advantage_multiplier in np.linspace(0, 5, 20):
            for form_diff_multiplier in np.linspace(0, 5, 20):
                predictor = Predictor(home_advantage_multiplier, form_diff_multiplier)
                accuracy, results_accuracy, loss = self.prediction_performance(
                    predictor,
                    actual_scores,
                    updater.json_data,
                    updater.data.team_names,
                    updater.data.form,
                    updater.data.fixtures,
                    updater.data.home_advantages,
                )
                if loss < best[0]:
                    best = (loss, form_diff_multiplier, home_advantage_multiplier)
                    print("New best found:", best)

        print("FINAL BEST:", best)


if __name__ == "__main__":
    current_season = 2021
    o = OptimisePredictions()
    o.brute_force(current_season)

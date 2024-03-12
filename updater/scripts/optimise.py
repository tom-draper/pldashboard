import numpy as np
from database import Database
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
    def game_result_tuple(match: dict) -> tuple[str, str]:
        home_score = match["score"]["fullTime"]["homeTeam"]
        away_score = match["score"]["fullTime"]["awayTeam"]
        if home_score == away_score:
            return ("Drew", "Drew")
        elif home_score > away_score:
            return ("Won", "Lost")
        return ("Lost", "Won")

    def get_prev_matches(self, json_data: dict, team_names: list[str]):
        prev_matches: list[dict] = []
        for i in range(4):
            data = json_data["fixtures"][current_season - i]
            for match in data:
                if match["status"] != "FINISHED":
                    continue

                home_team = match["homeTeam"]["name"].replace("&", "and")  # type: str
                away_team = match["awayTeam"]["name"].replace("&", "and")  # type: str

                if home_team not in team_names or away_team not in team_names:
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
        team_names,
        form,
        fixtures,
        home_advantages,
    ):
        correct = 0
        correct_result = 0
        loss = 0
        # Check ALL teams as two teams can have different next games
        for team_name, opp_team_name, actual_score in actual_scores:
            form_rating = form.get_current_form_rating(team_name)
            long_term_form_rating = form.get_long_term_form_rating(team_name)
            opp_form_rating = form.get_current_form_rating(opp_team_name)
            opp_long_term_form_rating = form.get_long_term_form_rating(opp_team_name)
            avg_result = fixtures.get_avg_result(team_name)
            opp_avg_result = fixtures.get_avg_result(opp_team_name)
            home_advantage = home_advantages.df.loc[team_name, "TotalHomeAdvantage"][0]
            opp_home_advantage = home_advantages.df.loc[
                opp_team_name, "TotalHomeAdvantage"
            ][0]
            prev_matches = self.get_prev_matches(json_data, team_names)

            pred_scored, pred_conceded = predictor._calc_score_prediction(
                team_name,
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

            pred_scored = int(round(pred_scored))
            pred_conceded = int(round(pred_conceded))

            if (
                pred_scored == actual_score["homeGoals"]
                and pred_conceded == actual_score["awayGoals"]
            ):
                correct += 1
            if self.correct_result(
                pred_scored,
                pred_conceded,
                actual_score["homeGoals"],
                actual_score["awayGoals"],
            ):
                correct_result += 1
            loss += (
                abs(pred_scored - actual_score["homeGoals"])
                + abs(pred_conceded - actual_score["awayGoals"])
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
import matplotlib.pyplot as plt
import numpy as np
from src.fmt import extract_int_score_from_scoreline, identical_result
from src.database import Database


class PredictionsAnalysis:
    def __init__(self, current_season):
        self.current_season = current_season
        self.prediction_file = f"data/predictions_{current_season}.json"
        self.database = Database()

    def get_data(self):
        data = self.database.get_predictions()
        return data

    def by_form(self, actual_scoreline, home_form_rating, away_form_rating):
        act_home_goals, act_away_goals = extract_int_score_from_scoreline(
            actual_scoreline
        )
        # Compare whether comparison in goals scored by each team matches comparison in their form rating
        return identical_result(
            act_home_goals, act_away_goals, home_form_rating, away_form_rating
        )

    def if_predicted_by_form(self, predictions):
        total = 0
        count = 0
        for prediction in predictions.values():
            for pred in prediction:
                if pred["actual"] is None or pred["details"] is None:
                    continue
                if self.by_form(
                    pred["actual"],
                    pred["details"]["adjustments"][0]["homeFormRating"],
                    pred["details"]["adjustments"][0]["awayFormRating"],
                ):
                    count += 1
                total += 1
        return count / total

    def by_prev_matches(self, actual_scoreline, home_goals, away_goals):
        act_home_goals, act_away_goals = extract_int_score_from_scoreline(
            actual_scoreline
        )
        # Compare whether comparison in goals scored by each team matches comparison in the average of their previous matches
        return identical_result(act_home_goals, act_away_goals, home_goals, away_goals)

    def if_predicted_by_prev_matches(self, predictions):
        total = 0
        count = 0
        for prediction in predictions.values():
            for pred in prediction:
                if pred["actual"] is None or pred["details"] is None:
                    continue
                if (
                    pred["details"]["starting"]["description"]
                    == "Previous match average"
                ):
                    if self.by_prev_matches(
                        pred["actual"],
                        pred["details"]["starting"]["homeGoals"],
                        pred["details"]["starting"]["awayGoals"],
                    ):
                        count += 1
                    total += 1
        return count / total

    def by_home_team(self, actual):
        act_home_goals, act_away_goals = actual["homeGoals"], actual["awayGoals"]
        return act_home_goals > act_away_goals

    def by_away_team(self, actual):
        act_home_goals, act_away_goals = actual["homeGoals"], actual["awayGoals"]
        return act_home_goals < act_away_goals

    def by_draw(self, actual):
        act_home_goals, act_away_goals = actual["homeGoals"], actual["awayGoals"]
        return act_home_goals == act_away_goals

    def if_predicted_by(self, predictions, by_function):
        total = 0
        count = 0
        for prediction in predictions:
            if prediction["actual"] is None:
                continue
            if by_function(prediction["actual"]):
                count += 1
            total += 1
        return count / total

    def display_current_accuracy(self):
        print(self.database.get_accuracy())
        print()

    def display_if_predicted_by_prev_matches(self, predictions):
        print("If predicted result by previous_matches")
        print(
            "     Results accuracy:",
            round(self.if_predicted_by_prev_matches(predictions), 4),
        )

    def display_if_predicted_by_form(self, predictions):
        print("If predicted result by form")
        print(
            "     Results accuracy:", round(self.if_predicted_by_form(predictions), 4)
        )

    def display_if_predicted_by_home_team(self, predictions):
        print("If predicted results for home team")
        print(
            "     Results accuracy:",
            round(self.if_predicted_by(predictions, self.by_home_team), 4),
        )

    def display_if_predicted_by_away_team(self, predictions):
        print("If predicted results for away team")
        print(
            "     Results accuracy:",
            round(self.if_predicted_by(predictions, self.by_away_team), 4),
        )

    def display_if_predicted_by_draw(self, predictions):
        print("If predicted results to draw")
        print(
            "     Results accuracy:",
            round(self.if_predicted_by(predictions, self.by_draw), 4),
        )

    def possible_predictions(self):
        data = self.get_data()
        self.display_current_accuracy()
        # self.display_if_predicted_by_prev_matches(data['predictions'])
        # self.display_if_predicted_by_form(data['predictions'])
        self.display_if_predicted_by_home_team(data)
        self.display_if_predicted_by_away_team(data)
        self.display_if_predicted_by_draw(data)

    def analyse_predictions(self):
        predictions = self.get_data()

        # Home on x-axis, away on y-axis
        xs = []
        ys = []
        ds = []
        vs = []
        count = 0
        for pred in predictions:
            if pred["actual"] is None:
                continue
            ph = pred["prediction"]["homeGoals"]
            pa = pred["prediction"]["awayGoals"]
            ah = pred["actual"]["homeGoals"]
            aa = pred["actual"]["awayGoals"]

            # Two points
            x = (ph, ah)
            y = (pa, aa)
            xs.append(x)
            ys.append(y)
            vector = (ah - ph, aa - pa)
            vs.append(vector)
            distance = ((ph - ah) ** 2 + (pa - aa) ** 2) ** 0.5
            ds.append(distance)
            count += 1
        print("n =", count)
        print("Mean distance", np.mean(ds))
        print("S.d. distance", np.std(ds))
        print("Median distance", np.median(ds))
        rv = np.mean([v[0] for v in vs]), np.mean([v[1] for v in vs])
        print("Resulting vector:", rv)

        _, ax = plt.subplots()
        for x, y in zip(xs, ys):
            ax.plot(x, y, "gray", linestyle="--")
            # ax.scatter(x[0], y[0], c='r', s=20, marker='x')
            ax.scatter(x[1], y[1], c="g", s=25, marker="x")  # Display actual score
            ax.plot((0, rv[0]), (0, rv[1]), "blue", linestyle="solid")
            ax.scatter(rv[0], rv[1], c="b", marker="x", s=25)

        plt.show()


if __name__ == "__main__":
    current_season = 2023
    pa = PredictionsAnalysis(current_season)
    pa.possible_predictions()
    pa.analyse_predictions()

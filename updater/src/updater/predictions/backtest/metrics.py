"""Scoring: how a set of forecasts is turned into comparable numbers.

Nothing here knows how a model is fitted or how a season is replayed. It takes
probability triples and the outcomes that actually happened, and produces the
figures the leaderboard is built from.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import log
from typing import Optional

import numpy as np


def ranked_probability_score(probs: tuple[float, float, float], actual: int) -> float:
    """RPS for the ordered [home, draw, away] outcome."""
    cumulative_pred = 0.0
    cumulative_obs = 0.0
    total = 0.0
    for i in range(2):  # r - 1 terms, r = 3 outcomes
        cumulative_pred += probs[i]
        cumulative_obs += 1.0 if actual == i else 0.0
        total += (cumulative_pred - cumulative_obs) ** 2
    return total / 2.0


@dataclass
class Metrics:
    """Running totals for one model, finalised by `summary()`."""

    label: str
    # "scoreline", "outcome", or "-" for the baseline. Worth carrying because
    # the leaderboard is now a comparison *between* families, not just models.
    family: str = "-"
    n: int = 0
    rps_total: float = 0.0
    log_loss_total: float = 0.0
    correct_outcomes: int = 0
    correct_scores: int = 0
    # Matches where an exact-score guess was even possible. The direct outcome
    # models never predict a scoreline, so for them this stays 0 and the exact
    # column reads n/a rather than a 0.000 that looks like a failed prediction.
    scored_exact: int = 0
    # (predicted probability, hit) pairs across all three outcomes, for ECE.
    calibration: list[tuple[float, bool]] = field(default_factory=list)
    # Per-match RPS, kept so models can be compared *paired* on identical
    # fixtures. Two engines can differ by less than either one's own spread and
    # still be reliably ordered, so the unpaired spread would hide a real edge,
    # and an unpaired tie would hide a real one.
    per_match_rps: list[float] = field(default_factory=list)
    # The forecasts themselves, kept so two models can be compared fixture by
    # fixture. Averages hide disagreement: two engines can tie on RPS while
    # picking different winners, their errors cancelling in the mean.
    per_match_probs: list[tuple[float, float, float]] = field(default_factory=list)
    per_match_actual: list[int] = field(default_factory=list)

    def add(
        self,
        probs: tuple[float, float, float],
        actual: int,
        exact_hit: Optional[bool] = None,
    ) -> None:
        self.n += 1
        rps = ranked_probability_score(probs, actual)
        self.per_match_rps.append(rps)
        self.per_match_probs.append((probs[0], probs[1], probs[2]))
        self.per_match_actual.append(actual)
        self.rps_total += rps
        self.log_loss_total += -_safe_log(probs[actual])
        self.correct_outcomes += 1 if _argmax(probs) == actual else 0
        if exact_hit is not None:
            self.scored_exact += 1
            if exact_hit:
                self.correct_scores += 1
        for i, p in enumerate(probs):
            self.calibration.append((p, i == actual))

    @property
    def rps(self) -> float:
        return self.rps_total / self.n if self.n else float("nan")

    @property
    def log_loss(self) -> float:
        return self.log_loss_total / self.n if self.n else float("nan")

    @property
    def outcome_accuracy(self) -> float:
        return self.correct_outcomes / self.n if self.n else float("nan")

    @property
    def exact_score_accuracy(self) -> float:
        """NaN when the model never produced a scoreline to be judged on."""
        return (
            self.correct_scores / self.scored_exact
            if self.scored_exact
            else float("nan")
        )

    @property
    def calibration_error(self) -> float:
        """Expected calibration error over 10 equal-width probability bins."""
        if not self.calibration:
            return float("nan")
        bins: list[list[tuple[float, bool]]] = [[] for _ in range(10)]
        for prob, hit in self.calibration:
            bins[min(int(prob * 10), 9)].append((prob, hit))
        total = len(self.calibration)
        error = 0.0
        for bucket in bins:
            if not bucket:
                continue
            mean_prob = sum(p for p, _ in bucket) / len(bucket)
            observed = sum(1 for _, hit in bucket if hit) / len(bucket)
            error += (len(bucket) / total) * abs(mean_prob - observed)
        return error


@dataclass
class PairedComparison:
    """A model's RPS gap to the leader, measured on the same fixtures."""

    mean_difference: float
    standard_error: float

    @property
    def t_statistic(self) -> float:
        if self.standard_error == 0:
            return 0.0
        return self.mean_difference / self.standard_error

    def __str__(self) -> str:
        if self.standard_error == 0:
            return "-"
        # +/- 2 standard errors is the usual 95% interval; anything inside it is
        # a gap this sample cannot distinguish from zero.
        marker = "*" if abs(self.t_statistic) > 2 else " "
        return f"{self.mean_difference:+.4f}+/-{2 * self.standard_error:.4f}{marker}"


def paired_rps_difference(model: Metrics, reference: Metrics) -> PairedComparison:
    """Mean per-match RPS difference (model - reference) and its standard error.

    Both models saw identical fixtures in identical order, so differencing
    match-by-match cancels the fixture difficulty that dominates the raw spread.
    """
    if model is reference or len(model.per_match_rps) != len(reference.per_match_rps):
        return PairedComparison(0.0, 0.0)

    differences = np.array(model.per_match_rps) - np.array(reference.per_match_rps)
    if differences.size < 2:
        return PairedComparison(0.0, 0.0)
    return PairedComparison(
        mean_difference=float(differences.mean()),
        standard_error=float(differences.std(ddof=1) / np.sqrt(differences.size)),
    )


@dataclass
class Disagreement:
    """How far apart two models are fixture by fixture, and who wins where.

    A leaderboard cannot answer this. Two engines that tie on mean RPS may be
    making the same forecast every week, or wildly different ones that happen to
    be wrong equally often. Only the first case means the second engine is
    redundant, and telling them apart decides whether keeping both families is
    worth anything.
    """

    first: str
    second: str
    n: int
    # Fixtures where the two name a different most likely result.
    differing_picks: int
    mean_total_variation: float
    max_total_variation: float
    # Mean RPS restricted to the fixtures where the picks differ. If the two
    # carry different information, one should be clearly better on exactly
    # these, which is where a blend would earn its keep.
    first_rps_when_differing: float
    second_rps_when_differing: float

    @property
    def differing_share(self) -> float:
        return self.differing_picks / self.n if self.n else float("nan")

    def __str__(self) -> str:
        if self.n == 0:
            return f"{self.first} vs {self.second}: nothing scored in common"
        return "\n".join(
            [
                f"{self.first} vs {self.second} over {self.n} fixtures",
                f"  different pick     {self.differing_picks} "
                f"({self.differing_share:.1%} of fixtures)",
                f"  mean separation    {self.mean_total_variation:.4f} "
                f"(total variation, max {self.max_total_variation:.4f})",
                f"  RPS where they differ: {self.first} {self.first_rps_when_differing:.4f}, "
                f"{self.second} {self.second_rps_when_differing:.4f}",
            ]
        )


def disagreement(first: Metrics, second: Metrics) -> Disagreement:
    """Compare two models' stored per-fixture forecasts.

    Both must have been scored in the same `backtest` call, so their stored
    forecasts line up fixture for fixture. Total variation distance is used for
    separation: half the L1 gap between the two probability triples, which is 0
    for identical forecasts and 1 for forecasts with nothing in common.
    """
    if len(first.per_match_probs) != len(second.per_match_probs):
        raise ValueError(
            "Models were scored on different fixtures and cannot be compared"
        )

    if not first.per_match_probs:
        return Disagreement(first.label, second.label, 0, 0, float("nan"), float("nan"), float("nan"), float("nan"))

    a = np.array(first.per_match_probs)
    b = np.array(second.per_match_probs)

    total_variation = 0.5 * np.abs(a - b).sum(axis=1)
    differing = a.argmax(axis=1) != b.argmax(axis=1)

    first_rps = np.array(first.per_match_rps)
    second_rps = np.array(second.per_match_rps)

    return Disagreement(
        first=first.label,
        second=second.label,
        n=len(a),
        differing_picks=int(differing.sum()),
        mean_total_variation=float(total_variation.mean()),
        max_total_variation=float(total_variation.max()),
        first_rps_when_differing=(
            float(first_rps[differing].mean()) if differing.any() else float("nan")
        ),
        second_rps_when_differing=(
            float(second_rps[differing].mean()) if differing.any() else float("nan")
        ),
    )


def _argmax(values: tuple[float, ...]) -> int:
    return max(range(len(values)), key=lambda i: values[i])


def _safe_log(p: float) -> float:

    return log(max(p, 1e-12))

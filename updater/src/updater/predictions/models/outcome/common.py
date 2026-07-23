"""The ordered-link machinery shared by the direct outcome models.

Football results are *ordered*: away win < draw < home win sit on a single axis
of how well the home side did. The standard way to model that (Koning 2000, and
Hvattum & Arntzen 2010 for the rating-driven version) is a latent variable

    y* = eta + noise

where `eta` is how much the home side is expected to outplay the away side, and
two cutpoints c1 < c2 carve the line into the three results:

    away win   y* < c1          P = F(c1 - eta)
    draw       c1 < y* < c2     P = F(c2 - eta) - F(c1 - eta)
    home win   y* > c2          P = 1 - F(c2 - eta)

Two things about this are worth spelling out, because they are the reasons these
models can beat a goal model at its own scoring metric.

**The draw band is estimated, not implied.** Its width (c2 - c1) is a free
parameter fit against observed draw frequency. A Poisson goal model has no such
knob: its draw probability is whatever summing the matrix diagonal happens to
give, which is famously too low, and the Dixon-Coles rho is a patch on exactly
that. Here the deficiency cannot arise.

**Home advantage lives in the cutpoints.** Adding a constant to eta and the same
constant to both cutpoints leaves every probability unchanged, so a separate
home-advantage term would be exactly unidentified. Rather than pin it with an
arbitrary constraint, eta is defined as a pure strength difference and the
cutpoints are left free to sit asymmetrically about zero. Their midpoint *is* the
home advantage, in latent units, and `home_advantage` reports it.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Optional

import numpy as np

# The two link functions, i.e. the assumed distribution of the latent noise.
# Logistic has slightly heavier tails than the normal; in practice the choice
# moves results far less than people expect, which is why both are entrants.
LINKS: dict[str, Callable[[np.ndarray], np.ndarray]] = {}


def _logistic_cdf(x: np.ndarray) -> np.ndarray:
    from scipy.special import expit

    return expit(x)


def _normal_cdf(x: np.ndarray) -> np.ndarray:
    from scipy.stats import norm

    return norm.cdf(x)


LINKS["logit"] = _logistic_cdf
LINKS["probit"] = _normal_cdf

# Probabilities are clipped away from 0 before any log is taken. A cutpoint pair
# far from the data can otherwise return a hard 0 for the outcome that actually
# happened, making the likelihood infinite and stalling the optimiser.
MIN_PROB = 1e-9


def link_function(name: str) -> Callable[[np.ndarray], np.ndarray]:
    try:
        return LINKS[name]
    except KeyError:
        raise ValueError(
            f"Unknown link {name!r}. Available: {', '.join(LINKS)}"
        ) from None


@dataclass
class OrderedCutpoints:
    """The fitted (c1, c2) pair and the link they are measured against."""

    lower: float
    upper: float
    link: str = "logit"

    @property
    def draw_width(self) -> float:
        """How wide the draw band is: the model's appetite for predicting draws."""
        return self.upper - self.lower

    @property
    def home_advantage(self) -> float:
        """Cutpoint midpoint, negated: latent-scale edge given to the home side.

        A neutral-venue league would fit cutpoints symmetric about 0. Real ones
        sit shifted, and the size of that shift is the home advantage.
        """
        return -(self.lower + self.upper) / 2.0

    def probabilities(self, eta: float | np.ndarray) -> np.ndarray:
        """[home, draw, away] probabilities for one eta or an array of them."""
        return ordered_probabilities(eta, self.lower, self.upper, self.link)


def ordered_probabilities(
    eta: float | np.ndarray, lower: float, upper: float, link: str = "logit"
) -> np.ndarray:
    """Ordered-link probabilities, shaped (..., 3) as [home, draw, away]."""
    cdf = link_function(link)
    eta_array = np.atleast_1d(np.asarray(eta, dtype=float))

    below_lower = cdf(lower - eta_array)
    below_upper = cdf(upper - eta_array)

    probs = np.stack(
        [1.0 - below_upper, below_upper - below_lower, below_lower], axis=-1
    )
    probs = np.clip(probs, MIN_PROB, None)
    probs = probs / probs.sum(axis=-1, keepdims=True)

    return probs[0] if np.isscalar(eta) or np.ndim(eta) == 0 else probs


def negative_log_likelihood(
    eta: np.ndarray,
    outcomes: np.ndarray,
    weights: np.ndarray,
    lower: float,
    upper: float,
    link: str,
) -> float:
    """Weighted negative log likelihood of the observed outcomes."""
    probs = ordered_probabilities(eta, lower, upper, link)
    chosen = probs[np.arange(len(outcomes)), outcomes]
    return float(-np.sum(weights * np.log(chosen)))


def unpack_cutpoints(lower_raw: float, gap_raw: float) -> tuple[float, float]:
    """Turn unconstrained parameters into an ordered pair c1 < c2.

    The optimiser works on (c1, log gap) so that c2 = c1 + exp(log gap) is
    ordered by construction. Fitting c1 and c2 as free parameters would let the
    optimiser wander into c2 < c1, where the draw probability goes negative.
    """
    return lower_raw, lower_raw + float(np.exp(gap_raw))


# A draw band of exp(-0.5) ~ 0.6 latent units is roughly the observed draw rate
# under a logit link, so the optimiser starts near the answer rather than at a
# degenerate never-predict-a-draw corner.
INITIAL_LOG_GAP = -0.5
INITIAL_LOWER = -0.6


def default_strength(
    strength: dict[str, float], teams: Sequence[str], count: int = 3
) -> float:
    """Rating for a team never seen in the window, i.e. a promoted side.

    Matches the convention in the scoreline models: the mean of the weakest few,
    so a newly promoted team is treated as a bad Premier League team rather than
    an average one.
    """
    if not teams:
        return 0.0
    weakest = sorted(teams, key=lambda t: strength[t])[: min(count, len(teams))]
    return float(np.mean([strength[t] for t in weakest]))


def fit_scalar_ordered(
    covariate: np.ndarray,
    outcomes: np.ndarray,
    weights: np.ndarray,
    link: str = "logit",
    max_iter: int = 200,
) -> Optional[tuple[float, OrderedCutpoints]]:
    """Fit `eta = slope * covariate` plus cutpoints, for a one-covariate model.

    This is the ordered link applied on top of a rating system that has already
    run: the covariate is a pre-match rating difference, and all that is left to
    learn is the scale that turns it into latent units, plus where the draw band
    sits. Three parameters total, so it fits in milliseconds and is very hard to
    overfit.
    """
    from scipy.optimize import minimize

    if covariate.size == 0:
        return None
    spread = float(np.std(covariate))
    if spread == 0:
        # No signal in the covariate: fall back to a slope of 0, which makes
        # every fixture the league's base rate. Still a valid (if useless) model.
        slope_initial = 0.0
    else:
        slope_initial = 1.0 / spread

    def objective(params: np.ndarray) -> float:
        slope, lower_raw, gap_raw = params
        lower, upper = unpack_cutpoints(lower_raw, gap_raw)
        return negative_log_likelihood(
            slope * covariate, outcomes, weights, lower, upper, link
        )

    result = minimize(
        objective,
        np.array([slope_initial, INITIAL_LOWER, INITIAL_LOG_GAP]),
        method="L-BFGS-B",
        bounds=[(None, None), (None, None), (-6.0, 3.0)],
        options={"maxiter": max_iter},
    )

    slope, lower_raw, gap_raw = result.x
    lower, upper = unpack_cutpoints(float(lower_raw), float(gap_raw))
    return float(slope), OrderedCutpoints(lower=lower, upper=upper, link=link)

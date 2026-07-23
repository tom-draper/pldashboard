"""Engines that forecast home / draw / away directly, with no scoreline.

These exist to answer a question the scoreline family cannot ask of itself. A
Dixon-Coles fixture prediction is fully determined by (lambda_home, lambda_away,
rho): three numbers generating all ~121 matrix cells, with the outcome triple
pinned to a two-dimensional surface inside the probability simplex. There are
perfectly plausible outcome triples that no pair of Poisson rates can produce,
draw-heavy fixtures most of all, which is the very deficiency rho was invented to
patch.

The models here drop the goal model entirely and fit the three probabilities
against the outcome likelihood, which is also the loss the backtest scores. That
buys freedom and a matched objective, and costs all the goal-level information
(over/under, correct score, the heatmap the dashboard draws). Neither family
dominates on principle, so the point is to measure the difference.

They are benchmarking entrants only. The updater builds scoreline models, since
it needs the matrix, and `model_predictions` cannot use anything from this package.
"""

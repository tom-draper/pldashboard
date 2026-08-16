# Prediction Model Benchmarks

Recorded results from `updater.predictions.backtest`, so the numbers survive the
session that produced them. Update this file whenever a new engine is added or
the harness changes in a way that moves the scores.

## How to reproduce

```bash
uv run python -m updater.predictions.backtest --seasons 2023,2024,2025
uv run python -m updater.predictions.backtest --list-models
uv run python -m updater.predictions.backtest --family outcome
uv run python -m updater.predictions.backtest --models dixon-coles --sweep
```

A full 20-model run over three seasons takes upwards of an hour. Two things make
that materially faster:

```bash
# The fits are small (tens of parameters), so BLAS threading is pure overhead.
# Pinning to one thread roughly halves the runtime.
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
  uv run python -m updater.predictions.backtest --seasons 2023,2024,2025 --progress
```

`--progress` reports weeks completed on stderr, leaving the table clean on stdout.

Note that RPS gaps between models are only comparable *within* a single run: the
`vs best` column is a paired comparison on identical fixtures, and every run
shares one baseline. Do not compare a number here against a number from a run
with a different model set.

The harness replays each season a matchday at a time, refitting every model once
per ISO week on a rolling ~3.5-season window of matches that finished *before*
that week began. No model ever sees a result it is predicting.

## The two families

Engines are split by what they actually forecast, and the `family` column in the
table says which is which.

**scoreline** models predict a full home-goals x away-goals matrix; their
home/draw/away probabilities are read off it. They can fill the dashboard's
heatmap, so these are the only ones eligible for production.

**outcome** models predict home/draw/away directly and never name a scoreline.
They exist because a goal model's outcome probabilities are *constrained*: given
(lambda_home, lambda_away, rho), three numbers generate all ~121 matrix cells and
the outcome triple is pinned to a two-dimensional surface inside the simplex.
There are plausible outcome triples no pair of Poisson rates can produce,
draw-heavy fixtures especially, which is the very deficiency the Dixon-Coles rho
was invented to patch. The outcome models have no such constraint: their draw
band is a fitted parameter. They also optimise the outcome likelihood, which is
the loss the backtest scores, rather than the scoreline likelihood.

The trade is that they learn nothing from the margin of victory (a 4-0 and a 1-0
are both just a home win) and produce no goal-level output at all. Both families
are scored on identical fixtures with identical RPS, so the comparison is fair.

## Metrics

| metric | meaning |
| --- | --- |
| RPS | ranked probability score over the ordered home/draw/away outcome. **The metric to select on.** Lower is better. |
| family | `scoreline` (predicts a goal matrix) or `outcome` (predicts home/draw/away directly). |
| vs best | paired RPS gap to the leader, +/- a 95% interval, measured match-by-match. A `*` marks a gap the sample can actually resolve. |
| logloss | negative log probability of the actual outcome. Lower is better. |
| ECE | expected calibration error. Lower is better, but never read it alone: see the baseline caveat below. |
| outcome | share of matches whose most likely outcome was right. |
| exact | share whose most likely scoreline was exactly right. `n/a` for the outcome family, which never names one. |

`--compare A,B` adds a per-fixture comparison of two engines after the table: how
often they pick a different result, how far apart their probabilities are, and
which is right where they differ. Mean RPS cannot answer that, since two engines
can tie while disagreeing constantly, their errors cancelling in the average.

Two traps worth remembering:

* **Exact-score accuracy is a poor selection metric.** The true scoreline
  distribution is genuinely flat (1-0, 2-1, 1-1 and 0-0 sit close together), so
  even a perfect model rarely tops ~13%. A model can raise this number by
  shifting its modal scoreline while getting *worse* at the actual forecast.
* **The baseline's ECE of 0.0000 is an artifact.** It quotes the season's own
  outcome frequencies, which are perfectly calibrated by construction and carry
  no information about any individual match. Calibration only means something
  next to a sharpness metric like RPS.

## Results: seasons 2023-2025 (2026-07-22)

All 20 engines, both families, 1140 matches, half-life 365 days.

| model | family | RPS | vs best | logloss | ECE | outcome | exact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dixon-coles | scoreline | 0.2005 | - | 0.9838 | 0.0177 | **0.532** | 0.114 |
| negative-binomial | scoreline | 0.2005 | +0.0001 +/-0.0001 | 0.9844 | 0.0159 | 0.532 | 0.114 |
| poisson | scoreline | 0.2005 | +0.0001 +/-0.0001 | 0.9843 | 0.0158 | 0.532 | 0.114 |
| bivariate-poisson | scoreline | 0.2005 | +0.0001 +/-0.0001 | 0.9843 | 0.0162 | 0.532 | 0.114 |
| ensemble | scoreline | 0.2005 | +0.0001 +/-0.0009 | **0.9806** | 0.0140 | 0.525 | 0.116 |
| dynamic | scoreline | 0.2006 | +0.0002 +/-0.0017 | 0.9812 | 0.0189 | 0.520 | 0.120 |
| outcome-blend | outcome | 0.2007 | +0.0003 +/-0.0016 | 0.9844 | 0.0194 | 0.524 | n/a |
| stacked | scoreline | 0.2011 | +0.0007 +/-0.0012 | 0.9835 | **0.0105** | 0.526 | 0.118 |
| extended-dc | scoreline | 0.2013 | +0.0008 +/-0.0018 | 0.9866 | 0.0178 | 0.518 | 0.106 |
| elo | scoreline | 0.2015 | +0.0011 +/-0.0028 | 0.9833 | 0.0256 | 0.520 | 0.118 |
| ordered-logit | outcome | 0.2016 | +0.0011 +/-0.0025 | 0.9863 | 0.0236 | 0.524 | n/a |
| ordered-probit | outcome | 0.2017 | +0.0012 +/-0.0025 | 0.9888 | 0.0243 | 0.524 | n/a |
| direct-elo | outcome | 0.2018 | +0.0014 +/-0.0028 | 0.9856 | 0.0232 | 0.519 | n/a |
| pi-ratings | scoreline | 0.2020 | +0.0016 +/-0.0025 | 0.9856 | 0.0157 | 0.516 | 0.124 |
| skellam | scoreline | 0.2021 | +0.0017 +/-0.0015 * | 0.9977 | 0.0162 | 0.523 | 0.107 |
| direct-pi-ratings | outcome | 0.2024 | +0.0020 +/-0.0026 | 0.9876 | 0.0243 | 0.527 | n/a |
| goal-average | scoreline | 0.2033 | +0.0029 +/-0.0031 | 0.9958 | 0.0205 | 0.527 | 0.102 |
| hierarchical | scoreline | 0.2041 | +0.0036 +/-0.0031 * | 0.9917 | 0.0148 | 0.523 | 0.118 |
| multinomial | outcome | 0.2051 | +0.0047 +/-0.0038 * | 1.0110 | 0.0235 | 0.507 | n/a |
| baseline (base rate) | - | 0.2321 | +0.0317 +/-0.0079 * | 1.0723 | 0.0000 | 0.432 | n/a |
| empirical-scoreline | scoreline | 0.2326 | +0.0321 +/-0.0079 * | 1.0740 | 0.0102 | 0.432 | 0.109 |

The scoreline rows reproduce the earlier 14-model run digit for digit, which is
the regression check on the two-family refactor: splitting the package and moving
Dixon-Coles out of `predict_v3` changed no behaviour.

### Reading of these results

**Every rated engine beats the base rate decisively, and not one of them beats
Dixon-Coles.** Fourteen models spanning maximum likelihood, online ratings,
Kalman filtering, stacking and plain arithmetic land inside a 0.004 RPS band. The
only gaps that clear their intervals are in the *wrong* direction. The choice of
model is not what limits accuracy here.

The naive floors did their job:

* **empirical-scoreline** (team-blind, always quotes the league's usual
  scoreline) is the worst entrant on RPS, below even the base rate. So the rated
  models are unambiguously doing real work. But it scores 0.109 exact against
  Dixon-Coles' 0.114, which is close enough to confirm that exact-score accuracy
  barely distinguishes a real model from no model at all. On season 2025 alone it
  actually *won* that metric (0.124 vs 0.116); that reversal was noise on 380
  matches, and is a good illustration of why single-season exact accuracy should
  not be quoted.
* **goal-average** (attack/defence as plain ratios, no optimiser, no likelihood)
  finishes +0.0029 +/-0.0031 behind Dixon-Coles, which does *not* clear the
  interval. All the maximum-likelihood machinery is worth an amount of accuracy
  this sample cannot reliably measure.

Why each alternative failed to move the needle:

* **negative-binomial** fits its dispersion parameter to the upper bound (size
  500, i.e. Poisson). Raw goal counts do look overdispersed (mean 1.48, variance
  1.56), but once team ratings absorb the strength differences, the residual
  variance is Poisson. There is no overdispersion left for it to model.
* **bivariate-poisson** drives its shared component to ~0.006, effectively zero.
  The construction can only express *positive* correlation between the two
  scores, and football's dependence is mildly negative. It cannot represent the
  effect it was added to capture, so it degenerates to independent Poisson.
* **poisson** (Dixon-Coles with rho pinned at 0) confirms the above from the
  other direction. Dixon-Coles fits rho to about -0.088, comfortably off its
  bounds, so the low-score correction *is* estimating something real, and it is
  consistently but microscopically better: +0.0001 RPS, roughly 0.05% relative.
  Worth keeping, not worth celebrating.
* **skellam** is significantly worse. Fitting only the goal difference discards
  the total-goals information, and that costs more than the robustness gains.
* **hierarchical** is significantly worse, which is the most useful negative
  result here. Empirical-Bayes shrinkage pulls the rating spread from sd 0.285 to
  0.149 and destroys real signal doing it. The hand-set `regularisation=1e-3`
  beats the principled estimate, because empirical Bayes maximises fit to past
  data, which is not the same thing as predicting future matches. Do not "fix"
  the arbitrary penalty without re-running this.
* **extended-dc** adds rest days and per-team home advantage and comes out
  slightly (not significantly) worse, with the worst log-loss of the competitive
  group. The fitted rest coefficient is *negative* (about -0.13 per extra week),
  i.e. teams score less after long breaks, consistent with rustiness after
  international windows rather than with a fatigue story. Per-team home advantage
  spreads widely (Newcastle +0.48, Ipswich -0.34 around a shared 0.139) but does
  not pay off out of sample. **Rest days were the only genuinely unused
  information in the fixture list, and they are worth nothing measurable.**
* **stacked** learned its weights on a chronological holdout and put 82% on
  pi-ratings, 18% on Dixon-Coles, 0% on Skellam, despite pi-ratings ranking near
  the bottom over three seasons. That is an overfit holdout, and it still lands
  mid-table. It does, however, post the best calibration in the table (ECE
  0.0105), so the weighting helps the probabilities even where it hurts the
  ranking.

### The outcome family: does forecasting the result directly help?

The direct home/draw/away engines were added to test a specific theoretical
complaint about goal models, set out under "The two families" above: their
outcome probabilities are constrained to a surface a Poisson pair can reach, and
their draw rate is implied rather than fitted. The answer is that **the
constraint is real but not binding.**

**No outcome model beats Dixon-Coles**, and the best of them (`outcome-blend`,
7th at +0.0003) is comfortably inside its interval. The scoreline family takes
the top six places. But apart from `multinomial`, none of the outcome models is
significantly *worse* either, so the two families are, on this evidence,
interchangeable in accuracy while only one of them produces a scoreline.

* **The round trip through goals costs nothing.** This is the cleanest test in
  the table, because `direct-elo` and `elo` share the same rating sweep and
  differ only in what is done with the pre-match rating gap: an ordered link
  fitted to outcomes, versus a least-squares line to goal difference, a
  supremacy split around the league average, a Poisson pair and a matrix summed
  back down. Elo 0.2015, direct-elo 0.2018. Pi-ratings 0.2020, direct-pi-ratings
  0.2024. Both differences are well inside their intervals. The conversion
  `models.scoreline.elo` apologises for in its docstring is harmless, so **the
  goal models' scoreline output is free**, which matters because the dashboard
  needs it.
* **`ordered-logit` ties `dixon-coles`** (+0.0011 +/-0.0025). Fitting the
  outcome likelihood directly, and fitting the draw band as a free parameter
  rather than inheriting whatever the matrix diagonal gives, wins nothing
  measurable. The Dixon-Coles rho evidently patches the Poisson draw deficiency
  well enough that removing the constraint entirely adds no value.
* **`ordered-probit` tracks `ordered-logit` to 0.0001**, as expected. The choice
  of latent noise distribution is irrelevant at this sample size.
* **`multinomial` is the one significant loser** (+0.0047 +/-0.0038, clearing
  its interval), and it is a useful negative result: it is the only entrant that
  drops the ordinality assumption, letting each result carry its own coefficient
  vector. Doing so costs real accuracy, and it posts the worst log-loss and
  outcome accuracy of any rated model. **Football results are one-dimensional**;
  the extra freedom is spent on noise. Its L2 penalty is already an order of
  magnitude heavier than the ordered models' for the same reason, and loosening
  it makes matters worse, not better.
* **`outcome-blend` lands between its members rather than beating both.** It
  pools Dixon-Coles with ordered-logit on a chronological holdout. If the two
  families carried complementary information the blend would beat each of them,
  which is what `ensemble` manages within the scoreline family. It does not.

**Do the families disagree per match?** Yes, and the leaderboard hides it.
Dixon-Coles and ordered-logit name a different most likely result on **7.6% of
fixtures** (87 of 1140) while sitting 0.0011 apart on RPS, a gap that does not
clear its interval. So they are emphatically not the same model twice, and mean
RPS alone could never tell you that.

But the disagreement is *unprofitable*. Mean total variation between the two
forecasts is 0.054 (max 0.384), and on the fixtures where they differ **both
score far worse than their own average**: 0.2344 and 0.2420, against ~0.201
overall. They disagree about the near-coin-flips, not about matches one of them
understands and the other does not. Dixon-Coles is nominally ahead on those 87,
but on that sample the gap is noise.

This is the single most useful finding here, because it explains the blend.
`outcome-blend` cannot beat its members since their disagreement is concentrated
exactly where neither has information. Keeping both families in production would
buy nothing. Reproduce with::

    python -m updater.predictions.backtest --seasons 2023,2024,2025 \
      --compare dixon-coles,ordered-logit

Measured on season 2025 alone the same pair differs on 8.7% of fixtures with
mean separation 0.053, so the effect is stable across samples.

One caution on reading single seasons: over 2025 alone the outcome models led
the outcome-accuracy column (`multinomial` 0.516 against Dixon-Coles' 0.474),
which looked like evidence that fitting the outcome likelihood sharpens the
argmax. Over three seasons that reverses completely, Dixon-Coles taking the
column at 0.532 and `multinomial` finishing last of the rated models at 0.507.
It was noise on 380 matches, and a good reminder that this column swings hard.

Two results are worth taking seriously despite tying on RPS:

* **ensemble** matches Dixon-Coles on RPS while taking the best log-loss (0.9806
  vs 0.9838) and better calibration (0.0140 vs 0.0177). Averaging genuinely
  recovers something, which proves the members' errors are partly independent.
* **dynamic** (random-walk ratings, extended Kalman filter) essentially ties on
  RPS with better log-loss, at a fraction of the fitting cost since it is a
  single linear pass rather than a numerical optimisation per refit.

### Where the remaining headroom is

Twenty engines converge because they are fed the same information: past goals,
dates, and venue. Rest days were tested and add nothing. Changing the forecast
target from scorelines to results, which was the strongest structural idea left,
also adds nothing. Squeezing more out of this input set is not promising.
Candidates that add information rather than structure:

* **Bookmaker closing odds**, de-vigged, as a benchmark entrant. This is now the
  highest-value next step by some distance: it would establish how much headroom
  exists above 0.2005 RPS at all. Every result above is consistent with 0.2005
  being close to the ceiling for goals-only data, but without a market reference
  that cannot be distinguished from a shared blind spot. The outcome family
  makes this more pressing, not less: odds are quoted as 1X2, so they slot into
  `models.outcome` directly, with no goal model to invent.
* **Expected goals.** `fit_dixon_coles` already takes `xg_weight`, but the
  fixture backups carry no per-match xG, so it remains untested.
* **Team availability**: injuries, suspensions, European fixtures. Information no
  goals-only model can access.

## Half-life sweep: season 2025 (2026-07-22)

Dixon-Coles only, before the multi-model harness existed.

| half-life | RPS | logloss | outcome | exact |
| --- | --- | --- | --- | --- |
| baseline | 0.2273 | 1.0793 | 0.426 | 0.000 |
| 90d | 0.2140 | 1.0656 | 0.463 | 0.105 |
| 180d | 0.2112 | 1.0491 | 0.455 | 0.108 |
| 365d | 0.2103 | 1.0440 | 0.474 | 0.116 |
| 730d | 0.2106 | 1.0441 | 0.466 | 0.118 |

365 days is the chosen default, though 180 and 730 are close enough that the
curve is flat rather than peaked.

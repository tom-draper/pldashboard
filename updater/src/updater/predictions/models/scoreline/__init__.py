"""Engines that forecast a full scoreline distribution.

Each module here fits ratings some way or another and turns a fixture into a
home-goals x away-goals matrix (`ScorePrediction`). Their home/draw/away
probabilities are a *consequence* of that matrix rather than something they
optimise, which is the distinction from `predictions.models.outcome`.

Modules are imported lazily by the registry factories in the parent package, so
nothing here is pulled in just by importing `predictions.models`.
"""

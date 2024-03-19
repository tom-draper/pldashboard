import type { Scoreline } from "$lib/types";

export type PredictionsData = {
	accuracy: Accuracy;
	predictions: MatchdayPredictions[];
};

export type Prediction = {
	_id: string; // HOME_INITIALS vs AWAY_INITIALS
	home: string;
	away: string;
	prediction: Scoreline;
	actual: null | Scoreline;
	datetime: string;
	color?: string;
};

export type Accuracy = {
	scoreAccuracy: number;
	resultAccuracy: number;
};

export type MatchdayPredictions = {
	_id: string; // YYYY-MM-DD
	predictions: Prediction[];
};

export type Predictions = {
	_id: Date;
	predictions: Prediction[];
};

export type ActualClass = {
	homeGoals: number;
	awayGoals: number;
};

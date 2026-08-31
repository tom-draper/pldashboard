import type { Score } from '$lib/types';

export type PredictionsData = {
	accuracy: Accuracy;
	predictions: MatchdayPredictions[];
};

export type Prediction = {
	_id: string; // HOME_INITIALS vs AWAY_INITIALS
	home: string;
	away: string;
	prediction: Score;
	actual: null | Score;
	datetime: string;
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
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

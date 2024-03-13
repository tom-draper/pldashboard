type PredictionsData = {
	accuracy: Accuracy;
	predictions: MatchdayPredictions[];
};

type Prediction = {
	_id: string; // HOME_INITIALS vs AWAY_INITIALS
	home: string;
	away: string;
	prediction: Scoreline;
	actual: null | Scoreline;
	datetime: string;
	color?: string;
};

type Accuracy = {
	scoreAccuracy: number;
	resultAccuracy: number;
};

type MatchdayPredictions = {
	_id: string; // YYYY-MM-DD
	predictions: Prediction[];
};

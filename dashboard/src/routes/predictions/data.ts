import { identicalScore, sameResult } from '$lib/goals';
import type { MatchdayPredictions, Prediction, PredictionsData } from './predictions.types';

/**
 * Insert green, yellow or red color values representing the results of completed
 * games as well as overall prediction accuracy values for scores and general
 * match results.
 */
export function insertExtras(json: PredictionsData) {
	let scoreCorrect = 0;
	let resultCorrect = 0;
	let total = 0;
	for (let i = 0; i < json.predictions.length; i++) {
		for (let j = 0; j < json.predictions[i].predictions.length; j++) {
			const prediction = json.predictions[i].predictions[j];
			if (prediction.actual == null) {
				continue;
			}

			if (identicalScore(prediction.prediction, prediction.actual)) {
				prediction.color = 'green';
				scoreCorrect += 1;
				resultCorrect += 1;
			} else if (sameResult(prediction.prediction, prediction.actual)) {
				prediction.color = 'yellow';
				resultCorrect += 1;
			} else {
				prediction.color = 'red';
			}
			total += 1;
		}
	}

	let scoreAccuracy = 0;
	let resultAccuracy = 0;
	if (total > 0) {
		scoreAccuracy = scoreCorrect / total;
		resultAccuracy = resultCorrect / total;
	}
	json.accuracy = {
		scoreAccuracy,
		resultAccuracy
	};
}

export function sortByDate(predictions: MatchdayPredictions[]) {
	predictions.sort((a, b) => {
		return (new Date(b._id)).getTime() - (new Date(a._id)).getTime();
	});
	// Sort each day of predictions by time
	for (let i = 0; i < predictions.length; i++) {
		predictions[i].predictions.sort((a: Prediction, b: Prediction) => {
			return (new Date(a.datetime)).getTime() - (new Date(b.datetime)).getTime();
		});
	}
}

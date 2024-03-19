import { predictions as predictionsCollection } from '$db/predictions';
import type { PageServerLoad } from './$types';
import { calcAccuracy, sortByDate } from './data';
import type { PredictionsData } from './predictions.types';

async function fetchPredictions() {
	const predictions = Object(await predictionsCollection.aggregate([
		{
			"$group": {
				"_id": {
					"$dateToString": {
						"format": "%Y-%m-%d",
						"date": "$datetime",
					}
				},
				"predictions": { "$push": "$$ROOT" },
			}
		}
	]).toArray());

	sortByDate(predictions);
	const accuracy = calcAccuracy(predictions);
	const data = {
		accuracy,
		predictions
	}
	return data as PredictionsData;
}

export const load: PageServerLoad = async () => {
	const data = await fetchPredictions();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	return data;
}

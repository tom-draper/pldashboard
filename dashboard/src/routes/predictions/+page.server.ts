import { predictions } from '$db/predictions';
import type { PageServerLoad } from './$types';
import { insertExtras, sortByDate } from './data';
import type { PredictionsData } from './predictions.types';

async function fetchPredictions() {
	let data = Object(await predictions.aggregate([
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

	sortByDate(data);
	data = { predictions: data };
	insertExtras(data);
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

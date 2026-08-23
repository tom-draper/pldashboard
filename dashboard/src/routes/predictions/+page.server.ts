import { predictions } from '$lib/server/database/predictions';
import { withMongoRetry } from '$lib/server/database/mongo';
import type { PageServerLoad } from './$types';
import { calcAccuracy, sortByDate } from './data';
import type { PredictionsData } from './predictions.types';

async function fetchPredictions() {
	const groupedPredictions = Object(
		await withMongoRetry(() =>
			predictions()
				.aggregate([
					{
						$group: {
							_id: {
								$dateToString: {
									format: '%Y-%m-%d',
									date: '$datetime'
								}
							},
							predictions: { $push: '$$ROOT' }
						}
					}
				])
				.toArray()
		)
	);

	sortByDate(groupedPredictions);
	const accuracy = calcAccuracy(groupedPredictions);
	const data = {
		accuracy,
		predictions: groupedPredictions
	};
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
};

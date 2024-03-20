import { predictions } from '$lib/server/database/predictions-v2';
import type { PageServerLoad } from './$types';

async function fetchPredictions() {
	const data = await predictions.find({ score: null }).toArray();
	return data
}

export const load: PageServerLoad = async () => {
	const data = await fetchPredictions();
	return {
		matches: data,
	};
}

import { predictions } from '$db/predictions-v2';
import type { PageServerLoad } from './$types';

async function fetchPredictions() {
	const data = Object((await predictions.find({}).toArray())[0]);
	return data
}

export const load: PageServerLoad = async () => {
	const data = await fetchPredictions();
	return data;
}

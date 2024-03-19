import type { PageServerLoad } from './$types';
import { fetchPredictions } from './data';

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

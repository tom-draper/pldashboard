import { fetchPredictions } from './data';

export async function load() {
	const data = await fetchPredictions();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	return data;
}

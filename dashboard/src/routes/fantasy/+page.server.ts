import type { PageServerLoad } from './$types';
import { fetchFantasy } from './data';

export const load: PageServerLoad = async () => {
	const data = await fetchFantasy();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	return {
		data,
		page: 'all',
		title: 'Fantasy',
		pageData: data
	};
}

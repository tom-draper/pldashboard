import type { PageServerLoad } from './$types';
import { fetchFantasy } from '$lib/server/database/queries';

export const load: PageServerLoad = async () => {
	const data = await fetchFantasy();

	return {
		data,
		page: 'all',
		title: 'Fantasy',
		pageData: data
	};
}

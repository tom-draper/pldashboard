import { fantasy } from '$db/fantasy';
import type { PageServerLoad } from './$types';

async function fetchFantasy() {
	const data = Object((await fantasy.find({_id: "fantasy"}).toArray())[0])
	return data
}

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

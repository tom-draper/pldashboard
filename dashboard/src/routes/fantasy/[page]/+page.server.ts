import { fantasy } from '$db/fantasy';
import type { PageServerLoad } from './$types';
import { filterDataByPage, getTitle } from './data';

async function fetchFantasy() {
	const data = Object((await fantasy.find({_id: "fantasy"}).toArray())[0])
	return data
}

export const load: PageServerLoad = async ({ params }: { params: { page: string } }) => {
	const page = params.page;
	if (
		page !== 'all' &&
		page !== 'attack' &&
		page !== 'defence' &&
		page !== 'goalkeeper' &&
		page !== 'midfield'
	) {
		return {
			status: 404,
			error: new Error('Invalid page')
		};
	}

	const data = await fetchFantasy();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	const pageData = filterDataByPage(data, page);

	const title = getTitle(page);

	return {
		data,
		page,
		title,
		pageData
	};
}

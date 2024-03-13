import { fetchFantasy } from '../data';
import { filterDataByPage, getTitle } from './data';

export async function load({ params }: { params: { page: string } }) {
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

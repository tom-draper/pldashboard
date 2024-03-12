import { url } from '../../[team]/consts';
import type { FantasyData, Page } from '../../[team]/fantasy.types';

async function fetchFantasy() {
	const response = await fetch(`${url}/fantasy`);
	if (!response.ok) {
		return;
	}
	const json: FantasyData = await response.json();
	return json;
}

function getTitle(page: Page) {
	if (page === 'all') {
		return 'Fantasy';
	} else {
		return `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`;
	}
}
function filterDataByPage(data: FantasyData, page: Page) {
	const pageData: FantasyData = {};
	for (const team of Object.keys(data)) {
		if (
			team === '_id' ||
			page === 'all' ||
			(page === 'attack' && data[team].position === 'Forward') ||
			(page === 'midfield' && data[team].position === 'Midfielder') ||
			(page === 'defence' && data[team].position === 'Defender') ||
			(page === 'goalkeeper' && data[team].position === 'Goalkeeper')
		)
			pageData[team] = data[team];
	}
	return pageData;
}

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

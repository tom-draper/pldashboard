import type { FantasyData, Page } from "../fantasy.types";

export function getTitle(page: Page) {
	if (page === 'all') {
		return 'Fantasy';
	} else {
		return `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`;
	}
}

export function filterDataByPage(data: FantasyData, page: Page) {
	const pageData: FantasyData = {};
	for (const team in data) {
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
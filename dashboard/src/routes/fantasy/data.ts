import type { FantasyData, Page } from "./fantasy.types";

export function filterDataByPage(data: FantasyData, page: Page) {
	const pageData: FantasyData = {};
	for (const team in data) {
		if (
			team === '_id' ||
			page === 'all' ||
			(page === 'forward' && data[team].position === 'Forward') ||
			(page === 'midfielder' && data[team].position === 'Midfielder') ||
			(page === 'defender' && data[team].position === 'Defender') ||
			(page === 'goalkeeper' && data[team].position === 'Goalkeeper')
		) {
			pageData[team] = data[team];
		}
	}
	return pageData;
}

export function getTitle(page: Page) {
	if (page === 'all') {
		return 'Fantasy';
	} else {
		return `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`;
	}
}

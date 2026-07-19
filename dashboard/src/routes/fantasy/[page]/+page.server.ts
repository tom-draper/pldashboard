import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { filterDataByPage, getTitle } from '../data';
import type { Page } from '../fantasy.types';
import { fetchFantasy } from '$lib/server/database/queries';

const VALID_PAGES: readonly Page[] = ['all', 'forward', 'defender', 'goalkeeper', 'midfielder'];

function isValidPage(page: string): page is Page {
	return (VALID_PAGES as readonly string[]).includes(page);
}

export const load: PageServerLoad = async ({ params }: { params: { page: string } }) => {
	const page = params.page;

	if (!isValidPage(page)) {
		throw error(404, `Unknown fantasy page: ${page}`);
	}

	const data = await fetchFantasy();
	const pageData = filterDataByPage(data, page);
	const title = getTitle(page);

	return {
		data,
		page,
		title,
		pageData
	};
}

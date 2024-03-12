import { url } from '../[team]/consts';

async function fetchFantasy() {
	const response = await fetch(`${url}/fantasy`);
	if (!response.ok) {
		return;
	}
	const json = await response.json();
	return json;
}

export async function load() {
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

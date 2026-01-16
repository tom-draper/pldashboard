import { CURRENT_SEASON } from '$lib/consts';
import { fantasy } from '$lib/server/database/fantasy';
import { teams } from '$lib/server/database/teams';
import type { TeamsData } from '../[team]/dashboard.types';
import type { PageServerLoad } from './$types';

async function fetchFantasy() {
	const data = Object((await fantasy.find({ _id: "fantasy" }).toArray())[0])
	return data
}

async function fetchTeams() {
	const data = Object((await teams.find({ _id: CURRENT_SEASON }).toArray())[0]);
	return data as TeamsData
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

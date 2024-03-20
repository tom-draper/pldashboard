import type { PageServerLoad } from './$types';
import { teams } from '$lib/server/database/teams';
import { CURRENT_SEASON } from '$lib/consts';
import type { TeamsData } from '../[team]/dashboard.types';
import { getTeams } from '$lib/team';

async function fetchTeams() {
	const data = Object((await teams.find({ _id: CURRENT_SEASON }).toArray())[0]);
	return data as TeamsData
}

export const load: PageServerLoad = async () => {
	const data = await fetchTeams();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	const teams = getTeams(data);
	return {
		slug: 'overview',
		team: {
			name: null,
			id: null
		},
		teams,
		title: 'Dashboard | Overview',
		currentMatchday: null,
		playedDates: null,
		data
	};
}

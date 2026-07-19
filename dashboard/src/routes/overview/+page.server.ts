import type { PageServerLoad } from './$types';
import { getTeams } from '$lib/team';
import { fetchTeams } from '$lib/server/database/queries';

export const load: PageServerLoad = async () => {
	const data = await fetchTeams();
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

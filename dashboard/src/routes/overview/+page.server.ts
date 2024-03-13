import { fetchTeams, getTeams } from '../[team]/data';

export async function load() {
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

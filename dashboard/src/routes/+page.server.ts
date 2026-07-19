import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { TeamsData } from './[team]/dashboard.types';
import { getTitle, validTeam } from './[team]/data';
import { getCurrentMatchday, playedMatchdayDates, getTeamID, getTeams } from '$lib/team';
import { fetchTeams } from '$lib/server/database/queries';

function getTeam(data: TeamsData) {
	const team = Object.keys(data.standings)[0];
	return team;
}

export const load: PageServerLoad = async () => {
	const data = await fetchTeams();

	const team = getTeam(data);
	const teams = getTeams(data);
	if (!validTeam(team, teams)) {
		throw error(404, 'Team not found');
	}

	const title = getTitle(team);
	const currentMatchday = getCurrentMatchday(data, team);
	const playedDates = playedMatchdayDates(data, team);
	const teamID = getTeamID(team);
	return {
		slug: null,
		team: {
			name: team,
			id: teamID
		},
		teams,
		title,
		currentMatchday,
		playedDates,
		data
	};
}

import type { PageServerLoad } from './$types';
import type { TeamsData } from './[team]/dashboard.types';
import { getTitle, validTeam } from './[team]/data';
import { getCurrentMatchday, playedMatchdayDates, getTeamID, getTeams } from '$lib/team';
import { CURRENT_SEASON } from '$lib/consts';
import { teams } from '$lib/server/database/teams';

async function fetchTeams() {
	const data = Object((await teams.find({"_id": CURRENT_SEASON}).toArray())[0]);
	return data as TeamsData
}

function getTeam(data: TeamsData) {
	const team = Object.keys(data.standings)[0];
	return team;
}

export const load: PageServerLoad = async () => {
	const data = await fetchTeams();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	const team = getTeam(data);
	const teams = getTeams(data);
	if (!validTeam(team, teams)) {
		return {
			status: 404,
			error: new Error('Team not found')
		};
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

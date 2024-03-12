import type { TeamsData } from './[team]/dashboard.types';
import { fetchTeams, getTeams, getTitle, validTeam } from './[team]/data';
import { getCurrentMatchday, playedMatchdayDates, getTeamID } from './[team]/team';

function getTeam(data: TeamsData) {
	const team = Object.keys(data.standings)[0];
	return team;
}

export async function load() {
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

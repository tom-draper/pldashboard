import { url } from './consts';
import type { TeamsData, Team } from './dashboard.types';

export async function fetchTeams() {
	const response = await fetch(`${url}/teams`);
	if (!response.ok) {
		// error(response.statusText, response.status);
		return;
	}
	const json: TeamsData = await response.json();
	return json;
}

export function getTeams(data: TeamsData) {
	const teams = Object.keys(data.standings) as Team[];
	return teams;
}

export function getTitle(team: string) {
	return `Dashboard | ${team}`;
}

export function validTeam(team: string, teams: string[]): team is Team {
	return teams.includes(team);
}

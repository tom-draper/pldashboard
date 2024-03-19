import { CURRENT_SEASON, URL } from '$lib/consts';
import teams from "$db/teams";
import type { TeamsData } from './dashboard.types';
import type { Team } from '$lib/types';

export async function fetchTeams() {
	const data = await teams.find({_id: CURRENT_SEASON});
	return data
}

export async function fetchTeamsOld() {
	const response = await fetch(`${URL}/teams`);
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

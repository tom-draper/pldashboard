import type { TeamsData } from './dashboard.types';
import type { Team } from '$lib/types';

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

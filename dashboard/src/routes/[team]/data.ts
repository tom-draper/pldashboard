import type { TeamsData } from './dashboard.types';
import type { Team } from '$lib/types';


export function getTitle(team: string) {
	return `Dashboard | ${team}`;
}

export function validTeam(team: string, teams: string[]): team is Team {
	return teams.includes(team);
}

import type { Team } from '$lib/types';

export function getTitle(team: string) {
	return `${team} Stats, Form & Fixtures | pldashboard`;
}

export function validTeam(team: string, teams: string[]): team is Team {
	return teams.includes(team);
}

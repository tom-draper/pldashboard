import { getTeamID, toInitials } from './team';
import type { Team } from './types';

export function ordinal(n: number): string {
	const ord = ['', 'st', 'nd', 'rd'];
	const a = n % 100;
	return ord[a > 20 ? a % 10 : a] || 'th';
}

export function teamStyle(team: Team): string {
	const teamID = getTeamID(team);
	return `background: var(--${teamID}); color: var(--${teamID}-secondary);`;
}

export function scoreline(
	homeTeam: string,
	awayTeam: string,
	homeGoals: number,
	awayGoals: number
): string {
	return `${homeTeam} ${homeGoals} - ${awayGoals} ${awayTeam}`;
}

export function scorelineShort(
	homeTeam: Team,
	awayTeam: Team,
	homeGoals: number,
	awayGoals: number
): string {
	return `${toInitials(homeTeam)} ${homeGoals} - ${awayGoals} ${toInitials(awayTeam)}`;
}

export function toTitleCase(str: string): string {
	return str
		.toLowerCase()
		.split(' ')
		.map(function (word) {
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ')
		.replace('And', 'and');
}

export function slugAlias(slug: string): string {
	switch (slug) {
		case 'brighton':
			return 'brighton-and-hove-albion';
		case 'palace':
			return 'crystal-palace';
		case 'united':
			return 'manchester-united';
		case 'city':
			return 'city';
		case 'nottingham':
			return 'nottingham-forest';
		case 'luton':
			return 'luton-town';
		case 'sheffield':
			return 'sheffield-united';
		case 'villa':
			return 'aston-villa';
		case 'spurs':
			return 'tottenham-hotspur';
		case 'wolves':
			return 'wolverhampton-wanderers';
		default:
			return slug; // No alias found
	}
}

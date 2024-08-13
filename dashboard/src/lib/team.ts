import type { Form, TeamsData } from '../routes/[team]/dashboard.types';
import type { Team } from './types';

export function toInitials(team: Team): string {
	switch (team) {
		case 'Brighton and Hove Albion':
			return 'BHA';
		case 'Manchester City':
			return 'MCI';
		case 'Manchester United':
			return 'MUN';
		case 'Aston Villa':
			return 'AVL';
		case 'Sheffield United':
			return 'SHU';
		case 'West Bromwich Albion':
			return 'WBA';
		case 'West Ham United':
			return 'WHU';
	}
	return team.slice(0, 3).toUpperCase();
}

const alias: {[team in Team]?: string} = {
	'Wolverhampton Wanderers': 'Wolves',
	'Tottenham Hotspur': 'Spurs',
	'Leeds United': 'Leeds',
	'West Ham United': 'West Ham',
	'Brighton and Hove Albion': 'Brighton'
} as const;

export function toAlias(team: Team): string {
	if (team in alias) {
		return alias[team];
	}
	return team;
}

export function toName(teamAlias: string): string {
	const team = Object.keys(alias).find(key => alias[key] === teamAlias);
	return team ?? teamAlias;
}

export function getTeamID(team: Team): string {
	return team.toLowerCase().replace(/ /g, '-');
}

export function teamInSeason(form: Form, team: Team, season: number): boolean {
	return team in form && form[team][season]['1'] != null;
}

export function teamColor(team: Team): string {
	const teamKey = getTeamID(team);
	const teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
	return teamColor;
}

export function getPlayedMatchdays(data: TeamsData, team: Team): string[] {
	if (!(data._id in data.form[team])) {
		return [];
	}
	return Object.keys(data.form[team][data._id]).filter(
		(matchday) => data.form[team][data._id][matchday].score != null
	);
}

export function getCurrentMatchday(data: TeamsData, team: Team): string {
	// if (!(data._id in data.form[team])) {
	// 	return '0';
	// }
	const matchdays = getMatchdays(data, team);
	for (let i = matchdays.length - 1; i >= 0; i--) {
		if (data.form[team][data._id][matchdays[i]].score != null) {
			return matchdays[i];
		}
	}
	return '1';
}

export function getMatchdays(data: TeamsData, team: Team): string[] {
	if (!(data._id in data.form[team])) {
		return [];
	}
	return Object.keys(data.form[team][data._id]);
}

export function playedMatchdayDates(data: TeamsData, team: Team): Date[] {
	let matchdays = getPlayedMatchdays(data, team);

	// If played one or no games, take x-axis from whole season dates
	if (matchdays.length === 0) {
		matchdays = Object.keys(data.fixtures[team]);
	}

	// Find median matchday date across all teams for each matchday
	const x = [];
	const teams = getTeams(data);
	for (const matchday of matchdays) {
		const matchdayDates = [];
		for (const team of teams) {
			matchdayDates.push(new Date(data.fixtures[team][matchday].date));
		}
		matchdayDates.sort();
		x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
	}
	x.sort(function (a, b) {
		return a.getTime() - b.getTime();
	});
	return x;
}

export function getTeams(data: TeamsData): Team[] {
	return Object.keys(data.standings) as Team[];
}

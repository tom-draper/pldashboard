import { getTeams } from '$lib/team';
import type { Team } from '$lib/types';
import type { TeamsData } from './dashboard.types';

export type UpcomingMatch = {
	time: Date;
	home: Team;
	away: Team;
};

export function upcomingMatches(data: TeamsData) {
	const upcoming: UpcomingMatch[] = [];
	const teams = getTeams(data);
	for (const team of teams) {
		if (!data.upcoming[team].atHome) {
			continue;
		}
		const awayTeam = data.upcoming[team].team;
		if (awayTeam === null) {
			continue;
		}
		const date = new Date(data.upcoming[team].date);
		upcoming.push({
			time: date,
			home: team,
			away: awayTeam
		});
	}
	upcoming.sort((a: UpcomingMatch, b: UpcomingMatch) => {
		return a.time.getTime() - b.time.getTime();
	});
	return upcoming;
}

export type Standings = {
	team: Team;
	position: number;
	played: number;
	points: number;
	won: number;
	lost: number;
	drawn: number;
	gA: number;
	gD: number;
	gF: number;
};

export function standingsTable(data: TeamsData) {
	const standings: Standings[] = [];
	const teams = getTeams(data);
	for (const team of teams) {
		const row = Object(data.standings[team][data._id]);
		row.team = team;
		standings.push(row);
	}
	standings.sort((a, b) => {
		return a.position - b.position;
	});
	return standings;
}

export type Fixtures = {
	team: Team;
	matches: {
		team: Team;
		date: Date;
		atHome: boolean;
		status: string;
		color: string;
	}[];
};

export function fixturesTable(data: TeamsData, standings: Standings[]): Fixtures[] {
	const fixtures = [];
	for (const row of standings) {
		const matches = [];
		for (const matchday in data.fixtures[row.team]) {
			const match = data.fixtures[row.team][matchday];
			const homeAdvantage = match.atHome
				? 0
				: data.homeAdvantages[match.team].totalHomeAdvantage;
			matches.push({
				team: match.team,
				date: match.date,
				atHome: match.atHome,
				status: match.status,
				color: fixtureColorSkewed(data.teamRatings[match.team].total + homeAdvantage)
			});
		}
		fixtures.push({
			team: row.team,
			matches: matches
		});
	}
	return fixtures;
}

export function fixtureColorSkewed(scaleVal: number) {
	if (scaleVal < 0.05) {
		return '#00fe87';
	} else if (scaleVal < 0.1) {
		return '#63fb6e';
	} else if (scaleVal < 0.15) {
		return '#8df755';
	} else if (scaleVal < 0.2) {
		return '#aef23e';
	} else if (scaleVal < 0.25) {
		return '#cbec27';
	} else if (scaleVal < 0.3) {
		return '#e6e50f';
	} else if (scaleVal < 0.35) {
		return '#ffdd00';
	} else if (scaleVal < 0.4) {
		return '#ffc400';
	} else if (scaleVal < 0.45) {
		return '#ffab00';
	} else if (scaleVal < 0.5) {
		return '#ff9000';
	} else if (scaleVal < 0.55) {
		return '#ff7400';
	} else if (scaleVal < 0.6) {
		return '#ff5618';
	} else {
		return '#f83027';
	}
}

export function fixtureColor(scaleVal: number) {
	if (scaleVal < 0.2) {
		return '#00fe87';
	} else if (scaleVal < 0.25) {
		return '#63fb6e';
	} else if (scaleVal < 0.35) {
		return '#8df755';
	} else if (scaleVal < 0.4) {
		return '#aef23e';
	} else if (scaleVal < 0.45) {
		return '#cbec27';
	} else if (scaleVal < 0.5) {
		return '#e6e50f';
	} else if (scaleVal < 0.55) {
		return '#ffdd00';
	} else if (scaleVal < 0.6) {
		return '#ffc400';
	} else if (scaleVal < 0.65) {
		return '#ffab00';
	} else if (scaleVal < 0.7) {
		return '#ff9000';
	} else if (scaleVal < 0.75) {
		return '#ff7400';
	} else if (scaleVal < 0.8) {
		return '#ff5618';
	} else {
		return '#f83027';
	}
}

export function applyRatingFixturesScaling(
	fixtures: Fixtures[],
	data: TeamsData,
	fixturesScaling: string
) {
	if (fixturesScaling === 'rating') {
		return { fixtures, fixturesScaling };
	}
	fixturesScaling = 'rating';

	for (const teamFixtures of fixtures) {
		for (const match of teamFixtures.matches) {
			const homeAdvantage = match.atHome
				? 0
				: data.homeAdvantages[match.team].totalHomeAdvantage;
			match.color = fixtureColorSkewed(data.teamRatings[match.team].total + homeAdvantage);
		}
	}
	return { fixtures, fixturesScaling };
}

export function applyRatingFormScaling(
	fixtures: Fixtures[],
	data: TeamsData,
	fixturesScaling: string
) {
	if (fixturesScaling === 'form') {
		return { fixtures, fixturesScaling };
	}
	fixturesScaling = 'form';

	for (const teamFixtures of fixtures) {
		for (const match of teamFixtures.matches) {
			let form = 0.5;
			const matchdays = Object.keys(data.form[teamFixtures.team][data._id]).reverse();
			const homeAdvantage = match.atHome
				? 0
				: data.homeAdvantages[match.team].totalHomeAdvantage;
			for (const matchday of matchdays) {
				const formRating = data.form[match.team][data._id][matchday].formRating5;
				if (formRating != null) {
					form = formRating;
				}
			}
			match.color = fixtureColor(form + homeAdvantage);
		}
	}
	return { fixtures, fixturesScaling };
}

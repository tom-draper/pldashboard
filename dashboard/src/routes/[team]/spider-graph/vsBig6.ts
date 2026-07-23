import type { Form, SpiderAttribute, TeamAttributes, TeamsData } from '../dashboard.types';
import { getTeams } from '$lib/team';
import { attributeAvgScaled, seasonComplete } from './util';
import { Team } from '$lib/types';

// Enum members rather than bare strings: Team is an enum, so the strings were
// inferred as string[] and only type-checked here once removeItem stopped
// returning any.
const big6: Team[] = [
	Team.ManchesterUnited,
	Team.Liverpool,
	Team.ManchesterCity,
	Team.Arsenal,
	Team.Chelsea,
	Team.TottenhamHotspur
];

function formWinsVsBig6(form: Form, team: Team, season: number, big6: Team[]) {
	let pointsVsBig6 = 0;
	let numPlayed = 0;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		// Only played matches, and only against a big 6 opponent. This read
		// `big6.includes(match.team)` without the negation, which skipped the
		// big 6 matches and scored the team against everyone else instead.
		if (match.score == null || match.team === null || !big6.includes(match.team)) {
			continue;
		}
		if (
			(match.atHome && match.score.homeGoals > match.score.awayGoals) ||
			(!match.atHome && match.score.homeGoals < match.score.awayGoals)
		) {
			pointsVsBig6 += 3;
		} else if (match.score.homeGoals === match.score.awayGoals) {
			pointsVsBig6 += 1;
		}
		numPlayed += 1;
	}

	return { pointsVsBig6, numPlayed };
}

function average(value: number, total: number) {
	if (total === 0) {
		return 0;
	}
	return value / total;
}

export default function getVsBig6(data: TeamsData, numSeasons: number) {
	const vsBig6: Partial<TeamAttributes> = {};

	let maxAvgSeasonPointsVsBig6 = Number.NEGATIVE_INFINITY;
	const teams = getTeams(data);
	for (const team of teams) {
		// filter, not removeItem: removeItem splices in place, and big6 is a
		// module-level array, so every big 6 team removed itself from it
		// permanently. One pass over the teams emptied it, and later teams (and
		// every later render) were measured against nothing at all.
		const big6Opponents = big6.filter((opponent) => opponent !== team);

		let totalPointsVsBig6 = 0;
		let totalPlayedVsBig6 = 0;
		for (let i = 0; i < numSeasons; i++) {
			const { pointsVsBig6: seasonPointsVsBig6, numPlayed: seasonPlayedVsBig6 } = formWinsVsBig6(
				data.form,
				team,
				data._id - i,
				big6Opponents
			);
			if (seasonPlayedVsBig6 === 0) {
				continue;
			}
			const avgSeasonPointsVsBig6 = seasonPointsVsBig6 / seasonPlayedVsBig6;
			// If season completed, check if season consistency is highest yet
			if (
				seasonComplete(data, team, data._id - i) &&
				avgSeasonPointsVsBig6 > maxAvgSeasonPointsVsBig6
			) {
				maxAvgSeasonPointsVsBig6 = avgSeasonPointsVsBig6;
			}
			totalPointsVsBig6 += seasonPointsVsBig6;
			totalPlayedVsBig6 += seasonPlayedVsBig6;
		}

		vsBig6[team] = average(totalPointsVsBig6, totalPlayedVsBig6);
	}

	const finalisedVsBig6: TeamAttributes = vsBig6 as TeamAttributes;

	const attribute: SpiderAttribute = {
		teams: finalisedVsBig6,
		// No `* numSeasons` here, unlike cleanSheets/consistency/winStreak. Those
		// store a total across seasons, so their ceiling is the best season times
		// the number of seasons. This stores points *per game*, so its ceiling is
		// simply the best points per game any team managed in a season.
		avg: attributeAvgScaled(finalisedVsBig6, maxAvgSeasonPointsVsBig6)
	};
	return attribute;
}

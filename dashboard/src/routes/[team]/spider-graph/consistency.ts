import type { Form, SpiderAttribute, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { attributeAvgScaled, seasonComplete } from "./util";
import type { Team } from "$lib/types";

function formConsistency(form: Form, team: Team, season: number) {
	let backToBack = 0; // Counts pairs of back to back identical match results
	let prevResult = null;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		if (match.score == null) {
			continue;
		}

		let result: 'win' | 'lost' | 'draw';
		if (
			(match.atHome && match.score.homeGoals > match.score.awayGoals) ||
			(!match.atHome && match.score.homeGoals < match.score.awayGoals)
		) {
			result = 'win';
		} else if (
			(match.atHome && match.score.homeGoals < match.score.awayGoals) ||
			(!match.atHome && match.score.homeGoals > match.score.awayGoals)
		) {
			result = 'lost';
		} else {
			result = 'draw';
		}
		if (prevResult != null && prevResult === result) {
			backToBack += 1;
		}
		prevResult = result;
	}
	return backToBack;
}

export default function getConsistency(data: TeamsData, numSeasons: number): SpiderAttribute {
	const consistency: SpiderAttribute = { avg: 0 };
	let maxSeasonBackToBack = Number.NEGATIVE_INFINITY;
	const teams = getTeams(data);
	for (const team of teams) {
		let totalBackToBack = 0;
		for (let i = 0; i < numSeasons; i++) {
			const seasonBackToBack = formConsistency(data.form, team, data._id - i);
			// If season completed, check if season consistency is highest yet
			if (seasonComplete(data, team, data._id - i) && seasonBackToBack > maxSeasonBackToBack) {
				maxSeasonBackToBack = seasonBackToBack;
			}
			totalBackToBack += seasonBackToBack;
		}

		consistency[team] = totalBackToBack;
	}

	consistency.avg = attributeAvgScaled(consistency, maxSeasonBackToBack * numSeasons);
	return consistency;
}


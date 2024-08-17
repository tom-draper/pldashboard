import type { Form, FormEntry, SpiderAttribute, TeamAttributes, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { attributeAvgScaled, seasonComplete } from "./util";
import type { Team } from "$lib/types";

type MatchResult = 'win' | 'lost' | 'draw';

function formConsistency(form: Form, team: Team, season: number) {
	let backToBack = 0; // Counts pairs of back to back identical match results
	let prevResult = null;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		if (match.score == null) {
			continue;
		}

		const result = matchResult(match);
		if (prevResult != null && prevResult === result) {
			backToBack += 1;
		}
		prevResult = result;
	}
	return backToBack;
}

function matchResult(match: any) {
	let result: MatchResult;
	if (matchWon(match)) {
		result = 'win';
	} else if (matchLost(match)) {
		result = 'lost';
	} else {
		result = 'draw';
	}
	return result;
}

function matchWon(match: FormEntry) {
	return (match.atHome && match.score.homeGoals > match.score.awayGoals) ||
		(!match.atHome && match.score.homeGoals < match.score.awayGoals);
}

function matchLost(match: FormEntry) {
	return (match.atHome && match.score.homeGoals < match.score.awayGoals) ||
		(!match.atHome && match.score.homeGoals > match.score.awayGoals);
}

export default function getConsistency(data: TeamsData, numSeasons: number): SpiderAttribute {
	const consistency: Partial<TeamAttributes> = {};

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

	const finalisedConsistency: TeamAttributes = consistency as TeamAttributes;

	const attribute: SpiderAttribute = {
		teams: finalisedConsistency,
		avg: attributeAvgScaled(finalisedConsistency, maxSeasonBackToBack * numSeasons)
	}
	return attribute;
}


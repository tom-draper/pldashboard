import type { Form, FormEntry, SpiderAttribute, TeamAttributes, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { attributeAvgScaled, seasonComplete } from "./util";
import type { Team } from "$lib/types";

function formCleanSheets(form: Form, team: Team, season: number) {
	let nCleanSheets = 0;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		if (match.score === null) {
			continue;
		}
		if (cleanSheet(match)) {
			nCleanSheets += 1;
		}
	}
	return nCleanSheets;
}

function cleanSheet(match: FormEntry) {
	return (match.atHome && match.score.awayGoals === 0) ||
		(!match.atHome && match.score.homeGoals === 0);
}

export default function getCleanSheets(data: TeamsData, numSeasons: number) {
	const cleanSheets: Partial<TeamAttributes> = {};

	let maxSeasonCleanSheets = Number.NEGATIVE_INFINITY;
	const teams = getTeams(data);
	for (const team of teams) {
		let totalCleanSheetsCount = 0;
		for (let i = 0; i < numSeasons; i++) {
			const seasonCleanSheets = formCleanSheets(data.form, team, data._id - i);
			if (seasonComplete(data, team, data._id - i) && seasonCleanSheets > maxSeasonCleanSheets) {
				maxSeasonCleanSheets = seasonCleanSheets;
			}
			totalCleanSheetsCount += seasonCleanSheets;
		}
		cleanSheets[team] = totalCleanSheetsCount;
	}

	const finalisedCleanSheets = cleanSheets as TeamAttributes;

	const attribute: SpiderAttribute = {
		teams: finalisedCleanSheets,
		avg: attributeAvgScaled(finalisedCleanSheets, maxSeasonCleanSheets * numSeasons)
	};
	return attribute;
}

import type { Form, SpiderAttribute, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { attributeAvgScaled, seasonComplete } from "./util";
import type { Team } from "$lib/types";

function formCleanSheets(form: Form, team: Team, season: number) {
	let nCleanSheets = 0;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		if (match.score == null) {
			continue;
		}
		if (match.atHome && match.score.awayGoals === 0) {
			nCleanSheets += 1;
		} else if (!match.atHome && match.score.homeGoals === 0) {
			nCleanSheets += 1;
		}
	}
	return nCleanSheets;
}

export default function getCleanSheets(data: TeamsData, numSeasons: number) {
	const cleanSheets: SpiderAttribute = { avg: 0 };
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

	cleanSheets.avg = attributeAvgScaled(cleanSheets, maxSeasonCleanSheets * numSeasons);

	return cleanSheets;
}

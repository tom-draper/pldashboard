import type { Form, SpiderAttribute, TeamAttributes, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { attributeAvgScaled, seasonComplete } from "./util";
import type { Team } from "$lib/types";

function formWinStreak(form: Form, team: Team, season: number) {
	let winStreak = 0;
	let tempWinStreak = 0;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		if (match.score == null) {
			continue;
		}
		if (
			(match.atHome && match.score.homeGoals > match.score.awayGoals) ||
			(!match.atHome && match.score.homeGoals < match.score.awayGoals)
		) {
			tempWinStreak += 1;
			if (tempWinStreak > winStreak) {
				winStreak = tempWinStreak;
			}
		} else {
			tempWinStreak = 0;
		}
	}
	return winStreak;
}

export default function getWinStreak(data: TeamsData, numSeasons: number) {
	const winStreaks: Partial<TeamAttributes> = {};

	let maxSeasonWinStreak = Number.NEGATIVE_INFINITY;
	const teams = getTeams(data)
	for (const team of teams) {
		let totalWinStreak = 0;
		for (let i = 0; i < numSeasons; i++) {
			const seasonWinSteak = formWinStreak(data.form, team, data._id - i);
			// If season completed, check if season consistency is highest yet
			if (seasonComplete(data, team, data._id - i) && seasonWinSteak > maxSeasonWinStreak) {
				maxSeasonWinStreak = seasonWinSteak;
			}
			totalWinStreak += seasonWinSteak;
		}

		winStreaks[team] = totalWinStreak;
	}

	const finalisedWinStreaks: TeamAttributes = winStreaks as TeamAttributes;

	const attribute: SpiderAttribute = {
		teams: finalisedWinStreaks,
		avg: attributeAvgScaled(finalisedWinStreaks, maxSeasonWinStreak * numSeasons)
	}
	return attribute;
}
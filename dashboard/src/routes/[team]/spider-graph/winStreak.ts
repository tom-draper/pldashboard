import type { Team, TeamsData } from "../dashboard.types";
import { getTeams } from "../team";
import { attributeAvgScaled, seasonComplete } from "./util";

function formWinStreak(form: TeamsData['form'], team: Team, season: number) {
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
	const winStreaks: SpiderAttribute = {avg: 0};
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

	winStreaks.avg = attributeAvgScaled(winStreaks, maxSeasonWinStreak * numSeasons);
	return winStreaks;
}
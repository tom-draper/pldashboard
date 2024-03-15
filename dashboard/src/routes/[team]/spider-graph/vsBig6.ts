import type { Team, TeamsData } from "../dashboard.types";
import { getTeams } from "../team";
import { attributeAvgScaled, removeItem, seasonComplete } from "./util";

const big6 = [
	'Manchester United',
	'Liverpool',
	'Manchester City',
	'Arsenal',
	'Chelsea',
	'Tottenham Hotspur'
];

function formWinsVsBig6(
	form: TeamsData['form'],
	team: Team,
	season: number,
	big6: Team[]
) {
	let pointsVsBig6 = 0;
	let numPlayed = 0;
	for (const matchday in form[team][season]) {
		const match = form[team][season][matchday];
		if (match.score == null || (match.team !== null && big6.includes(match.team))) {
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

	return [pointsVsBig6, numPlayed] as const;
}

export default function getVsBig6(data: TeamsData, numSeasons: number) {
	//@ts-ignore
	const vsBig6: SpiderAttribute = {avg: 0};
	let maxAvgSeasonPointsVsBig6 = Number.NEGATIVE_INFINITY;
	const teams = getTeams(data);
	for (const team of teams) {
		let totalPointsVsBig6 = 0;
		let totalPlayedVsBig6 = 0;
		for (let i = 0; i < numSeasons; i++) {
			const [seasonPointsVsBig6, seasonPlayedVsBig6] = formWinsVsBig6(
				data.form,
				team,
				data._id - i,
				removeItem(big6, team)
			);
			if (seasonPlayedVsBig6 === 0) {
				continue;
			}
			const avgSeasonPointsVsBig6 = seasonPlayedVsBig6 / seasonPlayedVsBig6;
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

		let totalAvgPointsVsBig = 0;
		if (totalPlayedVsBig6 > 0) {
			totalAvgPointsVsBig = totalPointsVsBig6 / totalPlayedVsBig6;
		}
		vsBig6[team] = totalAvgPointsVsBig;
	}

	vsBig6.avg = attributeAvgScaled(vsBig6, maxAvgSeasonPointsVsBig6 * numSeasons);
	return vsBig6;
}
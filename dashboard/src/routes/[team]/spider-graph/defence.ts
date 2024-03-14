import type { TeamsData } from '../dashboard.types';
import { getTeams } from '../team';
import { attributeAvg } from './util';

function concededPerSeason(data: TeamsData): [SpiderAttribute, [number, number]] {
	const defence: SpiderAttribute = { avg: 0 };
	let maxConcededPerSeason = Number.NEGATIVE_INFINITY;
	let minConcededPerSeason = Number.POSITIVE_INFINITY;
	const teams = getTeams(data);
	for (const team of teams) {
		let totalConceded = 0;
		let gamesPlayed = 0;
		for (const season in data.standings[team]) {
			const conceded = data.standings[team][season].gA;
			const played = data.standings[team][season].played;
			if (conceded > 0) {
				totalConceded += conceded;
				gamesPlayed += played;
			}
			// If season completed, check if team's defensive performance is most extreme yet
			if (played < 38) {
				continue;
			}
			const seasonConcededPerGame = conceded / played;
			if (seasonConcededPerGame > maxConcededPerSeason) {
				maxConcededPerSeason = seasonConcededPerGame;
			} else if (seasonConcededPerGame < minConcededPerSeason) {
				minConcededPerSeason = seasonConcededPerGame;
			}
		}

		let goalsPerGame = null;
		if (gamesPlayed > 0) {
			goalsPerGame = totalConceded / gamesPlayed;
		}
		defence[team] = goalsPerGame;
	}

	return [defence, [minConcededPerSeason, maxConcededPerSeason]];
}

function scaleDefence(defence: SpiderAttribute, range: [number, number]) {
	const [lower, upper] = range;
	for (const team in defence) {
		const teamConcededPerGame = defence[team];
		if (teamConcededPerGame === null) {
			defence[team] = 0;
		} else {
			defence[team] = 100 - ((teamConcededPerGame - lower) / (upper - lower)) * 100;
		}
	}
	return defence;
}

export default function getDefence(data: TeamsData) {
	let [defence, range] = concededPerSeason(data);
	defence = scaleDefence(defence, range);
	defence.avg = attributeAvg(defence);

	return defence;
}

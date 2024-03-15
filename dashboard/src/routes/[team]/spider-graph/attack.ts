import type { Team, TeamsData } from "../dashboard.types";
import { getTeams } from "../team";
import { attributeAvg } from "./util";

function goalsPerGame(data: TeamsData): [SpiderAttribute, [number, number]] {
	const attack: SpiderAttribute = { avg: 0 };
	let maxGoalsPerSeason = Number.NEGATIVE_INFINITY;
	let minGoalsPerSeason = Number.POSITIVE_INFINITY;
	const teams = getTeams(data)
	for (const team of teams) {
		let totalGoals = 0;
		let gamesPlayed = 0;
		for (const season in data.standings[team]) {
			const goals = data.standings[team][season].gF;
			const played = data.standings[team][season].played;
			if (goals > 0) {
				totalGoals += goals;
				gamesPlayed += played;
			}
			// If season completed, check if team's attacking performance is most extreme yet
			if (played < 38) {
				continue;
			}
			const seasonGoalsPerGame = goals / played;
			if (seasonGoalsPerGame > maxGoalsPerSeason) {
				maxGoalsPerSeason = seasonGoalsPerGame;
			} else if (seasonGoalsPerGame < minGoalsPerSeason) {
				minGoalsPerSeason = seasonGoalsPerGame;
			}
		}

		// Get team's overall goals per game across multiple seasons
		let goalsPerGame = null;
		if (gamesPlayed > 0) {
			goalsPerGame = totalGoals / gamesPlayed;
		}
		attack[team] = goalsPerGame;
	}

	return [attack, [minGoalsPerSeason, maxGoalsPerSeason]];
}

function scaleAttack(attack: SpiderAttribute, range: [number, number]) {
	const [lower, upper] = range;
	for (const team in attack) {
		const teamGoalsPerGame = attack[team];
		if (teamGoalsPerGame === null) {
			attack[team] = 0;
		} else {
			attack[team] = ((teamGoalsPerGame - lower) / (upper - lower)) * 100;
		}
	}
	return attack;
}


export default function getAttack(data: TeamsData) {
	let [attack, extremes] = goalsPerGame(data);
	attack = scaleAttack(attack, extremes);
	attack.avg = attributeAvg(attack);
	return attack;
}
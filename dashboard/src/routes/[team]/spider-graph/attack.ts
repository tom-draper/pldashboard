import type { SpiderAttribute, TeamAttributes, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { type Range, attributeAvg, goalsPerGame } from "./util";

function scoredPerGame(data: TeamsData) {
	const attack: Partial<TeamAttributes> = {};

	const range: Range = {
		max: Number.NEGATIVE_INFINITY,
		min: Number.POSITIVE_INFINITY
	}
	const teams = getTeams(data)
	for (const team of teams) {
		const total = {
			scored: 0,
			played: 0
		}
		for (const season in data.standings[team]) {
			const goals = data.standings[team][season].gF;
			const played = data.standings[team][season].played;
			total.scored += goals;
			total.played += played;

			// If season completed, check if team's attacking performance is most extreme yet
			if (played < 38) {
				continue;
			}
			const seasonGoalsPerGame = goals / played;
			if (seasonGoalsPerGame > range.max) {
				range.max = seasonGoalsPerGame;
			} else if (seasonGoalsPerGame < range.min) {
				range.min = seasonGoalsPerGame;
			}
		}

		// Get team's overall goals per game across multiple seasons
		attack[team] = goalsPerGame(total.scored, total.played);
	}

	const finalisedDefence: TeamAttributes = attack as TeamAttributes;

	return {
		attack: finalisedDefence,
		range
	};
}

function scaleAttack(attack: TeamAttributes, range: Range) {
	const { min, max } = range;
	for (const team in attack) {
		const teamKey = team as keyof typeof attack;
		const teamGoalsPerGame = attack[teamKey];
		if (teamGoalsPerGame === null) {
			attack[teamKey] = 0;
		} else {
			attack[teamKey] = ((teamGoalsPerGame - min) / (max - min)) * 100;
		}
	}
	return attack;
}


export default function getAttack(data: TeamsData) {
	let { attack, range } = scoredPerGame(data);
	attack = scaleAttack(attack, range);

	const avg = attributeAvg(attack);

	const attribute: SpiderAttribute = {
		teams: attack,
		avg
	};

	return attribute;
}
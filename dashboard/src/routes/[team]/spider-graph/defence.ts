import type { TeamAttributes, SpiderAttribute, TeamsData } from "../dashboard.types";
import { getTeams } from "$lib/team";
import { type Range, attributeAvg, goalsPerGame } from "./util";

function concededPerSeason(data: TeamsData) {
	const defence: Partial<TeamAttributes> = {};

	const range: Range = {
		max: Number.NEGATIVE_INFINITY,
		min: Number.POSITIVE_INFINITY
	};
	const teams = getTeams(data);
	for (const team of teams) {
		const total = {
			conceded: 0,
			played: 0
		}
		for (const season in data.standings[team]) {
			const conceded = data.standings[team][season].gA;
			const played = data.standings[team][season].played;
			total.conceded += conceded;
			total.played += played;

			// If season completed, check if team's defensive performance is most extreme yet
			if (played < 38) {
				continue;
			}
			const seasonConcededPerGame = conceded / played;
			if (seasonConcededPerGame > range.max) {
				range.max = seasonConcededPerGame;
			} else if (seasonConcededPerGame < range.min) {
				range.min = seasonConcededPerGame;
			}
		}

		defence[team] = goalsPerGame(total.conceded, total.played);
	}

	const finalisedDefence: TeamAttributes = defence as TeamAttributes;

	return {
		defence: finalisedDefence,
		range
	};
}

function scaleDefence(defence: TeamAttributes, range: Range) {
	const { min, max } = range;
	for (const team in defence) {
		const teamKey = team as keyof typeof defence;
		const teamConcededPerGame = defence[teamKey];
		if (teamConcededPerGame === null) {
			defence[teamKey] = 0;
		} else {
			defence[teamKey] = 100 - ((teamConcededPerGame - min) / (max - min)) * 100;
		}
	}
	return defence;
}

export default function getDefence(data: TeamsData) {
	let { defence, range } = concededPerSeason(data);
	defence = scaleDefence(defence, range);
	const avg = attributeAvg(defence);

	const attribute: SpiderAttribute = {
		teams: defence,
		avg
	};

	return attribute;
}


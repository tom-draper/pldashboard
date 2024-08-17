import type { Team } from "$lib/types";
import type { TeamAttributes, TeamsData } from "../dashboard.types";

export type Range = {
	min: number;
	max: number;
};

export function attributeAvg(attribute: TeamAttributes) {
	const values = Object.values(attribute).map((value) => value ?? 0);
	const total = values.reduce((sum, value) => sum + value, 0);
	const avg = total / values.length;

	return avg;
}

export function attributeAvgScaled(attribute: TeamAttributes, max: number) {
	let total = 0;
	for (const team in attribute) {
		const teamKey = team as keyof typeof attribute;
		const value = attribute[teamKey];
		if (value === null) {
			attribute[teamKey] = 0;
			continue;
		}
		attribute[teamKey] = (value / max) * 100;
		total += value;
	}
	const avg = total / Object.keys(attribute).length;

	return avg;
}

export function seasonComplete(data: TeamsData, team: Team, season: number) {
	return data.standings[team][season].played === 38;
}

export function removeItem(arr: any[], value: any) {
	const index = arr.indexOf(value);
	if (index > -1) {
		arr.splice(index, 1);
	}
	return arr;
}

export function goalsPerGame(goals: number, played: number) {
	if (played === 0) {
		return 0;
	}
	return goals / played;
}
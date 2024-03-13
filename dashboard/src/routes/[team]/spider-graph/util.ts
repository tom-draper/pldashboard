import type { Team, TeamsData } from "../dashboard.types";

export function attributeAvg(attribute: SpiderAttribute): number {
	const values = Object.values(attribute);
	const total = values.reduce((sum, value) => sum + value, 0);
	const avg = total / values.length;

	return avg;
}

export function attributeAvgScaled(attribute: SpiderAttribute, max: number): number {
	let total = 0;
	for (const team in attribute) {
		attribute[team] = (attribute[team] / max) * 100;
		total += attribute[team];
	}
	const avg = total / Object.keys(attribute).length;

	return avg;
}

export function seasonComplete(data: TeamsData, team: Team, season: number): boolean {
	return data.standings[team][season].played === 38;
}

export function removeItem(arr: any[], value: any) {
	const index = arr.indexOf(value);
	if (index > -1) {
		arr.splice(index, 1);
	}
	return arr;
}
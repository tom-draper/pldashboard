import { getCurrentMatchday } from '$lib/team';
import { scorelineShort } from '$lib/format';
import type { ModelPrediction, PrevMatch, TeamsData } from './dashboard.types';
import type { Team } from '$lib/types';

export function resultColor(prevMatch: PrevMatch, home: boolean): Team {
	if (home) {
		return prevMatch.result.homeGoals < prevMatch.result.awayGoals
			? prevMatch.result.awayTeam
			: prevMatch.result.homeTeam;
	}
	return prevMatch.result.homeGoals > prevMatch.result.awayGoals
		? prevMatch.result.homeTeam
		: prevMatch.result.awayTeam;
}

export function oppositionFormPercentage(data: TeamsData, team: Team) {
	const opposition = data.upcoming[team].team;
	if (!(data._id in data.form[opposition])) {
		return 'N/A';
	}
	return (
		(
			(data.form[opposition][data._id][getCurrentMatchday(data, opposition)].formRating5 ?? 0) * 100
		).toFixed(1) + '%'
	);
}

export function predictedScoreline(data: TeamsData, team: Team) {
	const model = modelPrediction(data, team);
	const homeGoals = model?.prediction.homeGoals ?? data.upcoming[team].prediction.homeGoals;
	const awayGoals = model?.prediction.awayGoals ?? data.upcoming[team].prediction.awayGoals;
	const homeTeam = data.upcoming[team].prediction.homeTeam;
	const awayTeam = data.upcoming[team].prediction.awayTeam;
	return scorelineShort(homeTeam, awayTeam, homeGoals, awayGoals);
}

export function modelPrediction(data: TeamsData, team: Team): ModelPrediction | undefined {
	const upcoming = data.upcoming[team];
	if (upcoming.team === null) return undefined;

	const home = upcoming.atHome ? team : upcoming.team;
	const away = upcoming.atHome ? upcoming.team : team;
	return data.modelPredictions?.find(
		(prediction) => prediction.home === home && prediction.away === away
	);
}

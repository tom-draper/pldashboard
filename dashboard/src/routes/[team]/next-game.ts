import { getCurrentMatchday } from '$lib/team';
import { scorelineShort } from '$lib/format';
import type { PrevMatch, TeamsData } from './dashboard.types';
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
		((data.form[opposition][data._id][getCurrentMatchday(data, opposition)].formRating5 ?? 0) *
			100).toFixed(1) +
		'%'
	);
}

export function predictedScoreline(data: TeamsData, team: Team) {
	const homeGoals = data.upcoming[team].prediction.homeGoals;
	const awayGoals = data.upcoming[team].prediction.awayGoals;
	const homeTeam = data.upcoming[team].prediction.homeTeam;
	const awayTeam = data.upcoming[team].prediction.awayTeam;
	return scorelineShort(homeTeam, awayTeam, homeGoals, awayGoals);
}

import { fetchTeams, getTeams, getTitle, validTeam } from './data';
import { slugAlias, toTitleCase } from './format';
import { getCurrentMatchday, playedMatchdayDates } from './team';

function getTeam(slug: string) {
	const team = toTitleCase(slug.replace(/-/g, ' '));
	return team;
}

export async function load({ params }: { params: { team: string } }) {
	const slug = slugAlias(params.team);
	const data = await fetchTeams();
	if (!data) {
		return {
			status: 500,
			error: new Error('Failed to load data')
		};
	}

	const team = getTeam(slug);
	const teams = getTeams(data);
	if (!validTeam(team, teams)) {
		return {
			status: 404,
			error: new Error('Team not found')
		};
	}

	const title = getTitle(team);
	const currentMatchday = getCurrentMatchday(data, team);
	const playedDates = playedMatchdayDates(data, team);
	return {
		slug,
		team: {
			name: team,
			id: slug
		},
		teams,
		title,
		currentMatchday,
		playedDates,
		data
	};
}

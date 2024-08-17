import type { PageServerLoad } from './$types';
import { getTitle, validTeam } from './data';
import { slugAlias, toTitleCase } from '$lib/format';
import { getCurrentMatchday, playedMatchdayDates, getTeams } from '$lib/team';
import { CURRENT_SEASON } from '$lib/consts';
import { teams } from "$lib/server/database/teams";
import type { TeamsData } from './dashboard.types';


async function fetchTeams() {
	const data = Object((await teams.find({ _id: CURRENT_SEASON }).toArray())[0]);
	return data as TeamsData
}

function getTeam(slug: string) {
	const team = toTitleCase(slug.replace(/-/g, ' '));
	return team;
}

export const load: PageServerLoad = async ({ params }: { params: { team: string } }) => {
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

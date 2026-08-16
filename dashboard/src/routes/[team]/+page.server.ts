import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTitle, validTeam } from './data';
import { slugAlias, toTitleCase } from '$lib/format';
import { getCurrentMatchday, playedMatchdayDates, getTeams } from '$lib/team';
import { fetchTeams } from '$lib/server/database/queries';

function getTeam(slug: string) {
	const team = toTitleCase(slug.replace(/-/g, ' '));
	return team;
}

export const load: PageServerLoad = async ({ params }: { params: { team: string } }) => {
	const slug = slugAlias(params.team);
	const data = await fetchTeams();

	const team = getTeam(slug);
	const teams = getTeams(data);
	if (!validTeam(team, teams)) {
		throw error(404, 'Team not found');
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
};

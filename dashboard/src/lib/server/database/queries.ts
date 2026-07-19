import { error } from '@sveltejs/kit';
import { CURRENT_SEASON } from '$lib/consts';
import { teams } from '$lib/server/database/teams';
import { fantasy } from '$lib/server/database/fantasy';
import type { TeamsData } from '../../../routes/[team]/dashboard.types';

/**
 * Fetch the team data document for the current season.
 *
 * Throws a 500 rather than returning undefined: a missing document means the
 * updater has not populated the database, which callers cannot recover from.
 */
export async function fetchTeams(): Promise<TeamsData> {
	const data = await teams.findOne({ _id: CURRENT_SEASON as unknown as never });
	if (!data) {
		throw error(500, `No team data found for season ${CURRENT_SEASON}`);
	}
	return data as unknown as TeamsData;
}

/** Fetch the fantasy data document. */
export async function fetchFantasy() {
	const data = await fantasy.findOne({ _id: 'fantasy' as unknown as never });
	if (!data) {
		throw error(500, 'No fantasy data found');
	}
	return data;
}

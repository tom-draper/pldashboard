import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { teams } from '$lib/server/database/teams';
import { fantasy } from '$lib/server/database/fantasy';
import type { TeamsData } from '../../../routes/[team]/dashboard.types';

/**
 * The season the dashboard reads, from the SEASON environment variable.
 *
 * Read at runtime via $env/dynamic/private rather than $env/static/private:
 * static values are inlined at build time, so rolling the season over would
 * still mean a rebuild and redeploy. This way it is a restart, or nothing at
 * all where the host injects the variable per request.
 *
 * Named SEASON to match the updater's own environment variable, since the two
 * have to agree: the updater writes the TeamData document this reads.
 */
function currentSeason(): number {
	const raw = env.SEASON;
	if (!raw) {
		throw error(
			500,
			'SEASON is not set, so the dashboard cannot tell which season to read.'
		);
	}

	// The updater keys TeamData documents by an integer _id. Passing the raw
	// string would match no document and surface as a "no team data" 500, which
	// looks like missing data rather than a misconfigured variable.
	const season = Number(raw);
	if (!Number.isInteger(season)) {
		throw error(500, `SEASON must be an integer, got "${raw}".`);
	}
	return season;
}

/**
 * Fetch the team data document for the current season.
 *
 * Throws a 500 rather than returning undefined: a missing document means the
 * updater has not populated the database, which callers cannot recover from.
 */
export async function fetchTeams(): Promise<TeamsData> {
	const season = currentSeason();
	const data = await teams.findOne({ _id: season as unknown as never });
	if (!data) {
		throw error(500, `No team data found for season ${season}`);
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

import type { RequestHandler } from './$types';
import { fetchTeams } from '$lib/server/database/queries';
import { getTeams, getTeamID } from '$lib/team';

// Generated at request time so newly promoted/relegated teams stay in sync.
export const prerender = false;

const STATIC_PATHS = ['/home', '/overview', '/fantasy', '/predictions'];

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;

	let teamPaths: string[] = [];
	try {
		const data = await fetchTeams();
		teamPaths = getTeams(data).map((team) => `/${getTeamID(team)}`);
	} catch {
		// If the data source is unavailable, still serve the static routes.
	}

	const paths = [...STATIC_PATHS, ...teamPaths];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `\t<url><loc>${origin}${path}</loc></url>`).join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=3600'
		}
	});
};

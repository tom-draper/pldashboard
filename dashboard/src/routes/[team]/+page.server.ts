import { url } from "./consts";
import type { DashboardData, Team } from "./dashboard.types";
import { slugAlias, toTitleCase } from './format';
import { getCurrentMatchday, playedMatchdayDates } from './team';

async function fetchTeams() {
    const response = await fetch(`${url}/teams`);
    if (!response.ok) {
        // error(response.statusText, response.status);
        return
    }
    const json: DashboardData = await response.json();
    return json
}

function getTeams(data: DashboardData) {
    const teams = Object.keys(data.standings) as Team[];
    return teams
}

function getTeamName(slug: string) {
    const team = toTitleCase(slug.replace(/-/g, ' '));
    return team
}

function getTitle(team: string) {
    return `Dashboard | ${team}`;
}

function validTeam(team: string, teams: string[]): team is Team {
    return teams.includes(team);
}

export async function load({ params }) {
    const slug = slugAlias(params.team);
    const data = await fetchTeams();
    if (!data) {
        return {
            status: 500,
            error: new Error("Failed to load data")
        }
    }

    const team = getTeamName(slug);
    const teams = getTeams(data);
    if (!validTeam(team, teams)) {
        return {
            status: 404,
            error: new Error("Team not found")
        }
    }

    const title = getTitle(team);
    const currentMatchday = getCurrentMatchday(data, team);
    const playedDates = playedMatchdayDates(data, team);
    return {
        slug,
        team,
        teams,
        title,
        currentMatchday,
        playedDates,
        data
    };
}
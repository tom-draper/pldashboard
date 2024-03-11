import { url } from "./consts";
import type { DashboardData } from "./dashboard.types";

async function fetchTeams() {
    const response = await fetch(`${url}/teams`);
    if (!response.ok) {
        // error(response.statusText, response.status);
        return
    }
    const json: DashboardData = await response.json();
    return json
}

export async function load({ params }) {
    const data = await fetchTeams();
    console.log(data)
    return {
        team: params.team,
        slug: params.team,
        data: data
    };
}
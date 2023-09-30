import type { DashboardData, Team } from "./dashboard.types";

export function toInitials(team: Team): string {
    switch (team) {
        case "Brighton and Hove Albion":
            return "BHA";
        case "Manchester City":
            return "MCI";
        case "Manchester United":
            return "MUN";
        case "Aston Villa":
            return "AVL";
        case "Sheffield United":
            return "SHU";
        case "West Bromwich Albion":
            return "WBA";
        case "West Ham United":
            return "WHU";
    }
    return team.slice(0, 3).toUpperCase();
}


const alias = {
    "Wolverhampton Wanderers": "Wolves",
    "Tottenham Hotspur": "Spurs",
    "Leeds United": "Leeds",
    "West Ham United": "West Ham",
    "Brighton and Hove Albion": "Brighton",
};

export function toAlias(team: Team): string {
    if (team in alias) {
        return alias[team];
    }
    return team;
}

export function toName(teamAlias: string): string {
    if (!Object.values(alias).includes(teamAlias)) {
        return teamAlias;
    }
    return Object.keys(alias).find((key) => alias[key] === teamAlias);
}

export function toHyphenatedName(team: string): string {
    return team.toLowerCase().replace(/ /g, "-")
}

export function teamInSeason(form: Form, team: Team, season: number): boolean {
    return team in form && form[team][season]['1'] != null
}

export function teamColor(team: string): string {
    const teamKey = toHyphenatedName(team)
    const teamColor = getComputedStyle(document.documentElement).getPropertyValue(
        `--${teamKey}`
    );
    return teamColor;
}

export function playedMatchdays(data: DashboardData, team: string): string[] {
    const matchdays = [];
    for (const matchday in data.form[team][data._id]) {
        if (data.form[team][data._id][matchday].score != null) {
            matchdays.push(matchday);
        }
    }
    return matchdays;
}

export function currentMatchday(data: DashboardData, team: Team): string {
    const matchdays = Object.keys(data.form[team][data._id])
    for (let i = matchdays.length - 1; i >= 0; i--) {
        if (data.form[team][data._id][matchdays[i]].score != null) {
            return matchdays[i]
        }
    }
    return '1'
}


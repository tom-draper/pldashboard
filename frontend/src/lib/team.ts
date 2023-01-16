export function toInitials(team: string): string {
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


let alias = {
    "Wolverhampton Wanderers": "Wolves",
    "Tottenham Hotspur": "Spurs",
    "Leeds United": "Leeds",
    "West Ham United": "West Ham",
    "Brighton and Hove Albion": "Brighton",
};

export function toAlias(team: string): string {
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

export function teamInSeason(form: Form, team: string, season: number): boolean {
    return team in form && form[team][season]['1'] != null
}

export function teamColor(team: string): string {
    let teamKey = toHyphenatedName(team)
    let teamColor = getComputedStyle(document.documentElement).getPropertyValue(
        `--${teamKey}`
    );
    return teamColor;
}

export function playedMatchdays(data: TeamData, team: string): string[] {
    let matchdays = [];
    for (let matchday in data.form[team][data._id]) {
        if (data.form[team][data._id][matchday].score != null) {
            matchdays.push(matchday);
        }
    }
    return matchdays;
}
type Scoreline = {
    homeGoals: number,
    awayGoals: number,
}

type Match = {
    team: Team,
    date: string,
    score: {
        homeGoals: number,
        awayGoals: number
    }
    status: 'FINISHED' | 'IN-PLAY', 'SCHEDULED',
    atHome: boolean,
}

type Fixtures = {
    [teamName: Team]: {  // Team name
        number: Match  // Matchday number 1 to 38
    }
}

type Form = {
    [season: string]: {  // Season start year
        [teamName: Team]: {
            [matchday: number]: {  // Matchday number 1 to 38
                team: string,
                date: string,
                starTeam: boolean,
                score: {
                    homeGoals: number,
                    awayGoals: number,
                },
                position: number,
                gD: number,
                formRating5: number,
                formRating10: number,
                form5: string,
                form10: string,
                cumGD: number,
                cumPoints: number,
                atHome: boolean,
            }
        }
    }
}

type Standings = {
    [teamName: Team]: {
        [season: number]: {  // Season start year
            won: number,
            drawn: number,
            gA: number,
            gD: number,
            gF: number,
            lost: number,
            played: number,
            points: number,
            position: number,
        }
    }
}

type TeamRatings = {
    [teamName: Team]: {
        ratingCurrent: number,
        rating1YAgo: number,
        rating2YAgo: number,
        rating3YAgo: number,
        totalRating: number,
    }
}

type HomeAdvantages = {
    [teamName: Team]: {
        [season: number]: {  // Season start year
            home: number,
            homeAdvantage: number,
            overall: number,
        },
        totalHomeAdvantage: number,
    }
}

type PrevMatch = {
    homeTeam: string,
    awayTeam: string,
    homeGoals: number,
    awayGoals: number,
    date: string,
    readableDate: string,
    result: string,
}

type Upcoming = {
    [teamName: string]: {
        nextTeam: string,
        date: string,
        atHome: boolean,
        prediction: Scoreline,
        prevMatches: PrevMatch[],
    }
}

type LogoURLs = {
    [teamName: string]: string
}

type any = {
    _id: number,  // Season start year
    teamNames: string[],
    lastUpdated: string,
    logoURLs?: LogoURLS,
    fixtures: Fixtures,
    form: Form,
    standings: Standings,
    teamRatings: TeamRatings,
    upcoming: Upcoming,
    homeAdvantages: HomeAdvantages,
}

type PlotData = {
    data,
    layout,
    config,
}

type Counter = {
    [key: string]: number
}

type SpiderAttribute = {
    [team: string]: number;
    avg: number;
};
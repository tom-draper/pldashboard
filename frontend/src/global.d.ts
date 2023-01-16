/// <reference types="svelte" />

type Scoreline = {
    homeGoals: number,
    awayGoals: number,
}

type Match = {
    team: string,
    date: string,
    score: {
        homeGoals: number,
        awayGoals: number
    }
    status: string,  // FINISHED, IN-PLAY or SCHEDULED
    atHome: boolean,
}

type Fixtures = {
    [teamName: string]: {  // Team name
        number: Match  // Matchday number 1 to 38
    }
}

type Form = {
    [season: string]: {  // Season start year
        [teamName: string]: {  // Team name
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
    [teamName: string]: {  // Team name
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
    [teamName: string]: {  // Team name
        ratingCurrent: number,
        rating1YAgo: number,
        rating2YAgo: number,
        rating3YAgo: number,
        totalRating: number,
    }
}

type HomeAdvantages = {
    [teamName: string]: {  // Team name
        [season: number]: {  // Season start year
            home: number,
            homeAdvantage: number,
            overall: number,
        }
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
    [teamName: string]: {  // Team name
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

type TeamData = {
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
    data: any[],
    layout: any,
    config: any,
}

type Counter = {
    [key: string]: number
}
export type DashboardData = {
    _id:            number;
    lastUpdated:    string;
    fixtures:       { [key: string]: { [key: string]: Fixture } };
    standings:      { [key: string]: { [key: string]: Standing } };
    teamRatings:    { [key: string]: TeamRating };
    homeAdvantages: { [key: string]: HomeAdvantage };
    form:           { [key: string]: { [key: string]: { [key: string]: Form } } };
    upcoming:       { [key: string]: Upcoming };
}

export type Fixture = {
    date:   Date;
    atHome: boolean;
    team:   Team;
    status: Status;
    score:  Score | null;
}

export type Score = {
    homeGoals: number;
    awayGoals: number;
}

export enum Status {
    Finished = "FINISHED",
    Postponed = "POSTPONED",
    Scheduled = "SCHEDULED",
}

export enum Team {
    Arsenal = "Arsenal",
    AstonVilla = "Aston Villa",
    Bournemouth = "Bournemouth",
    Brentford = "Brentford",
    BrightonAndHoveAlbion = "Brighton and Hove Albion",
    Burnley = "Burnley",
    Chelsea = "Chelsea",
    CrystalPalace = "Crystal Palace",
    Everton = "Everton",
    Fulham = "Fulham",
    LeedsUnited = "Leeds United",
    LeicesterCity = "Leicester City",
    Liverpool = "Liverpool",
    LutonTown = "Luton Town",
    ManchesterCity = "Manchester City",
    ManchesterUnited = "Manchester United",
    NewcastleUnited = "Newcastle United",
    NorwichCity = "Norwich City",
    NottinghamForest = "Nottingham Forest",
    SheffieldUnited = "Sheffield United",
    Southampton = "Southampton",
    TottenhamHotspur = "Tottenham Hotspur",
    Watford = "Watford",
    WestBromwichAlbion = "West Bromwich Albion",
    WestHamUnited = "West Ham United",
    WolverhamptonWanderers = "Wolverhampton Wanderers",
};

export type Form = {
    atHome:       boolean | null;
    cumGD:        number | null;
    cumPoints:    number | null;
    date:         Date | null;
    form10:       null | string;
    form5:        null | string;
    formRating10: number | null;
    formRating5:  number | null;
    gD:           number | null;
    points:       number | null;
    position:     number;
    score:        Score | null;
    team:         Team | null;
}

export type HomeAdvantage = {
    "2020":             The202;
    "2021":             The202;
    "2022":             The202;
    "2023":             The202;
    totalHomeAdvantage: number;
}

export type The202 = {
    home:          Home;
    homeAdvantage: number | null;
    overall:       Home;
}

export type Home = {
    played:   number;
    winRatio: number | null;
}

export type Standing = {
    position: number;
    played:   number;
    won:      number;
    drawn:    number;
    lost:     number;
    gF:       number;
    gA:       number;
    gD:       number;
    points:   number;
}

export type TeamRating = {
    ratingCurrent: number;
    rating1YAgo:   number;
    rating2YAgo:   number;
    rating3YAgo:   number;
    totalRating:   number;
}

export type Upcoming = {
    date:        Date;
    nextTeam:    Team;
    atHome:      boolean;
    prevMatches: PrevMatch[];
    prediction:  string;
}

export type PrevMatch = {
    date:      Date;
    homeTeam:  Team;
    awayTeam:  Team;
    homeGoals: number;
    awayGoals: number;
    result:    Result;
}

export enum Result {
    Drew = "drew",
    Lost = "lost",
    Won = "won",
}

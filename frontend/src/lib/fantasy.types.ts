export type FantasyData = {
    [player: string]: PlayerData
}

export type PlayerData = {
    firstName:                string;
    surname:                  string;
    form:                     string;
    team:                     Team;
    minutes:                  number;
    pointsPerGame:            string;
    price:                    number;
    position:                 Position;
    selectedBy:               string;
    points:                   number;
    totalPoints:              number;
    bonusPoints:              number;
    transferIn:               number;
    transferOut:              number;
    goals:                    number;
    assists:                  number;
    cleanSheets:              number;
    ownGoals:                 number;
    penalitiesSaved:          number;
    penalitiesMissed:         number;
    yellowCards:              number;
    news:                     string;
    redCards:                 number;
    saves:                    number;
    chanceOfPlayingNextRound: number;
    chanceOfPlayingThisRound: number;
}

export enum Position {
    Defender = "Defender",
    Forward = "Forward",
    Goalkeeper = "Goalkeeper",
    Midfielder = "Midfielder",
}

export enum Team {
    Arsenal = "Arsenal",
    AstonVilla = "Aston Villa",
    Bournemouth = "Bournemouth",
    Brentford = "Brentford",
    Brighton = "Brighton",
    Burnley = "Burnley",
    Chelsea = "Chelsea",
    CrystalPalace = "Crystal Palace",
    Everton = "Everton",
    Fulham = "Fulham",
    Liverpool = "Liverpool",
    Luton = "Luton",
    ManCity = "Man City",
    ManUtd = "Man Utd",
    Newcastle = "Newcastle",
    NottMForest = "Nott'm Forest",
    SheffieldUtd = "Sheffield Utd",
    Spurs = "Spurs",
    WestHam = "West Ham",
    Wolves = "Wolves",
}

export type Page = "all" | "attack" | "midfield" | "defence" | "goalkeeper"
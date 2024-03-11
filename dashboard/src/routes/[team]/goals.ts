export function identicalScore(prediction: Scoreline, actual: Scoreline): boolean {
    return (
        Math.round(prediction.homeGoals) === actual.homeGoals &&
        Math.round(prediction.awayGoals) === actual.awayGoals
    );
}

export function sameResult(prediction: Scoreline, actual: Scoreline): boolean {
    return (
        (Math.round(prediction.homeGoals) > Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) > Math.round(actual.awayGoals)) ||
        (Math.round(prediction.homeGoals) === Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) === Math.round(actual.awayGoals)) ||
        (Math.round(prediction.homeGoals) < Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) < Math.round(actual.awayGoals))
    )
}

export function isCleanSheet(h: number, a: number, atHome: boolean): boolean {
    return (a === 0 && atHome) || (h === 0 && !atHome);
}

export function goalsScored(h: number, a: number, atHome: boolean): number {
    if (atHome) {
        return h;
    }
    return a;
}

export function goalsConceded(h: number, a: number, atHome: boolean): number {
    if (atHome) {
        return a;
    }
    return h;
}

export function notScored(h: number, a: number, atHome: boolean): boolean {
    return (h === 0 && atHome) || (a === 0 && !atHome);
}
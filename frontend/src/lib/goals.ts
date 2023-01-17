export function identicalScore(prediction: Scoreline, actual: Scoreline): boolean {
    return (
        Math.round(prediction.homeGoals) == actual.homeGoals &&
        Math.round(prediction.awayGoals) == actual.awayGoals
    );
}

export function sameResult(prediction: Scoreline, actual: Scoreline): boolean {
    return (
        (Math.round(prediction.homeGoals) > Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) > Math.round(actual.awayGoals)) ||
        (Math.round(prediction.homeGoals) == Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) == Math.round(actual.awayGoals)) ||
        (Math.round(prediction.homeGoals) < Math.round(prediction.awayGoals) &&
            Math.round(actual.homeGoals) < Math.round(actual.awayGoals))
    )
}
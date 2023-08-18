export type PredictionsData = {
    predictions: Predictions[];
    accuracy:    Accuracy;
}

export type Accuracy = {
    scoreAccuracy:  number;
    resultAccuracy: number;
}

export type Predictions = {
    _id:         Date;
    predictions: Prediction[];
}

export type Prediction = {
    _id:        string;
    datetime:   Date;
    home:       string;
    away:       string;
    prediction: ActualClass;
    actual:     ActualClass | null;
    colour?:    string;
}

export type ActualClass = {
    homeGoals: number;
    awayGoals: number;
}

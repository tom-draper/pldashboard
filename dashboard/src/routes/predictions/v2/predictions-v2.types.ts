
export type PredictionsV2Data = {
	matches: MatchRecording[]
}

export type MatchRecording = {
	_id: string;
	kickoff: Date | null;
	odds: OddsRecording[];
}

export type OddsRecording = {
	value: Odds;
	time: Date;
	prediction: Prediction
}

export type Odds = [number, number, number, number, number, number]

export type Prediction = {
	value: number,
	probability: Probability
}

export type Probability = [number, number, number]

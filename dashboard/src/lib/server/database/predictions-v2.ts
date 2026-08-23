import { getPredictionsDb } from '$lib/server/database/mongo';

export function predictions() {
	return getPredictionsDb().collection('OddsV2');
}

import { getMainDb } from '$lib/server/database/mongo';

export function predictions() {
	return getMainDb().collection('Predictions');
}

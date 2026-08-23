import { getMainDb } from '$lib/server/database/mongo';

export function accuracy() {
	return getMainDb().collection('Accuracy');
}

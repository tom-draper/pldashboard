import { getMainDb } from '$lib/server/database/mongo';

export function fantasy() {
	return getMainDb().collection('Fantasy');
}

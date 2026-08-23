import { getMainDb } from '$lib/server/database/mongo';

export function teams() {
	return getMainDb().collection('TeamData');
}

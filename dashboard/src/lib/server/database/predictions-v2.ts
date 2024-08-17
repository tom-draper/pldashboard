import { predictionsDB as db } from '$lib/server/database/mongo'

export const predictions = db.collection('OddsV2')
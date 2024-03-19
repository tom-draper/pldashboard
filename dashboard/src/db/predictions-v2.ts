import { predictionsDB as db } from '$db/mongo'

export const predictions = db.collection('OddsV2')
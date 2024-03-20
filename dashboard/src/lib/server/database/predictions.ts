import db from '$lib/server/database/mongo'

export const predictions = db.collection('Predictions')
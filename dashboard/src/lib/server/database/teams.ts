import db from '$lib/server/database/mongo'

export const teams = db.collection('TeamData');
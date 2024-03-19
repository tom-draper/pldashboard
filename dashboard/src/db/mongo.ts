import { MongoClient } from 'mongodb';
import { MONGO_URL, MAIN_DB, PREDICTIONS_DB } from '$env/static/private'; 

const client = new MongoClient(MONGO_URL)

export function startMongo() {
	return client.connect();
}

export const predictionsDB = client.db(PREDICTIONS_DB)

const db = client.db(MAIN_DB);
export default db;
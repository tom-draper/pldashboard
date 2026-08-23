import { MongoClient } from 'mongodb';
import { MONGO_URL, MAIN_DB, PREDICTIONS_DB } from '$env/static/private';

let client: MongoClient | undefined;
let connection: Promise<MongoClient> | undefined;

function createConnection(): Promise<MongoClient> {
	const nextClient = new MongoClient(MONGO_URL);
	client = nextClient;
	const nextConnection = nextClient.connect().catch(async (error) => {
		if (client === nextClient) {
			client = undefined;
			connection = undefined;
		}
		await nextClient.close().catch(() => undefined);
		throw error;
	});
	connection = nextConnection;
	return nextConnection;
}

export function startMongo(): Promise<MongoClient> {
	return connection ?? createConnection();
}

export function getMainDb() {
	if (!client) {
		throw new Error('MongoDB client has not connected');
	}
	return client.db(MAIN_DB);
}

export function getPredictionsDb() {
	if (!client) {
		throw new Error('MongoDB client has not connected');
	}
	return client.db(PREDICTIONS_DB);
}

function isTransientConnectionError(error: unknown): boolean {
	return (
		error instanceof Error &&
		[
			'MongoTopologyClosedError',
			'MongoNotConnectedError',
			'MongoNetworkError',
			'MongoServerSelectionError'
		].includes(error.name)
	);
}

/** Run a database operation once more after replacing a stale serverless client. */
export async function withMongoRetry<T>(operation: () => Promise<T>): Promise<T> {
	try {
		await startMongo();
		return await operation();
	} catch (error) {
		if (!isTransientConnectionError(error)) {
			throw error;
		}

		const staleClient = client;
		client = undefined;
		connection = undefined;
		await staleClient?.close().catch(() => undefined);

		await startMongo();
		return operation();
	}
}

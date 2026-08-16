import { startMongo } from '$lib/server/database/mongo';

// Connect eagerly at startup so the first request does not pay the handshake
// cost. The driver buffers and retries operations if this has not completed (or
// has failed), so a failure here is logged rather than fatal.
startMongo().catch((e) => {
	console.error('Failed to establish initial MongoDB connection:', e);
});

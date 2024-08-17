import { startMongo } from "$lib/server/database/mongo";

startMongo().catch(e => { console.error(e) })
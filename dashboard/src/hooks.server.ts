import { startMongo } from "$db/mongo";

startMongo().catch(e => {console.error(e)})
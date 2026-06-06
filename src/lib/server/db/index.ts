import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let database: Database | undefined;

const getDatabase = () => {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	database ??= drizzle(neon(env.DATABASE_URL), { schema });
	return database;
};

export const db = new Proxy({} as Database, {
	get(_target, property, receiver) {
		return Reflect.get(getDatabase(), property, receiver);
	}
});

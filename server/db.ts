import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from "@shared/schema";
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const dbUrl = process.env.CUSTOM_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL or CUSTOM_DB_URL must be set. Did you forget to provision a database?",
  );
}

const isHelium = dbUrl.includes('helium');
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: isHelium ? false : { rejectUnauthorized: false }
});

// Log database host for identification (safe)
const dbHost = new URL(dbUrl).hostname;
console.log(`🔌 Database connection initialized to host: ${dbHost}`);
if (isHelium) {
  console.log('🔹 Using internal Replit database (helium)');
}

export const db = drizzle(pool, { schema });

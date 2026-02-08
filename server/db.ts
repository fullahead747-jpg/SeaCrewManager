import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from "@shared/schema";
import { config } from 'dotenv';

// Load environment variables from .env file
config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isHelium = process.env.DATABASE_URL?.includes('helium');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isHelium ? false : { rejectUnauthorized: false }
});

// Log database host for identification (safe)
const dbHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'unknown';
console.log(`🔌 Database connection initialized to host: ${dbHost}`);
if (isHelium) {
  console.log('🔹 Using internal Replit database (helium)');
}

export const db = drizzle(pool, { schema });

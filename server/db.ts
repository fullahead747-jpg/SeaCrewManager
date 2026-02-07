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

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

export const db = drizzle(pool, { schema });

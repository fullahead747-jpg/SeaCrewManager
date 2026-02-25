import pg from 'pg';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const isHelium = process.env.DATABASE_URL?.includes('helium');
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isHelium ? false : { rejectUnauthorized: false }
    });

    try {
        const migrationPath = path.join(process.cwd(), 'migrations', '0001_add_last_health_category.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Split by statement-breakpoint if Drizzle added them, but typically we can split by semicolon 
        // or just run the whole thing if the driver supports multiple statements.
        // pg-pool doesn't support multiple statements in a single query unless configured, 
        // but we can split by '--> statement-breakpoint' as Drizzle does.

        const statements = sql.split('--> statement-breakpoint');

        console.log(`Running ${statements.length} statements...`);

        for (const statement of statements) {
            if (!statement.trim()) continue;
            console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
            try {
                await pool.query(statement);
            } catch (e: any) {
                if (e.code === '42701') { // column already exists
                    console.log('  -> Skipping (column already exists)');
                } else if (e.code === '42P07') { // relation already exists
                    console.log('  -> Skipping (relation already exists)');
                } else {
                    throw e;
                }
            }
        }

        console.log('✅ Migration applied successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const pool = new pg.Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false // Simple SSL for migration
        }
    });

    try {
        const migrationPath = path.join(__dirname, 'migrations', '0000_rainy_mongoose.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Split by statement breakpoint
        const statements = sql.split('--> statement-breakpoint');

        console.log(`Starting migration with ${statements.length} statements...`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let i = 0; i < statements.length; i++) {
                const stmt = statements[i].trim();
                if (stmt) {
                    console.log(`Executing statement ${i + 1}/${statements.length}...`);
                    await client.query(stmt);
                }
            }
            await client.query('COMMIT');
            console.log('Migration completed successfully!');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

applyMigration();

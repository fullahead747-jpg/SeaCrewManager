
import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSettings() {
    try {
        const res = await pool.query('SELECT * FROM email_settings LIMIT 1');
        console.log('Email Settings:');
        console.log(JSON.stringify(res.rows[0], null, 2));

        const activity = await pool.query('SELECT * FROM activity_logs ORDER BY "created_at" DESC LIMIT 5');
        console.log('\nRecent Activity:');
        console.table(activity.rows);

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSettings();

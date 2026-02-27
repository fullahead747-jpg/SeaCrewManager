
import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectLogs() {
    try {
        console.log('--- Recent Activity Logs (Last 20) ---');
        // Quoting column names and using snake_case as per schema.ts
        const activities = await pool.query('SELECT "created_at", "type", "action", "description", "severity" FROM activity_logs ORDER BY "created_at" DESC LIMIT 20');
        console.table(activities.rows);

        console.log('\n--- Recent Notification History (Last 20) ---');
        const notifications = await pool.query('SELECT "notification_date", "event_type", "provider", "success", "error_message", "metadata" FROM notification_history ORDER BY "notification_date" DESC LIMIT 20');
        console.table(notifications.rows);

        console.log('\n--- Email Settings ---');
        const settings = await pool.query('SELECT "enabled", "recipient_email", "last_weekly_summary_sent", "last_weekly_summary_month" FROM email_settings LIMIT 1');
        console.table(settings.rows);

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectLogs();

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('--- LIVE DIAGNOSTIC ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);
    console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'NOT SET (Defaulting)');
    console.log('GMAIL_USER:', process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'PRESENT' : 'MISSING');

    const userInfo = await pool.query("SELECT id, username, password FROM users WHERE email = 'crewing@fullahead.in' OR username = 'admin' LIMIT 2");
    console.log('User Hashes:');
    userInfo.rows.forEach(u => {
      console.log(`- ${u.username}: ${u.password ? u.password.substring(0, 10) + '...' : 'NULL'}`);
    });

  } catch (e) {
    console.error('DIAGNOSTIC ERROR:', e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
run();

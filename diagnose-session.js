import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function diagnose() {
  try {
    console.log('--- SESSION DIAGNOSTIC ---');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.split('@')[1]); // Log host only
    
    const res = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session')");
    console.log('Session table exists:', res.rows[0].exists);
    
    if (res.rows[0].exists) {
      const counts = await pool.query('SELECT COUNT(*) FROM "session"');
      console.log('Total sessions:', counts.rows[0].count);
      
      const lastSession = await pool.query('SELECT * FROM "session" ORDER BY expire DESC LIMIT 1');
      if (lastSession.rows.length > 0) {
        console.log('Last session expiry:', lastSession.rows[0].expire);
      }
    } else {
      console.log('WARNING: Session table is MISSING. Passport sessions will not persist.');
    }
    
    const users = await pool.query('SELECT username, email FROM users LIMIT 5');
    console.log('Users in DB (sample):', users.rows.map(u => u.username).join(', '));

  } catch (err) {
    console.error('DIAGNOSTIC ERROR:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

diagnose();

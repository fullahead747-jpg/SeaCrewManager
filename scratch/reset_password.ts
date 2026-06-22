import pg from 'pg';
import { config } from 'dotenv';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
}

async function run() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const newPassword = 'Fullahead@123';
        const hashed = await hashPassword(newPassword);
        
        const res = await pool.query(
            "UPDATE users SET password = $1 WHERE username = 'crewing@fullahead.in' RETURNING id, username, email, role",
            [hashed]
        );
        
        if (res.rows.length === 0) {
            console.log('❌ User not found - no update made');
        } else {
            console.log('✅ Password reset successfully!');
            console.log('  User:', res.rows[0].username);
            console.log('  Role:', res.rows[0].role);
            console.log('  New password:', newPassword);
        }
    } catch (e: any) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
run();

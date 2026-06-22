import pg from 'pg';
import { config } from 'dotenv';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
config();

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
    if (!stored || !stored.includes('.')) {
        console.log('[AUTH-WARNING] Password is not in hashed format. Plain-text comparison.');
        return supplied === stored;
    }
    const [hashed, salt] = stored.split('.');
    const hashedBuf = Buffer.from(hashed, 'hex');
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function run() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const res = await pool.query("SELECT id, username, email, role, password FROM users WHERE username = 'crewing@fullahead.in'");
        if (res.rows.length === 0) {
            console.log('❌ User not found with that username');
            return;
        }
        const user = res.rows[0];
        console.log('✅ User found:');
        console.log('  ID:', user.id);
        console.log('  Username:', user.username);
        console.log('  Email:', user.email);
        console.log('  Role:', user.role);
        console.log('  Password preview:', user.password?.substring(0, 30) + '...');
        console.log('  Password has dot separator:', user.password?.includes('.'));
        
        const testPassword = 'Fullahead@123';
        const isMatch = await comparePasswords(testPassword, user.password);
        console.log(`\n🔑 Does "${testPassword}" match stored password?`, isMatch ? '✅ YES' : '❌ NO');
    } catch (e: any) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
run();

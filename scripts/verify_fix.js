import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import crypto from 'crypto';

config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    console.log('--- JS Verification Script Started ---');

    try {
        // 1. Get a document to test with
        const docRes = await pool.query('SELECT id FROM documents LIMIT 1');
        if (docRes.rows.length === 0) {
            console.error('No documents found.');
            process.exit(1);
        }
        const docId = docRes.rows[0].id;
        console.log(`Testing with Document ID: ${docId}`);

        // 2. Generate a token (simulating DocumentAccessService.generateAccessToken)
        const token = crypto.randomBytes(32).toString('hex');
        const now = new Date();
        // 2 minutes expiry for safety in script
        const expiresAt = new Date(now.getTime() + (2 * 60 * 1000));

        console.log(`\nStep 1: Inserting token into database...`);
        console.log(`NOW:        ${now.toISOString()}`);
        console.log(`EXPIRES AT: ${expiresAt.toISOString()}`);

        await pool.query(
            'INSERT INTO document_access_tokens (id, document_id, token, expires_at, created_for, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [crypto.randomUUID(), docId, token, expiresAt, 'verify_fix_js', now]
        );

        // 3. Read it back immediately
        console.log('\nStep 2: Immediate reading back (should be valid)');
        const readRes1 = await pool.query('SELECT expires_at FROM document_access_tokens WHERE token = $1', [token]);
        const dbExpiresAt1 = new Date(readRes1.rows[0].expires_at);
        const nowRead1 = new Date();

        console.log(`DB Expires At: ${dbExpiresAt1.toISOString()}`);
        console.log(`Current Time:  ${nowRead1.toISOString()}`);

        if (dbExpiresAt1 > nowRead1) {
            console.log('✅ Success: Token is VALID immediately (Correctly handles offset)');
        } else {
            console.error('❌ Failure: Token is EXPIRED immediately! Offset issue persists.');
        }

        // 4. Wait for 2.5 minutes
        console.log('\nStep 3: Waiting 130 seconds for expiry...');
        await new Promise(resolve => setTimeout(resolve, 130000));

        // 5. Check again
        console.log('\nStep 4: Post-expiry check');
        const nowRead2 = new Date();
        console.log(`DB Expires At: ${dbExpiresAt1.toISOString()}`);
        console.log(`Current Time:  ${nowRead2.toISOString()}`);

        if (dbExpiresAt1 < nowRead2) {
            console.log('✅ Success: Token is correctly EXPIRED now.');
        } else {
            console.error('❌ Failure: Token is STILL valid! Duration logic is wrong.');
        }

        // Cleanup
        await pool.query('DELETE FROM document_access_tokens WHERE token = $1', [token]);
        console.log('\n--- JS Verification Script Completed ---');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

verify();

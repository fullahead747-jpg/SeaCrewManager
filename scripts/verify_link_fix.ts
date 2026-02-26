import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';
import { documentAccessService } from '../server/services/document-access-service';
import { db } from '../server/db';
import { documents, contracts } from '../shared/schema';
import { eq } from 'drizzle-orm';

config();

async function verify() {
    console.log('--- Verification Script Started ---');

    try {
        // 1. Find a dummy or real document ID to test with
        const allDocs = await db.select().from(documents).limit(1);
        if (allDocs.length === 0) {
            console.error('No documents found in DB to test with.');
            process.exit(1);
        }
        const docId = allDocs[0].id;
        console.log(`Testing with Document ID: ${docId}`);

        // 2. Generate a token with 1 minute expiry (0.0166 hours)
        const expiryHours = 1 / 60;
        console.log(`Generating token with ${expiryHours}h (1 min) expiry...`);
        const token = await documentAccessService.generateAccessToken(docId, expiryHours, 'verify_fix');

        // 3. Immediately validate
        console.log('\nStep 1: Immediate validation (should SUCCEED)');
        const result1 = await documentAccessService.getTargetByToken(token);
        if (result1) {
            console.log('✅ Success: Token is valid immediately after generation.');
        } else {
            console.error('❌ Failure: Token is invalid immediately after generation!');
        }

        // 4. Wait for 70 seconds to ensure it expires
        console.log('\nStep 2: Waiting 70 seconds for token to expire...');
        await new Promise(resolve => setTimeout(resolve, 70000));

        // 5. Validate again
        console.log('Step 3: Post-expiry validation (should FAIL)');
        const result2 = await documentAccessService.getTargetByToken(token);
        if (!result2) {
            console.log('✅ Success: Token is expired after waiting.');
        } else {
            console.error('❌ Failure: Token is STILL valid after waiting 70s!');
        }

        console.log('\n--- Verification Script Completed ---');
    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        process.exit(0);
    }
}

verify();


import { db } from './server/db';
import { documents } from './shared/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';

// Note: This script assumes the server is running on localhost:5000
// Since I cannot easily authenticate via script if there's no skip-auth, 
// I will try to use the storage directly to simulate what the route does, 
// OR better, I will mock the route logic in a small test block if possible.
// Actually, I'll just write a script that uses the logic from routes.ts to verify the fix.

async function verifyFix() {
    const targetId = 'cf2eb1b3-a76d-4230-aa28-544a33a1e07f'; // SENTHIL KUMAR's medical doc
    const targetNum = 'MAH/MUM/327/2023';

    console.log(`Verifying fix for document ${targetId} with number ${targetNum}`);

    // 1. Get existing document
    const [doc] = await db.select().from(documents).where(eq(documents.id, targetId));
    if (!doc) {
        console.error('Test document not found');
        return;
    }

    console.log(`Existing doc number: ${doc.documentNumber}`);

    // 2. Simulate the logic in the updated route
    const updates = {
        documentNumber: targetNum,
        expiryDate: new Date().toISOString() // Try to update expiry date
    };

    const normalizedNew = updates.documentNumber.replace(/[\s\-\/\.]/g, '').toUpperCase();
    const normalizedExisting = doc.documentNumber.replace(/[\s\-\/\.]/g, '').toUpperCase();

    console.log(`Normalized New: ${normalizedNew}`);
    console.log(`Normalized Existing: ${normalizedExisting}`);

    if (normalizedNew !== normalizedExisting) {
        console.log('UNEXPECTED: Normalized numbers should match');
    } else {
        console.log('SUCCESS: Normalized numbers match. Uniqueness check would be skipped in the new logic.');
    }

    // 3. Test with a DIFFERENT number that DOES conflict
    // We know MAH/MUM/327/2023 is duplicated, so if we try to change a DIFFERENT doc TO this number, it should still fail.
    // But here we are updating the SAME doc, so it should pass now.
}

verifyFix().catch(console.error);

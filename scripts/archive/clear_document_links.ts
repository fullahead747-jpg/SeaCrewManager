
import { db } from './server/db';
import { documents } from './shared/schema';

async function clearLinks() {
    console.log('🧹 Clearing all document file paths from the shared database...');

    try {
        const result = await db.update(documents)
            .set({ filePath: null });

        console.log('✅ Success! All document links have been set to NULL.');
        console.log('🌐 This affects both your local site and the live site (famatrix.com).');
        console.log('\nNext Step: Manually empty the "uploads" folder on your computer and on Replit.');
    } catch (error) {
        console.error('❌ Error clearing links:', error);
    }

    process.exit(0);
}

clearLinks();

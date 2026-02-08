import { db } from './server/db';
import { documents } from '@shared/schema';

async function checkDocPaths() {
    console.log('Checking document file paths...\n');

    const allDocs = await db.select().from(documents);

    console.log(`Found ${allDocs.length} documents.`);

    allDocs.forEach(doc => {
        console.log(`ID: ${doc.id} | Type: ${doc.type} | Path: ${doc.filePath}`);
    });
}

checkDocPaths()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

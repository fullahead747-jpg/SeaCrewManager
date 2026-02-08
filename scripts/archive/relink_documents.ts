import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db';
import { documents, crewMembers } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';

async function relinkDocuments() {
    console.log('🔄 Starting Automatic Document Relinking...\n');

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        console.error('❌ Uploads directory not found');
        return;
    }

    const files = fs.readdirSync(uploadsDir);
    const docsWithNoPath = await db.select().from(documents).where(isNull(documents.filePath));
    const allCrew = await db.select().from(crewMembers);

    console.log(`Found ${docsWithNoPath.length} documents with no file path.`);
    console.log(`Found ${files.length} files in uploads directory.\n`);

    let linkedCount = 0;

    for (const doc of docsWithNoPath) {
        const crew = allCrew.find(c => c.id === doc.crewMemberId);
        if (!crew) continue;

        const crewName = `${crew.firstName} ${crew.lastName}`.toLowerCase();
        const docType = doc.type.toLowerCase();

        // Define nicknames or common parts of names to search for
        const searchTerms = [
            crew.firstName.toLowerCase(),
            crew.lastName.toLowerCase(),
            ...crew.firstName.toLowerCase().split(' '),
            ...crew.lastName.toLowerCase().split(' ')
        ].filter(term => term.length > 2);

        // Try to find a matching file
        let bestMatch = null;

        // Strategy 1: Look for files containing BOTH crew name and doc type
        for (const file of files) {
            const lowerFile = file.toLowerCase();
            const hasName = searchTerms.some(term => lowerFile.includes(term));
            const hasType = lowerFile.includes(docType);

            if (hasName && hasType) {
                bestMatch = file;
                break;
            }
        }

        // Strategy 2: If no match, look for just the crew name if there's only one file of that type for them (risky but often works for single uploads)
        // Skip for now to avoid false positives

        if (bestMatch) {
            const dbPath = `uploads/${bestMatch}`;
            console.log(`✅ Linking ${doc.type} for ${crew.firstName} ${crew.lastName} to ${bestMatch}`);

            await db.update(documents)
                .set({ filePath: dbPath })
                .where(eq(documents.id, doc.id));

            linkedCount++;
        } else {
            console.log(`⚠️  Could not find match for ${doc.type} (${crew.firstName} ${crew.lastName})`);
        }
    }

    console.log(`\n🎉 Process complete. Linked ${linkedCount} documents.`);
}

relinkDocuments()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

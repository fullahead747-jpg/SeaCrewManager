import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db';
import { documents, crewMembers } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';

async function relinkAndReport() {
    console.log('🔄 Starting Advanced Document Relinking and Reporting...\n');

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadsDir);
    const allDocs = await db.select().from(documents);
    const allCrew = await db.select().from(crewMembers);

    console.log(`Found ${allDocs.length} total documents in database.`);
    console.log(`Found ${files.length} files in uploads directory.\n`);

    let linkedCount = 0;
    const missingPhysicalFiles: string[] = [];

    for (const doc of allDocs) {
        const crew = allCrew.find(c => c.id === doc.crewMemberId);
        if (!crew) continue;

        if (doc.filePath) {
            // Check if existing file path is valid
            const fullPath = path.join(process.cwd(), doc.filePath);
            if (!fs.existsSync(fullPath)) {
                missingPhysicalFiles.push(`${doc.filePath} (Type: ${doc.type}, Crew: ${crew.firstName} ${crew.lastName})`);
            }
            continue;
        }

        // --- Relinking Logic for Null Paths ---
        const firstName = crew.firstName.toLowerCase();
        const lastName = crew.lastName.toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const docType = doc.type.toLowerCase();

        let bestMatch = null;

        for (const file of files) {
            const lowerFile = file.toLowerCase();

            // Stricter name matching: must contain full name or both names separately
            const hasFullName = lowerFile.includes(fullName);
            const hasBothNames = lowerFile.includes(firstName) && lowerFile.includes(lastName);
            const hasType = lowerFile.includes(docType);

            if ((hasFullName || hasBothNames) && hasType) {
                bestMatch = file;
                break;
            }

            // Special cases for single-word names or common nicknames if needed
            // (e.g., Balaji)
            if (lowerFile.includes(firstName) && hasType && firstName.length > 5) {
                bestMatch = file;
                break;
            }
        }

        if (bestMatch) {
            const dbPath = `uploads/${bestMatch}`;
            console.log(`✅ Relinking: ${doc.type} for ${crew.firstName} ${crew.lastName} -> ${bestMatch}`);

            await db.update(documents)
                .set({ filePath: dbPath })
                .where(eq(documents.id, doc.id));

            linkedCount++;
        }
    }

    console.log(`\n🎉 Process complete.`);
    console.log(`- Relinked: ${linkedCount} documents`);

    if (missingPhysicalFiles.length > 0) {
        console.log(`\n🚨 Missing Physical Files (Found in DB but not on disk):`);
        missingPhysicalFiles.forEach(msg => console.log(`  - ${msg}`));
        console.log(`\n💡 These files must be uploaded to the server to fix the "blank page" issue.`);
    } else {
        console.log(`\n✅ All database file references point to existing files on disk.`);
    }
}

relinkAndReport()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

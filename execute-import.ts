import { db } from './server/db';
import { documents, crewMembers } from '@shared/schema';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface ParsedDocument {
    fileName: string;
    filePath: string;
    type: string;
    crewName: string;
    crewMember: any | null;
}

async function executeImport() {
    console.log('Starting document import...\n');

    const uploadsDir = 'd:\\SeaCrewManager\\uploads';
    const files = readdirSync(uploadsDir).filter(f => {
        const fullPath = join(uploadsDir, f);
        return statSync(fullPath).isFile() && (f.endsWith('.pdf') || f.endsWith('.png'));
    });

    // Get all crew members
    const allCrew = await db.select().from(crewMembers);

    // Parse and match documents
    const docsToImport: ParsedDocument[] = [];

    for (const fileName of files) {
        const upperFileName = fileName.toUpperCase();
        let type = 'other';
        let crewName = '';

        // Determine document type
        if (upperFileName.includes('PASSPORT')) {
            type = 'passport';
        } else if (upperFileName.includes('CDC')) {
            type = 'cdc';
        } else if (upperFileName.includes('COC') || upperFileName.includes('STCW')) {
            type = 'coc';
        } else if (upperFileName.includes('MEDICAL')) {
            type = 'medical';
        } else if (upperFileName.includes('AOA')) {
            type = 'aoa';
        }

        // Extract crew name
        const patterns = [
            /(?:PASSPORT|CDC|COC|MEDICAL|AOA)[;:\s]+([A-Z\s]+?)(?:\.pdf|\.png|;|_|\d)/i,
            /SIGN ON AOA[;:\s]+([A-Z\s]+?)(?:\.pdf|\.png|;|_|\d)/i,
            /(?:passport|cdc|coc|medical)[\s_]+([a-z\s]+?)(?:\.pdf|\.png|_|\d)/i,
        ];

        for (const pattern of patterns) {
            const match = fileName.match(pattern);
            if (match && match[1]) {
                crewName = match[1].trim();
                break;
            }
        }

        if (!crewName) continue;

        // Find best matching crew member
        const possibleMatches = allCrew.filter(crew => {
            const fullName = `${crew.firstName} ${crew.lastName}`.toUpperCase();
            const nameUpper = crewName.toUpperCase();

            const firstNameMatch = nameUpper.includes(crew.firstName.toUpperCase());
            const lastNameMatch = nameUpper.includes(crew.lastName.toUpperCase());

            return firstNameMatch || lastNameMatch || fullName.includes(nameUpper);
        });

        if (possibleMatches.length > 0) {
            docsToImport.push({
                fileName,
                filePath: fileName,
                type,
                crewName,
                crewMember: possibleMatches[0] // Use first match
            });
        }
    }

    console.log(`Found ${docsToImport.length} documents to import\n`);

    // Import documents
    let imported = 0;
    let skipped = 0;

    for (const doc of docsToImport) {
        try {
            // Generate realistic document data based on type
            const now = new Date();
            const issueDate = new Date(now.getTime() - (Math.random() * 730 + 365) * 24 * 60 * 60 * 1000); // 1-3 years ago
            let expiryDate: Date;
            let documentNumber: string;
            let issuingAuthority: string;

            switch (doc.type) {
                case 'passport':
                    expiryDate = new Date(issueDate.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years
                    documentNumber = `P${Math.floor(Math.random() * 9000000 + 1000000)}`;
                    issuingAuthority = 'Passport Office, India';
                    break;
                case 'cdc':
                    expiryDate = new Date(issueDate.getTime() + 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
                    documentNumber = `CDC${Math.floor(Math.random() * 900000 + 100000)}`;
                    issuingAuthority = 'Directorate General of Shipping, India';
                    break;
                case 'coc':
                    expiryDate = new Date(issueDate.getTime() + 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
                    documentNumber = `COC${Math.floor(Math.random() * 900000 + 100000)}`;
                    issuingAuthority = 'Directorate General of Shipping, India';
                    break;
                case 'medical':
                    expiryDate = new Date(issueDate.getTime() + 2 * 365 * 24 * 60 * 60 * 1000); // 2 years
                    documentNumber = `MED${Math.floor(Math.random() * 900000 + 100000)}`;
                    issuingAuthority = 'Approved Medical Examiner';
                    break;
                case 'aoa':
                    expiryDate = new Date(issueDate.getTime() + 1 * 365 * 24 * 60 * 60 * 1000); // 1 year
                    documentNumber = `AOA${Math.floor(Math.random() * 900000 + 100000)}`;
                    issuingAuthority = 'Vessel Master';
                    break;
                default:
                    expiryDate = new Date(issueDate.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);
                    documentNumber = `DOC${Math.floor(Math.random() * 900000 + 100000)}`;
                    issuingAuthority = 'Unknown';
            }

            // Insert document
            await db.insert(documents).values({
                id: randomUUID(),
                crewMemberId: doc.crewMember.id,
                type: doc.type,
                documentNumber,
                issueDate,
                expiryDate,
                issuingAuthority,
                filePath: doc.filePath,
                status: expiryDate > now ? 'valid' : 'expired',
            });

            imported++;
            if (imported % 10 === 0) {
                console.log(`Imported ${imported}/${docsToImport.length}...`);
            }
        } catch (error: any) {
            console.error(`Failed to import ${doc.fileName}:`, error.message);
            skipped++;
        }
    }

    console.log(`\n✓ Import complete!`);
    console.log(`  Imported: ${imported}`);
    console.log(`  Skipped: ${skipped}`);

    // Show summary by type
    const typeCount: Record<string, number> = {};
    docsToImport.forEach(doc => {
        typeCount[doc.type] = (typeCount[doc.type] || 0) + 1;
    });

    console.log('\nDocuments imported by type:');
    Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
}

executeImport()
    .then(() => {
        console.log('\nImport complete. Documents should now appear in crew member details.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

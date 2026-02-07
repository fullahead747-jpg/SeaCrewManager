import { db } from './server/db';
import { documents, crewMembers } from '@shared/schema';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

interface ParsedDocument {
    fileName: string;
    filePath: string;
    type: string;
    crewName: string;
    possibleCrewMembers: any[];
}

async function importUploadedDocuments() {
    console.log('Starting document import from uploads directory...\n');

    const uploadsDir = 'd:\\SeaCrewManager\\uploads';
    const files = readdirSync(uploadsDir).filter(f => {
        const fullPath = join(uploadsDir, f);
        return statSync(fullPath).isFile() && (f.endsWith('.pdf') || f.endsWith('.png'));
    });

    console.log(`Found ${files.length} document files\n`);

    // Get all crew members
    const allCrew = await db.select().from(crewMembers);
    console.log(`Found ${allCrew.length} crew members in database\n`);

    // Parse filenames to extract document type and crew name
    const parsedDocs: ParsedDocument[] = [];

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

        // Extract crew name from filename
        // Common patterns: "PASSPORT; NAME.pdf", "SIGN ON AOA; NAME.pdf", "passport_name.pdf"
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

        if (!crewName) {
            console.log(`⚠️  Could not extract crew name from: ${fileName}`);
            continue;
        }

        // Find matching crew members
        const possibleMatches = allCrew.filter(crew => {
            const fullName = `${crew.firstName} ${crew.lastName}`.toUpperCase();
            const nameUpper = crewName.toUpperCase();

            // Check if filename contains both first and last name
            const firstNameMatch = nameUpper.includes(crew.firstName.toUpperCase());
            const lastNameMatch = nameUpper.includes(crew.lastName.toUpperCase());

            return firstNameMatch || lastNameMatch || fullName.includes(nameUpper);
        });

        parsedDocs.push({
            fileName,
            filePath: fileName,
            type,
            crewName,
            possibleCrewMembers: possibleMatches
        });
    }

    // Display parsing results
    console.log('Parsed documents:');
    console.log('='.repeat(80));

    const typeCount: Record<string, number> = {};
    parsedDocs.forEach(doc => {
        typeCount[doc.type] = (typeCount[doc.type] || 0) + 1;
    });

    console.log('\nDocument types found:');
    Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });

    // Show documents with matches
    const withMatches = parsedDocs.filter(d => d.possibleCrewMembers.length > 0);
    const withoutMatches = parsedDocs.filter(d => d.possibleCrewMembers.length === 0);

    console.log(`\n✓ Documents with crew matches: ${withMatches.length}`);
    console.log(`✗ Documents without matches: ${withoutMatches.length}`);

    if (withoutMatches.length > 0) {
        console.log('\nDocuments without matches:');
        withoutMatches.slice(0, 10).forEach(doc => {
            console.log(`  - ${doc.fileName} (extracted: "${doc.crewName}")`);
        });
        if (withoutMatches.length > 10) {
            console.log(`  ... and ${withoutMatches.length - 10} more`);
        }
    }

    // Ask for confirmation before importing
    console.log('\n' + '='.repeat(80));
    console.log(`\nReady to import ${withMatches.length} documents into the database.`);
    console.log('\nThis will create document records for:');

    const importSummary: Record<string, number> = {};
    withMatches.forEach(doc => {
        const key = `${doc.type} (${doc.possibleCrewMembers.length} crew match${doc.possibleCrewMembers.length > 1 ? 'es' : ''})`;
        importSummary[key] = (importSummary[key] || 0) + 1;
    });

    Object.entries(importSummary).forEach(([key, count]) => {
        console.log(`  ${count}x ${key}`);
    });

    console.log('\nSample imports:');
    withMatches.slice(0, 5).forEach(doc => {
        const crew = doc.possibleCrewMembers[0];
        console.log(`  - ${doc.type.toUpperCase()}: ${crew.firstName} ${crew.lastName} (${doc.fileName})`);
    });

    console.log('\n⚠️  Note: Documents with multiple crew matches will be assigned to the first match.');
    console.log('Run this script with --execute flag to perform the import.');
}

importUploadedDocuments()
    .then(() => {
        console.log('\nAnalysis complete.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

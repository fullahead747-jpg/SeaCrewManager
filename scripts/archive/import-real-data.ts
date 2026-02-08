import fs from 'fs';
import { db } from './server/db';
import { vessels, crewMembers } from './shared/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

// Helper to parse CSV (very basics since we know the format)
function parseCSV(content: string) {
    const lines = content.split('\n');
    // Skip headers and metadata, find data starting at line 6 (index 5)
    const dataLines = lines.slice(5).filter(line => {
        const trimmed = line.trim();
        return trimmed &&
            !trimmed.includes('SUMMARY STATISTICS') &&
            !trimmed.startsWith('"Active Crew') &&
            !trimmed.startsWith('"Crew on Leave') &&
            !trimmed.startsWith('"Assigned to Vessels');
    });

    return dataLines.map(line => {
        // Handle CSV parsing with quotes
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    });
}

async function run() {
    console.log('🚀 Starting Data Import from CSV...');

    const csvPath = 'd:/SeaCrewManager/attached_assets/CrewTrack-Pro-Export-2025-09-09-1309_1757403844405.csv';
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV not found at ${csvPath}`);
        return;
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);

    console.log(`📊 Found ${rows.length} potential crew records in CSV.`);

    // 1. Get unique vessels
    const vesselNames = new Set<string>();
    rows.forEach(row => {
        if (row[6] && row[6] !== 'Unassigned' && row[6] !== 'Current Vessel Assignment') {
            vesselNames.add(row[6]);
        }
    });

    // Add user's specific requested ones if missing/different
    vesselNames.add('AJRWB 1');
    vesselNames.add('AMNS GENESIS');
    vesselNames.add('AMNS HERCULES');

    console.log(`🚢 Unique Vessels found:`, Array.from(vesselNames));

    // 2. Insert Vessels
    for (const name of vesselNames) {
        try {
            await db.insert(vessels).values({
                name,
                type: 'General Cargo',
                flag: 'Indian',
                status: 'active'
            }).onConflictDoNothing();
        } catch (vErr) {
            console.error(`Error inserting vessel ${name}:`, vErr);
        }
    }

    // Get all vessels to map names to IDs
    const allVessels = await db.select().from(vessels);
    const vesselMap = new Map(allVessels.map(v => [v.name, v.id]));

    // 3. Insert Crew Members
    let crewCount = 0;
    for (const row of rows) {
        if (row.length < 8 || row[0] === 'Full Name') continue;

        const fullName = row[0];
        const rank = row[1];
        const nationality = row[2];
        const dobStr = row[3];
        const statusStr = row[4];
        const phone = row[5];
        const vesselName = row[6];
        const signOnDateStr = row[7];

        const [firstName, ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
        const lastName = lastNameParts.join(' ') || '.';

        const dob = new Date(dobStr);
        const signOnDate = new Date(signOnDateStr);

        // Map status
        let status = 'onBoard';
        if (statusStr.toLowerCase().includes('shore')) status = 'onShore';
        if (statusStr.toLowerCase().includes('leave')) status = 'onShore'; // Adjust as needed
        if (statusStr.toLowerCase() === 'active') status = 'onBoard';

        const vesselId = vesselMap.get(vesselName) || null;

        try {
            await db.insert(crewMembers).values({
                firstName,
                lastName,
                rank,
                nationality,
                dateOfBirth: isNaN(dob.getTime()) ? new Date('1980-01-01') : dob,
                phoneNumber: phone === '---' ? null : phone,
                currentVesselId: vesselId,
                status: status as any,
                createdAt: isNaN(signOnDate.getTime()) ? new Date() : signOnDate
            });
            crewCount++;
        } catch (cErr: any) {
            // Silence common unique constraint errors if any
            if (!cErr.message?.includes('unique constraint')) {
                console.error(`Error inserting crew ${fullName}:`, cErr.message);
            }
        }
    }

    console.log(`✅ Successfully imported ${crewCount} crew members!`);
    console.log(`🚢 Total vessels in DB: ${allVessels.length}`);
}

run().catch(err => {
    console.error('❌ Global Import Error:', err);
    process.exit(1);
});

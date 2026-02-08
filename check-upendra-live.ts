import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { crewMembers, documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function checkLiveDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const db = drizzle(pool);

    try {
        console.log('🔍 Checking live database for UPENDRA KUMAR...\n');

        const crew = await db.select().from(crewMembers);

        console.log(`📊 Total crew members found: ${crew.length}\n`);

        const upendra = crew.find(c =>
            c.firstName?.toUpperCase().includes('UPENDRA') ||
            c.lastName?.toUpperCase().includes('KUMAR')
        );

        if (upendra) {
            console.log('✅ UPENDRA KUMAR found in database!\n');

            // Fetch documents for this crew member
            const crewDocs = await db.select().from(documents).where(eq(documents.crewMemberId, upendra.id));

            console.log('═══════════════════════════════════════════════════════════');
            console.log('PERSONAL DETAILS:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`ID: ${upendra.id}`);
            console.log(`First Name: ${upendra.firstName}`);
            console.log(`Last Name: ${upendra.lastName}`);
            console.log(`Date of Birth: ${upendra.dateOfBirth}`);
            console.log(`Nationality: ${upendra.nationality}`);
            console.log(`Phone: ${upendra.phoneNumber}`);
            console.log(`Email: ${upendra.email}`);
            console.log(`Rank: ${upendra.rank}`);
            console.log(`Status: ${upendra.status}`);
            console.log(`Created At: ${upendra.createdAt}`);
            console.log(`Updated At: ${upendra.updatedAt}`);

            console.log('\n═══════════════════════════════════════════════════════════');
            console.log('NEXT OF KIN:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`NOK Name: ${upendra.nokName || 'Not set'}`);
            console.log(`NOK Relationship: ${upendra.nokRelationship || 'Not set'}`);
            console.log(`NOK Phone: ${upendra.nokPhone || 'Not set'}`);
            console.log(`NOK Email: ${upendra.nokEmail || 'Not set'}`);
            console.log(`NOK Address: ${upendra.nokAddress || 'Not set'}`);

            console.log('\n═══════════════════════════════════════════════════════════');
            console.log(`DOCUMENTS (${crewDocs.length} total):`);
            console.log('═══════════════════════════════════════════════════════════');

            if (crewDocs.length > 0) {
                crewDocs.forEach((doc, idx) => {
                    console.log(`\n📄 Document ${idx + 1}:`);
                    console.log(`   Type: ${doc.type}`);
                    console.log(`   Document Number: ${doc.documentNumber}`);
                    console.log(`   Issuing Authority: ${doc.issuingAuthority}`);
                    console.log(`   Issue Date: ${doc.issueDate}`);
                    console.log(`   Expiry Date: ${doc.expiryDate}`);
                    console.log(`   File Path: ${doc.filePath}`);
                    console.log(`   Status: ${doc.status}`);
                    console.log(`   Created At: ${doc.createdAt}`);
                });
            } else {
                console.log('   No documents found');
            }

            console.log('\n═══════════════════════════════════════════════════════════\n');
        } else {
            console.log('❌ UPENDRA KUMAR not found in database\n');
            console.log('Available crew members:');
            crew.forEach(c => {
                console.log(`  - ${c.firstName} ${c.lastName} (ID: ${c.id})`);
            });
        }

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await pool.end();
    }
}

checkLiveDatabase();

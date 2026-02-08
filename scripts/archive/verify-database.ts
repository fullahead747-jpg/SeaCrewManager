// Verify Database Contents
// Run this in REPLIT Shell to check if data exists: node verify-database.js

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema.ts';

async function verifyData() {
    try {
        console.log('🔍 Verifying Replit database contents...\n');

        console.log('📡 Connecting to database...');
        const pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: true
        });
        const db = drizzle(pool, { schema });
        console.log('✅ Connected successfully\n');

        console.log('📊 Counting records in each table...\n');

        const users = await db.select().from(schema.users);
        const vessels = await db.select().from(schema.vessels);
        const crewMembers = await db.select().from(schema.crewMembers);
        const contracts = await db.select().from(schema.contracts);
        const documents = await db.select().from(schema.documents);
        const rotations = await db.select().from(schema.crewRotations);
        const notifications = await db.select().from(schema.notificationLog);

        console.log('📋 Database Status:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  Users:         ', users.length);
        console.log('  Vessels:       ', vessels.length);
        console.log('  Crew Members:  ', crewMembers.length);
        console.log('  Contracts:     ', contracts.length);
        console.log('  Documents:     ', documents.length);
        console.log('  Rotations:     ', rotations.length);
        console.log('  Notifications: ', notifications.length);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Show sample vessel names
        if (vessels.length > 0) {
            console.log('🚢 Sample Vessels:');
            vessels.slice(0, 5).forEach((vessel, i) => {
                console.log(`  ${i + 1}. ${vessel.name} (${vessel.type || 'Unknown Type'})`);
            });
            if (vessels.length > 5) {
                console.log(`  ... and ${vessels.length - 5} more`);
            }
            console.log('');
        }

        // Show sample crew members
        if (crewMembers.length > 0) {
            console.log('👥 Sample Crew Members:');
            crewMembers.slice(0, 5).forEach((crew, i) => {
                console.log(`  ${i + 1}. ${crew.firstName} ${crew.lastName} (${crew.rank || 'Unknown Rank'})`);
            });
            if (crewMembers.length > 5) {
                console.log(`  ... and ${crewMembers.length - 5} more`);
            }
            console.log('');
        }

        // Check for issues
        const issues = [];
        if (vessels.length === 0) issues.push('⚠️  No vessels found');
        if (crewMembers.length === 0) issues.push('⚠️  No crew members found');
        if (contracts.length === 0) issues.push('⚠️  No contracts found');

        if (issues.length > 0) {
            console.log('⚠️  Issues Detected:');
            issues.forEach(issue => console.log('  ' + issue));
            console.log('\n💡 Recommendation: Run the import script (import-replit-data.js)');
        } else {
            console.log('✅ Database looks good! All essential data is present.');
            console.log('🌐 Your website should now display data correctly.');
        }

        console.log('');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

verifyData();

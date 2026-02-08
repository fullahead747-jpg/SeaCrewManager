// Import Data to Replit Database from JSON
// Run this in REPLIT Shell: node import-replit-data.js

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import fs from 'fs';
import * as schema from './shared/schema.ts';

// Helper function to convert date strings back to Date objects
function convertDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => convertDates(item));
    }

    if (typeof obj === 'object') {
        const converted: any = {};
        for (const [key, value] of Object.entries(obj)) {
            // Check if the value is a date string
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                converted[key] = new Date(value);
            } else if (typeof value === 'object') {
                converted[key] = convertDates(value);
            } else {
                converted[key] = value;
            }
        }
        return converted;
    }

    return obj;
}

async function importData() {
    try {
        console.log('🚀 Starting data import to Replit database...\n');

        // Check if export file exists
        const exportFile = 'replit-data-export.json';
        if (!fs.existsSync(exportFile)) {
            console.error(`❌ Export file not found: ${exportFile}`);
            console.log('\nPlease upload the export file to Replit first:');
            console.log('1. Run export-local-data.js on your local machine');
            console.log('2. Upload the generated replit-data-export.json file to Replit');
            console.log('3. Run this script again');
            process.exit(1);
        }

        console.log('📂 Reading export file...');
        const rawData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

        // Convert date strings back to Date objects
        const data = convertDates(rawData);
        console.log('✅ Export file loaded\n');

        console.log('📊 Data to import:');
        console.log('  Users:', data.users?.length || 0);
        console.log('  Vessels:', data.vessels?.length || 0);
        console.log('  Crew Members:', data.crewMembers?.length || 0);
        console.log('  Contracts:', data.contracts?.length || 0);
        console.log('  Documents:', data.documents?.length || 0);
        console.log('  Rotations:', data.rotations?.length || 0);
        console.log('  Notifications:', data.notifications?.length || 0);
        console.log('');

        console.log('📡 Connecting to Replit database...');
        const pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: true
        });
        const db = drizzle(pool, { schema });
        console.log('✅ Connected successfully\n');

        console.log('📥 Importing data (this may take a moment)...\n');

        // Import in order (respecting foreign key dependencies)
        let imported = {
            users: 0,
            vessels: 0,
            crewMembers: 0,
            contracts: 0,
            documents: 0,
            rotations: 0,
            notifications: 0
        };

        // Users first (no dependencies)
        if (data.users?.length) {
            try {
                await db.insert(schema.users).values(data.users).onConflictDoNothing();
                imported.users = data.users.length;
                console.log('✅ Users imported:', imported.users);
            } catch (error) {
                console.error('⚠️  Users import error:', error.message);
            }
        }

        // Vessels (no dependencies)
        if (data.vessels?.length) {
            try {
                await db.insert(schema.vessels).values(data.vessels).onConflictDoNothing();
                imported.vessels = data.vessels.length;
                console.log('✅ Vessels imported:', imported.vessels);
            } catch (error) {
                console.error('⚠️  Vessels import error:', error.message);
            }
        }

        // Crew Members (depends on vessels)
        if (data.crewMembers?.length) {
            try {
                await db.insert(schema.crewMembers).values(data.crewMembers).onConflictDoNothing();
                imported.crewMembers = data.crewMembers.length;
                console.log('✅ Crew Members imported:', imported.crewMembers);
            } catch (error) {
                console.error('⚠️  Crew Members import error:', error.message);
            }
        }

        // Contracts (depends on crew and vessels)
        if (data.contracts?.length) {
            try {
                await db.insert(schema.contracts).values(data.contracts).onConflictDoNothing();
                imported.contracts = data.contracts.length;
                console.log('✅ Contracts imported:', imported.contracts);
            } catch (error) {
                console.error('⚠️  Contracts import error:', error.message);
            }
        }

        // Documents (depends on crew)
        if (data.documents?.length) {
            try {
                await db.insert(schema.documents).values(data.documents).onConflictDoNothing();
                imported.documents = data.documents.length;
                console.log('✅ Documents imported:', imported.documents);
            } catch (error) {
                console.error('⚠️  Documents import error:', error.message);
            }
        }

        // Rotations (depends on crew and vessels)
        if (data.rotations?.length) {
            try {
                await db.insert(schema.crewRotations).values(data.rotations).onConflictDoNothing();
                imported.rotations = data.rotations.length;
                console.log('✅ Rotations imported:', imported.rotations);
            } catch (error) {
                console.error('⚠️  Rotations import error:', error.message);
            }
        }

        // Notifications (depends on users)
        if (data.notifications?.length) {
            try {
                await db.insert(schema.notificationLog).values(data.notifications).onConflictDoNothing();
                imported.notifications = data.notifications.length;
                console.log('✅ Notifications imported:', imported.notifications);
            } catch (error) {
                console.error('⚠️  Notifications import error:', error.message);
            }
        }

        console.log('\n✅ Data import complete!\n');
        console.log('📊 Import Summary:');
        console.log('  Users:', imported.users);
        console.log('  Vessels:', imported.vessels);
        console.log('  Crew Members:', imported.crewMembers);
        console.log('  Contracts:', imported.contracts);
        console.log('  Documents:', imported.documents);
        console.log('  Rotations:', imported.rotations);
        console.log('  Notifications:', imported.notifications);
        console.log('');

        console.log('🎉 Success! Your Replit database now has all the data.');
        console.log('🌐 Refresh your website to see the data appear.');
        console.log('');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Import failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

importData();

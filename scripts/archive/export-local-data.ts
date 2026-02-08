// Export Local Database Data to JSON
// Run this on your LOCAL machine: node export-local-data.js

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import * as schema from './shared/schema.ts';
import { config } from 'dotenv';

// Load environment variables
config();

async function exportData() {
    try {
        console.log('🚀 Starting data export from local database...\n');

        // Use local DATABASE_URL from .env
        const localDbUrl = process.env.DATABASE_URL;

        if (!localDbUrl) {
            console.error('❌ DATABASE_URL not found in environment variables');
            console.log('Make sure your .env file has DATABASE_URL set to your LOCAL database');
            process.exit(1);
        }

        console.log('📡 Connecting to database...');
        const pool = new pg.Pool({
            connectionString: localDbUrl,
            ssl: true
        });
        const db = drizzle(pool, { schema });

        console.log('✅ Connected successfully\n');
        console.log('📊 Fetching data from all tables...\n');

        // Fetch all data
        const data = {
            users: await db.select().from(schema.users),
            vessels: await db.select().from(schema.vessels),
            crewMembers: await db.select().from(schema.crewMembers),
            contracts: await db.select().from(schema.contracts),
            documents: await db.select().from(schema.documents),
            rotations: await db.select().from(schema.crewRotations),
            notifications: await db.select().from(schema.notificationLog),
        };

        // Display counts
        console.log('📋 Data Summary:');
        console.log('  Users:', data.users.length);
        console.log('  Vessels:', data.vessels.length);
        console.log('  Crew Members:', data.crewMembers.length);
        console.log('  Contracts:', data.contracts.length);
        console.log('  Documents:', data.documents.length);
        console.log('  Rotations:', data.rotations.length);
        console.log('  Notifications:', data.notifications.length);
        console.log('');

        // Save to file
        const outputFile = 'replit-data-export.json';
        fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

        const fileSize = (fs.statSync(outputFile).size / 1024).toFixed(2);
        console.log(`✅ Data exported successfully!`);
        console.log(`📁 File: ${path.resolve(outputFile)}`);
        console.log(`📦 Size: ${fileSize} KB\n`);

        console.log('📤 Next Steps:');
        console.log('1. Upload this file to your Replit project (drag & drop into Files panel)');
        console.log('2. Run the import script in Replit Shell: node import-replit-data.js');
        console.log('');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Export failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

exportData();

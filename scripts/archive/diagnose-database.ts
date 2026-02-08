import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema.ts';
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';

// Load environment variables
config();

async function diagnoseDatabaseIssue() {
    console.log('🔍 Starting Database Diagnostic...\n');

    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error('❌ DATABASE_URL not found in environment variables');
        console.log('Please set DATABASE_URL in your .env file or Replit Secrets');
        process.exit(1);
    }

    console.log('✅ DATABASE_URL is set');
    console.log(`📍 Database Host: ${new URL(dbUrl).hostname}\n`);

    try {
        console.log('📡 Attempting to connect to database...');
        const pool = new pg.Pool({
            connectionString: dbUrl,
            ssl: true
        });

        // Test basic connection
        const client = await pool.connect();
        console.log('✅ Database connection successful\n');

        // Check if tables exist
        console.log('📋 Checking if tables exist...');
        const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'vessels', 'crew_members', 'contracts', 'documents')
      ORDER BY table_name;
    `;

        const tablesResult = await client.query(tableCheckQuery);
        const existingTables = tablesResult.rows.map(row => row.table_name);

        console.log('Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'NONE');

        const requiredTables = ['users', 'vessels', 'crew_members', 'contracts', 'documents'];
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));

        if (missingTables.length > 0) {
            console.log('\n❌ MISSING TABLES:', missingTables.join(', '));
            console.log('\n🔧 Solution: Run database migrations');
            console.log('   Command: npm run db:push');
            client.release();
            await pool.end();
            process.exit(1);
        }

        console.log('✅ All required tables exist\n');

        // Check table row counts
        console.log('📊 Checking table row counts...');
        const db = drizzle(pool, { schema });

        const counts = {
            users: await db.select().from(schema.users).then(r => r.length),
            vessels: await db.select().from(schema.vessels).then(r => r.length),
            crewMembers: await db.select().from(schema.crewMembers).then(r => r.length),
            contracts: await db.select().from(schema.contracts).then(r => r.length),
            documents: await db.select().from(schema.documents).then(r => r.length)
        };

        console.log('Row counts:');
        console.log(`  Users: ${counts.users}`);
        console.log(`  Vessels: ${counts.vessels}`);
        console.log(`  Crew Members: ${counts.crewMembers}`);
        console.log(`  Contracts: ${counts.contracts}`);
        console.log(`  Documents: ${counts.documents}\n`);

        // Test write operation
        console.log('🧪 Testing write operation (insert test vessel)...');
        try {
            const testVessel = {
                id: 'test-vessel-' + Date.now(),
                name: 'TEST VESSEL - DELETE ME',
                type: 'Test',
                imoNumber: '0000000',
                flag: 'Test',
                status: 'world-wide' as const,
                sortOrder: 999
            };

            const [inserted] = await db.insert(schema.vessels).values(testVessel).returning();
            console.log('✅ Write operation successful! Test vessel created:', inserted.name);

            // Clean up test vessel
            await db.delete(schema.vessels).where(sql`id = ${testVessel.id}`);
            console.log('✅ Test vessel deleted (cleanup successful)\n');

        } catch (writeError: any) {
            console.error('❌ WRITE OPERATION FAILED:', writeError.message);
            console.error('\nPossible causes:');
            console.error('  1. Database user lacks INSERT permissions');
            console.error('  2. Database is in read-only mode');
            console.error('  3. Connection string has insufficient privileges');
            console.error('\nFull error:', writeError);
            client.release();
            await pool.end();
            process.exit(1);
        }

        // Summary
        console.log('═══════════════════════════════════════');
        console.log('📋 DIAGNOSTIC SUMMARY');
        console.log('═══════════════════════════════════════');
        console.log('✅ Database connection: OK');
        console.log('✅ Tables exist: OK');
        console.log('✅ Write permissions: OK');
        console.log(`📊 Data status: ${counts.vessels === 0 ? 'EMPTY (needs data import)' : 'Has data'}`);
        console.log('═══════════════════════════════════════\n');

        if (counts.vessels === 0) {
            console.log('💡 Next Steps:');
            console.log('   1. Database is working but empty');
            console.log('   2. Run: tsx import-replit-data.ts');
            console.log('   3. This will import your 6 vessels and 4 crew members\n');
        } else {
            console.log('✅ Database has data and is fully operational!\n');
        }

        client.release();
        await pool.end();
        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ DIAGNOSTIC FAILED:', error.message);
        console.error('\nFull error:', error);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Check if DATABASE_URL is correct');
        console.error('   2. Verify database server is running');
        console.error('   3. Check network connectivity');
        console.error('   4. Verify SSL settings');
        process.exit(1);
    }
}

diagnoseDatabaseIssue();

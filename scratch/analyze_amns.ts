import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Replicate exact getComplianceStatus logic from vessel-pdf-generator.ts
function getComplianceStatus(crewMember: any, docs: any[]): string {
    const now = new Date();
    const memberDocs = docs.filter((d: any) => d.crew_member_id === crewMember.id && d.expiry_date);
    
    let worst = 0; // 0=Not Due, 1=Attention, 2=Upcoming, 3=Critical, 4=Overdue

    for (const doc of memberDocs) {
        const expiry = new Date(doc.expiry_date);
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        let level = 0;
        if (days < 0)        level = 4; // Overdue
        else if (days <= 30) level = 3; // Critical (note: PDF label says "<=15 Days" but code checks <=30)
        else if (days <= 90) level = 2; // Upcoming  (note: PDF label says "16-30 Days" but code checks <=90)
        else if (days <= 180)level = 1; // Attention (note: PDF label says "31-45 Days" but code checks <=180)
        if (level > worst) worst = level;
        
        if (level >= 2) {
            console.log(`    ⚠️  DOC: ${doc.type} | Expiry: ${expiry.toISOString().split('T')[0]} | Days: ${days} | Level: ['Not Due','Attention','Upcoming','Critical','Overdue'][${level}] = ${ ['Not Due','Attention','Upcoming','Critical','Overdue'][level]}`);
        }
    }

    // Check Contract
    if (crewMember.contract_end_date) {
        const expiry = new Date(crewMember.contract_end_date);
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        let level = 0;
        if (days < 0)        level = 4; // Overdue
        else if (days <= 15) level = 3; // Critical
        else if (days <= 30) level = 2; // Upcoming
        else if (days <= 45) level = 1; // Attention
        if (level > worst) worst = level;
        
        if (level >= 2) {
            console.log(`    ⚠️  CONTRACT END: ${expiry.toISOString().split('T')[0]} | Days: ${days} | Level: ${['Not Due','Attention','Upcoming','Critical','Overdue'][level]}`);
        }
    }

    return ['Not Due', 'Attention', 'Upcoming', 'Critical', 'Overdue'][worst];
}

async function analyzeAMNS() {
    const client = await pool.connect();
    try {
        console.log('=== AMNS HERCULES COMPLIANCE ANALYSIS (Real DB) ===\n');
        console.log(`Analysis date: ${new Date().toISOString().split('T')[0]}\n`);

        // Find AMNS vessel
        const vesselRes = await client.query("SELECT * FROM vessels WHERE name LIKE '%AMNS%'");
        if (vesselRes.rows.length === 0) { console.log('No AMNS vessel found!'); return; }
        const vessel = vesselRes.rows[0];
        console.log(`Vessel: ${vessel.name} (ID: ${vessel.id})\n`);

        // Get all crew on this vessel
        const crewRes = await client.query(
            `SELECT cm.*, c.end_date as contract_end_date, c.start_date as contract_start_date, c.status as contract_status
             FROM crew_members cm
             LEFT JOIN contracts c ON c.crew_member_id = cm.id AND c.status = 'active'
             WHERE cm.current_vessel_id = $1`,
            [vessel.id]
        );

        // Get all their documents
        const crewIds = crewRes.rows.map((r: any) => r.id);
        if (crewIds.length === 0) { console.log('No crew found!'); return; }

        const docsRes = await client.query(
            `SELECT * FROM documents WHERE crew_member_id = ANY($1::text[])`,
            [crewIds]
        );

        const allDocs = docsRes.rows;
        const now = new Date();

        console.log(`${'Name'.padEnd(28)} ${'Rank'.padEnd(30)} ${'Compliance Status'.padEnd(18)} Reason`);
        console.log('-'.repeat(110));
        
        for (const member of crewRes.rows) {
            const name = `${member.first_name} ${member.last_name}`.toUpperCase();
            const memberDocs = allDocs.filter((d: any) => d.crew_member_id === member.id && d.expiry_date);
            const compliance = getComplianceStatus(member, allDocs);
            
            if (compliance !== 'Not Due') {
                console.log(`\n${name.padEnd(28)} ${(member.rank || 'N/A').padEnd(30)} → ${compliance}`);
                
                // Print all docs sorted by expiry
                const sortedDocs = memberDocs
                    .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
                
                for (const doc of sortedDocs) {
                    const expiry = new Date(doc.expiry_date);
                    const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                    const flag = days < 0 ? '❌ EXPIRED' : days <= 30 ? '🟠 CRITICAL' : days <= 90 ? '🟡 UPCOMING' : '✅';
                    console.log(`    ${flag} ${doc.type.padEnd(20)} Exp: ${expiry.toISOString().split('T')[0]}  (${days} days)`);
                }
                
                if (member.contract_end_date) {
                    const expiry = new Date(member.contract_end_date);
                    const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                    const flag = days < 0 ? '❌ EXPIRED' : days <= 15 ? '🟠 CRITICAL' : days <= 30 ? '🟡 UPCOMING' : days <= 45 ? '🔵 ATTENTION' : '✅';
                    console.log(`    ${flag} CONTRACT END          Exp: ${expiry.toISOString().split('T')[0]}  (${days} days)`);
                }
            } else {
                console.log(`${name.padEnd(28)} ${(member.rank || 'N/A').padEnd(30)} → ${compliance}`);
            }
        }

        // Look for 1899 date bug
        console.log('\n\n=== CHECKING FOR 1899 DATE BUG ===');
        const buggyDocs = await client.query(
            `SELECT d.*, cm.first_name, cm.last_name 
             FROM documents d
             JOIN crew_members cm ON cm.id = d.crew_member_id
             WHERE cm.current_vessel_id = $1 AND d.expiry_date < '1900-01-01'`,
            [vessel.id]
        );
        if (buggyDocs.rows.length > 0) {
            console.log('⚠️  Found documents with expiry date in year 1899 (Excel date bug):');
            buggyDocs.rows.forEach((r: any) => {
                console.log(`  - ${r.first_name} ${r.last_name}: ${r.type} | Doc#: ${r.document_number} | Expiry: ${r.expiry_date}`);
            });
        } else {
            console.log('✅ No 1899 date bugs found for this vessel');
        }

        // Check for MISMATCH between code thresholds and PDF legend labels
        console.log('\n=== THRESHOLD MISMATCH IN PDF GENERATOR ===');
        console.log('PDF Legend says:  Critical <= 15 Days | Upcoming 16-30 Days | Attention 31-45 Days | Not Due > 60 Days');
        console.log('Code actually:    Critical <= 30 Days | Upcoming <= 90 Days | Attention <= 180 Days');
        console.log('→ The document threshold labels in the PDF legend DO NOT match the actual code thresholds!');
        console.log('→ This means documents expiring in 16-90 days are shown as "Critical" or "Upcoming" but the legend says they should be lower priority.');

    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeAMNS();

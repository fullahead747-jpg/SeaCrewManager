import pg from 'pg';
import { config } from 'dotenv';
config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function getComplianceStatus(crewMember: any, docs: any[]): { status: string; reasons: string[] } {
    const now = new Date();
    const memberDocs = docs.filter((d: any) => d.crew_member_id === crewMember.id && d.expiry_date);
    
    let worst = 0;
    const reasons: string[] = [];

    for (const doc of memberDocs) {
        const expiry = new Date(doc.expiry_date);
        // BUG 1: Skip 1899/invalid placeholder dates
        if (expiry.getFullYear() < 2000) {
            reasons.push(`⚠️  1899 DATE BUG on ${doc.type.toUpperCase()} (Doc#: ${doc.document_number}) — will be IGNORED after fix`);
            // Old behaviour (before fix): would have been level 4 = Overdue
            continue;
        }
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        let level = 0;
        if (days < 0)        level = 4;
        else if (days <= 15) level = 3;
        else if (days <= 30) level = 2;
        else if (days <= 45) level = 1;
        if (level > worst) {
            worst = level;
            if (level >= 3) {
                const label = ['Not Due','Attention','Upcoming','Critical','Overdue'][level];
                reasons.push(`${label}: ${doc.type.toUpperCase()} expires ${expiry.toISOString().split('T')[0]} (${days} days)`);
            }
        }
    }

    if (crewMember.contract_end_date) {
        const expiry = new Date(crewMember.contract_end_date);
        if (expiry.getFullYear() >= 2000) {
            const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            let level = 0;
            if (days < 0)        level = 4;
            else if (days <= 15) level = 3;
            else if (days <= 30) level = 2;
            else if (days <= 45) level = 1;
            if (level > worst) {
                worst = level;
                if (level >= 3) {
                    const label = ['Not Due','Attention','Upcoming','Critical','Overdue'][level];
                    reasons.push(`${label}: CONTRACT ends ${expiry.toISOString().split('T')[0]} (${days} days)`);
                }
            }
        }
    }

    return { status: ['Not Due', 'Attention', 'Upcoming', 'Critical', 'Overdue'][worst], reasons };
}

async function analyzeAllVessels() {
    const client = await pool.connect();
    try {
        console.log('='.repeat(100));
        console.log(' FULL FLEET COMPLIANCE ANALYSIS — ALL VESSELS');
        console.log(`  Analysis Date: ${new Date().toISOString().split('T')[0]}`);
        console.log('='.repeat(100));

        const vesselRes = await client.query("SELECT * FROM vessels ORDER BY sort_order, name");
        if (vesselRes.rows.length === 0) { console.log('No vessels found!'); return; }

        // Get all crew and docs in one shot (efficient)
        const allCrewRes = await client.query(`
            SELECT cm.*, 
                   c.end_date   as contract_end_date, 
                   c.start_date as contract_start_date, 
                   c.status     as contract_status
            FROM crew_members cm
            LEFT JOIN LATERAL (
                SELECT * FROM contracts 
                WHERE crew_member_id = cm.id AND status = 'active'
                ORDER BY created_at DESC LIMIT 1
            ) c ON true
            WHERE cm.current_vessel_id IS NOT NULL
        `);

        const allDocsRes = await client.query(`SELECT * FROM documents`);

        // Check for 1899 bug across ALL documents fleet-wide
        const buggyDocsAll = await client.query(`
            SELECT d.type, d.document_number, d.expiry_date, 
                   cm.first_name, cm.last_name, cm.id as crew_id,
                   v.name as vessel_name
            FROM documents d
            JOIN crew_members cm ON cm.id = d.crew_member_id
            LEFT JOIN vessels v ON v.id = cm.current_vessel_id
            WHERE d.expiry_date < '1970-01-01'
            ORDER BY v.name, cm.last_name
        `);

        const allDocs = allDocsRes.rows;
        const allCrew = allCrewRes.rows;

        // Fleet-wide 1899 bug report
        console.log('\n🔍 FLEET-WIDE 1899 DATE BUG SCAN');
        console.log('-'.repeat(80));
        if (buggyDocsAll.rows.length > 0) {
            console.log(`Found ${buggyDocsAll.rows.length} document(s) with invalid expiry date (before 1970):\n`);
            let currentVessel = '';
            for (const r of buggyDocsAll.rows) {
                const vName = r.vessel_name || '(Unassigned / Shore)';
                if (vName !== currentVessel) {
                    currentVessel = vName;
                    console.log(`  📦 ${vName}`);
                }
                console.log(`     └─ ${(r.first_name + ' ' + r.last_name).toUpperCase().padEnd(32)} | Type: ${r.type.padEnd(20)} | Doc#: ${r.document_number.padEnd(20)} | Expiry: ${r.expiry_date}`);
            }
        } else {
            console.log('✅ No 1899/invalid date bugs found fleet-wide!');
        }

        // Per-vessel compliance analysis
        console.log('\n\n📊 PER-VESSEL COMPLIANCE BREAKDOWN');
        console.log('='.repeat(100));

        const statusCounts: Record<string, { overdue: number; critical: number; upcoming: number; attention: number; notDue: number; total: number; oldOverdueCount: number }> = {};
        const now = new Date();

        for (const vessel of vesselRes.rows) {
            const vesselCrew = allCrew.filter((c: any) => c.current_vessel_id === vessel.id);
            
            if (vesselCrew.length === 0) {
                console.log(`\n🚢 ${vessel.name}  [NO CREW ASSIGNED]`);
                continue;
            }

            const counts = { overdue: 0, critical: 0, upcoming: 0, attention: 0, notDue: 0, total: vesselCrew.length, oldOverdueCount: 0 };
            const problemCrew: { name: string; rank: string; status: string; reasons: string[] }[] = [];

            // Count what BEFORE the fix looked like (with 1899 bug)
            for (const member of vesselCrew) {
                const memberDocsOld = allDocs.filter((d: any) => d.crew_member_id === member.id && d.expiry_date);
                let worstOld = 0;
                for (const doc of memberDocsOld) {
                    const expiry = new Date(doc.expiry_date);
                    const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                    let level = 0;
                    if (days < 0) level = 4;
                    else if (days <= 30) level = 3;
                    else if (days <= 90) level = 2;
                    else if (days <= 180) level = 1;
                    if (level > worstOld) worstOld = level;
                }
                if (worstOld === 4) counts.oldOverdueCount++;
            }

            for (const member of vesselCrew) {
                const name = `${member.first_name} ${member.last_name}`.toUpperCase();
                const { status, reasons } = getComplianceStatus(member, allDocs);

                if (status === 'Overdue')       counts.overdue++;
                else if (status === 'Critical') counts.critical++;
                else if (status === 'Upcoming') counts.upcoming++;
                else if (status === 'Attention')counts.attention++;
                else                             counts.notDue++;

                if (status === 'Overdue' || status === 'Critical') {
                    problemCrew.push({ name, rank: member.rank || 'N/A', status, reasons });
                }
            }

            statusCounts[vessel.name] = counts;

            const overdueChange = counts.oldOverdueCount > counts.overdue 
                ? `  ← was ${counts.oldOverdueCount} Overdue before fix (${counts.oldOverdueCount - counts.overdue} false positives removed)` 
                : '';

            console.log(`\n🚢 ${vessel.name}  (${vesselCrew.length} crew)`);
            console.log(`   ❌ Overdue: ${counts.overdue}  |  🟠 Critical: ${counts.critical}  |  🟡 Upcoming: ${counts.upcoming}  |  🔵 Attention: ${counts.attention}  |  ✅ Not Due: ${counts.notDue}${overdueChange}`);

            if (problemCrew.length > 0) {
                for (const p of problemCrew) {
                    const icon = p.status === 'Overdue' ? '❌' : '🟠';
                    console.log(`   ${icon} ${p.name.padEnd(32)} [${p.rank}]`);
                    for (const r of p.reasons) {
                        console.log(`      └─ ${r}`);
                    }
                }
            }
        }

        // Fleet summary table
        console.log('\n\n📋 FLEET SUMMARY TABLE');
        console.log('─'.repeat(100));
        console.log(`${'Vessel'.padEnd(35)} ${'Crew'.padStart(5)} ${'Overdue'.padStart(8)} ${'Critical'.padStart(9)} ${'Upcoming'.padStart(9)} ${'Attention'.padStart(10)} ${'Not Due'.padStart(8)}`);
        console.log('─'.repeat(100));
        
        let totals = { total: 0, overdue: 0, critical: 0, upcoming: 0, attention: 0, notDue: 0 };
        for (const [name, c] of Object.entries(statusCounts)) {
            console.log(`${name.padEnd(35)} ${String(c.total).padStart(5)} ${String(c.overdue).padStart(8)} ${String(c.critical).padStart(9)} ${String(c.upcoming).padStart(9)} ${String(c.attention).padStart(10)} ${String(c.notDue).padStart(8)}`);
            totals.total += c.total;
            totals.overdue += c.overdue;
            totals.critical += c.critical;
            totals.upcoming += c.upcoming;
            totals.attention += c.attention;
            totals.notDue += c.notDue;
        }
        console.log('─'.repeat(100));
        console.log(`${'TOTAL FLEET'.padEnd(35)} ${String(totals.total).padStart(5)} ${String(totals.overdue).padStart(8)} ${String(totals.critical).padStart(9)} ${String(totals.upcoming).padStart(9)} ${String(totals.attention).padStart(10)} ${String(totals.notDue).padStart(8)}`);
        console.log('─'.repeat(100));

    } catch (e: any) {
        console.error('Error:', e.message, e.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeAllVessels();

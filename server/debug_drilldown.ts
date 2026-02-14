
import 'dotenv/config';
import { storage } from './storage';

async function main() {
    console.log('--- Debugging Contract Health Mismatch ---');
    const now = new Date();
    console.log('Now:', now.toISOString());

    // 1. Get Dashboard Stats
    const stats = await storage.getDashboardStats();
    console.log('Dashboard Stats Critical Count:', stats.contractHealth.critical);

    // 2. Simulate Drilldown Logic
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const contracts = await storage.getContracts();

    const filtered = contracts.filter(c => {
        if (c.status !== 'active') return false;
        const endDate = new Date(c.endDate);

        // Logic from routes.ts (WITH FIX)
        return endDate >= now && endDate <= fifteenDaysFromNow;
    });

    console.log('Drilldown (Fixed Logic) Count:', filtered.length);

    // 3. Simulate OLD Drilldown Logic
    const oldFiltered = contracts.filter(c => {
        if (c.status !== 'active') return false;
        const endDate = new Date(c.endDate);

        // Logic from routes.ts (WITHOUT FIX)
        return endDate <= fifteenDaysFromNow;
    });
    console.log('Drilldown (OLD Logic) Count:', oldFiltered.length);

    // 4. Inspect specific items
    console.log('\n--- Inspecting Mismatched Items (Fixed vs Old) ---');
    const mismatched = oldFiltered.filter(c => !filtered.find(f => f.id === c.id));
    if (mismatched.length > 0) {
        console.log(`Found ${mismatched.length} items that appear in OLD logic but NOT in NEW logic (these are overdue).`);
        mismatched.forEach(c => {
            console.log(`- Contract ${c.id}: EndDate=${c.endDate}, Status=${c.status}`);
        });
    } else {
        console.log('No mismatched items found between Fixed and Old logic.');
    }

    process.exit(0);
}

main().catch(console.error);

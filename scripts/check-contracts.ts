
import { DatabaseStorage } from "../server/storage.js";
import { config } from "dotenv";
config();

async function checkContracts() {
    const storage = new DatabaseStorage();
    const allCrew = await storage.getCrewMembers();
    const allContracts = await storage.getContracts();
    const activeContracts = allContracts.filter(c => c.status === 'active');

    console.log('--- CONTRACT HEALTH DIAGNOSTIC ---');
    console.log('Total Crew:', allCrew.length);
    const onBoard = allCrew.filter(m => m.status === 'onBoard');
    const onShore = allCrew.filter(m => m.status === 'onShore');
    console.log('On Board:', onBoard.length);
    console.log('On Shore:', onShore.length);

    console.log('\n--- ACTIVE CONTRACTS ---');
    console.log('Total Active Contracts:', activeContracts.length);

    const crewContractCounts = {};
    activeContracts.forEach(c => {
        crewContractCounts[c.crewMemberId] = (crewContractCounts[c.crewMemberId] || 0) + 1;
    });

    const dupes = Object.entries(crewContractCounts).filter(([id, count]) => count > 1);
    console.log('Crew with multiple active contracts:', dupes.length);
    if (dupes.length > 0) {
        console.log('Sample Duplicate IDs:', dupes.slice(0, 3).map(d => d[0]));
    }

    const now = new Date();
    const fifteen = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const thirty = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fortyFive = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const stats = {
        overdue: 0,
        critical: 0,
        upcoming: 0,
        attention: 0,
        notDue: 0,
        shored: onShore.length
    };

    onBoard.forEach(m => {
        const contract = activeContracts.find(c => c.crewMemberId === m.id);
        if (!contract || new Date(contract.endDate) < now) {
            stats.overdue++;
        } else {
            const end = new Date(contract.endDate);
            if (end <= fifteen) stats.critical++;
            else if (end <= thirty) stats.upcoming++;
            else if (end <= fortyFive) stats.attention++;
            else stats.notDue++;
        }
    });

    console.log('\n--- SUGGESTED UNIQUE BREAKDOWN ---');
    console.log('Overdue:', stats.overdue);
    console.log('Critical (0-15):', stats.critical);
    console.log('Upcoming (15-30):', stats.upcoming);
    console.log('Attention (30-45):', stats.attention);
    console.log('Not Due (>45):', stats.notDue);
    console.log('Signed Off (On Shore):', stats.shored);
    const sum = stats.overdue + stats.critical + stats.upcoming + stats.attention + stats.notDue + stats.shored;
    console.log('Total Sum:', sum);
    console.log('---------------------------------');
    process.exit(0);
}

checkContracts().catch(err => {
    console.error(err);
    process.exit(1);
});

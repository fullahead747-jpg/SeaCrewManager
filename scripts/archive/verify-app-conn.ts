import { db } from './server/db';
import { vessels, crewMembers, users } from './shared/schema';

async function verify() {
    console.log('--- App Connection Test ---');
    try {
        const vesselList = await db.select().from(vessels);
        console.log(`Vessels found: ${vesselList.length}`);
        vesselList.forEach(v => console.log(` - ${v.name}`));

        const crewList = await db.select().from(crewMembers);
        console.log(`\nCrew found: ${crewList.length}`);

        const userList = await db.select().from(users);
        console.log(`\nUsers found: ${userList.length}`);
        userList.forEach(u => console.log(` - ${u.username} (${u.name})`));

    } catch (error) {
        console.error('Connection Error:', error);
    } finally {
        process.exit(0);
    }
}

verify();


import { storage } from '../server/storage';

async function checkHercules() {
  const vessels = await storage.getVessels();
  const hercules = vessels.find(v => v.name.includes('AMNS HERCULES'));
  
  if (!hercules) return;
  
  const crew = await storage.getCrewMembersByVessel(hercules.id);
  const now = new Date();
  
  console.log(`Checking contracts for crew on ${hercules.name}:`);
  crew.forEach(member => {
    const contract = member.activeContract;
    if (contract) {
        console.log(`- ${member.firstName} ${member.lastName}: Status ${contract.status}, End Date ${contract.endDate}`);
    } else {
        console.log(`- ${member.firstName} ${member.lastName}: NO ACTIVE CONTRACT`);
    }
  });
}

checkHercules().catch(console.error);

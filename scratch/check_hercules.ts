
import { storage } from '../server/storage';

async function checkHercules() {
  const vessels = await storage.getVessels();
  const hercules = vessels.find(v => v.name.includes('AMNS HERCULES'));
  
  if (!hercules) {
    console.log('Vessel AMNS HERCULES not found');
    return;
  }
  
  console.log(`Found vessel: ${hercules.name} (ID: ${hercules.id})`);
  
  // Get crew members for Hercules
  const crew = await storage.getCrewMembersByVessel(hercules.id);
  const onBoardCrew = crew.filter(m => m.status === 'onBoard');
  console.log(`Total crew assigned: ${crew.length}, On Board: ${onBoardCrew.length}`);
  
  const now = new Date();
  const fortyFiveDays = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  
  const contractStats = { active: 0, expiringSoon: 0, expired: 0, noContract: 0 };
  const expiredContractCrew: any[] = [];

  for (const member of onBoardCrew) {
    const contract = member.activeContract;
    if (!contract || contract.status !== 'active') {
      contractStats.noContract++;
    } else {
      const endDate = new Date(contract.endDate);
      if (endDate < now) {
        contractStats.expired++;
        expiredContractCrew.push(member);
      } else if (endDate <= fortyFiveDays) {
        contractStats.expiringSoon++;
      } else {
        contractStats.active++;
      }
    }
  }
  
  console.log('Contract Stats for Hercules:', contractStats);
  console.log(`Crew members with expired contracts (${expiredContractCrew.length}):`);
  expiredContractCrew.forEach(member => {
    console.log(`- ${member.firstName} ${member.lastName}: End Date ${member.activeContract.endDate}`);
  });
}

checkHercules().catch(console.error);

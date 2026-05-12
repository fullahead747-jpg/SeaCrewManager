
import { storage } from '../server/storage';

async function checkHercules() {
  const vessels = await storage.getVessels();
  const hercules = vessels.find(v => v.name.includes('AMNS HERCULES'));
  
  if (!hercules) return;
  
  const crew = await storage.getCrewMembersByVessel(hercules.id);
  const now = new Date();
  
  console.log(`Checking expired documents for crew on ${hercules.name}:`);
  crew.forEach(member => {
    const expiredDocs = member.documents.filter(doc => 
      doc.expiryDate && doc.expiryDate < now && new Date(doc.expiryDate).getFullYear() > 1900
    );
    
    if (expiredDocs.length > 0) {
      console.log(`- ${member.firstName} ${member.lastName}:`);
      expiredDocs.forEach(doc => {
        console.log(`  * ${doc.type}: ${doc.expiryDate.toISOString()} (filePath: ${doc.filePath})`);
      });
    }
  });
}

checkHercules().catch(console.error);

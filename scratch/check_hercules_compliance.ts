
import { storage } from '../server/storage';

const REQUIRED_DOCUMENTS = [
    { type: 'passport', label: 'Passport' },
    { type: 'cdc', label: 'CDC' },
    { type: 'coc', label: 'COC' },
    { type: 'medical', label: 'Medical' },
    { type: 'stcw_course', label: 'STCW' },
    { type: 'aoa', label: 'AOA' }
];

async function checkHercules() {
  const vessels = await storage.getVessels();
  const hercules = vessels.find(v => v.name.includes('AMNS HERCULES'));
  
  if (!hercules) {
    console.log('Vessel AMNS HERCULES not found');
    return;
  }
  
  const crew = await storage.getCrewMembersByVessel(hercules.id);
  const onBoardCrew = crew.filter(m => m.status === 'onBoard');
  
  let expiredCount = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  onBoardCrew.forEach(member => {
    const issues = [];
    const docs = member.documents || [];

    REQUIRED_DOCUMENTS.forEach(req => {
      const doc = docs.find(d => d.type.toLowerCase() === req.type.toLowerCase() && d.filePath)
        || docs.find(d => d.type.toLowerCase() === req.type.toLowerCase());

      if (!doc || !doc.filePath) {
        issues.push({ type: req.type, status: 'missing' });
        return;
      }

      if (doc.expiryDate) {
        const expiryDate = new Date(doc.expiryDate);
        const daysDiff = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 0) {
          issues.push({ type: req.type, status: 'expired' });
        }
      }
    });

    if (issues.some(i => i.status === 'expired' || i.status === 'missing')) {
      expiredCount++;
      console.log(`Crew ${member.firstName} ${member.lastName} has issues:`, issues.map(i => `${i.type} (${i.status})`).join(', '));
    }
  });

  console.log(`Total non-compliant crew (EX): ${expiredCount}`);
}

checkHercules().catch(console.error);

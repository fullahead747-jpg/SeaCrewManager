const Database = require('better-sqlite3');
const db = new Database('./crew_management.db');

console.log('=== SCANNED DOCUMENTS DATA FOR VENKATARANGAN BALAJI (PASSPORT) ===\n');

const query = `
  SELECT 
    sd.id,
    sd.documentId,
    sd.extractedNumber,
    sd.extractedExpiry,
    sd.extractedIssueDate,
    sd.extractedHolderName,
    sd.extractedIssuingAuthority,
    sd.createdAt,
    sd.supersededAt
  FROM scanned_documents sd
  JOIN documents d ON sd.documentId = d.id
  JOIN crew_members cm ON d.crewMemberId = cm.id
  WHERE cm.firstName = 'VENKATARANGAN' 
    AND cm.lastName = 'BALAJI' 
    AND d.type = 'passport'
  ORDER BY sd.createdAt DESC
`;

const results = db.prepare(query).all();

if (results.length === 0) {
    console.log('❌ NO DATA FOUND in scanned_documents table for this passport.');
    console.log('This means the auto-population has not run yet.');
} else {
    console.log(`Found ${results.length} record(s):\n`);
    results.forEach((row, index) => {
        console.log(`Record #${index + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Document ID: ${row.documentId}`);
        console.log(`  Extracted Number: ${row.extractedNumber}`);
        console.log(`  Extracted Expiry: ${row.extractedExpiry}`);
        console.log(`  Extracted Issue Date: ${row.extractedIssueDate}`);
        console.log(`  Extracted Holder Name: ${row.extractedHolderName}`);
        console.log(`  Extracted Issuing Authority: ${row.extractedIssuingAuthority || 'NULL'}`);
        console.log(`  Created At: ${row.createdAt}`);
        console.log(`  Superseded At: ${row.supersededAt || 'NULL (Active)'}`);
        console.log('');
    });
}

db.close();

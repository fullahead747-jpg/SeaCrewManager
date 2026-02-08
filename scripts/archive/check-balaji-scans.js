const Database = require('better-sqlite3');
const db = new Database('./crew_management.db');

console.log('=== Querying VENKATARANGAN BALAJI Passport Data ===\n');

// Find crew member
const crew = db.prepare(`
  SELECT id, firstName, lastName, dateOfBirth 
  FROM crew_members 
  WHERE firstName = 'VENKATARANGAN'
`).get();

if (!crew) {
    console.log('❌ No crew member found with name VENKATARANGAN');
    process.exit(1);
}

console.log('✅ Found crew member:');
console.log(`   Name: ${crew.firstName} ${crew.lastName}`);
console.log(`   ID: ${crew.id}`);
console.log(`   DOB: ${crew.dateOfBirth}\n`);

// Find passport document
const passportDoc = db.prepare(`
  SELECT id, documentNumber, expiryDate, issueDate, issuingAuthority
  FROM documents
  WHERE crewMemberId = ? AND type = 'passport'
`).get(crew.id);

if (!passportDoc) {
    console.log('❌ No passport document found for this crew member');
    process.exit(1);
}

console.log('✅ Passport Document in documents table:');
console.log(`   Doc ID: ${passportDoc.id}`);
console.log(`   Number: ${passportDoc.documentNumber}`);
console.log(`   Expiry: ${passportDoc.expiryDate}`);
console.log(`   Issue: ${passportDoc.issueDate}`);
console.log(`   Authority: ${passportDoc.issuingAuthority}\n`);

// Find all scanned documents for this passport
const scans = db.prepare(`
  SELECT 
    id,
    extractedNumber,
    extractedExpiry,
    extractedIssueDate,
    extractedHolderName,
    createdAt,
    supersededAt
  FROM scanned_documents
  WHERE documentId = ?
  ORDER BY createdAt DESC
`).all(passportDoc.id);

console.log(`✅ Found ${scans.length} scanned document(s) in scanned_documents table:\n`);

scans.forEach((scan, index) => {
    console.log(`--- Scan #${index + 1} ---`);
    console.log(`   Scan ID: ${scan.id}`);
    console.log(`   Created: ${scan.createdAt}`);
    console.log(`   Extracted Number: ${scan.extractedNumber || 'NULL'}`);
    console.log(`   Extracted Expiry: ${scan.extractedExpiry || 'NULL'}`);
    console.log(`   Extracted Issue: ${scan.extractedIssueDate || 'NULL'}`);
    console.log(`   Extracted Holder: ${scan.extractedHolderName || 'NULL'}`);
    console.log(`   Superseded: ${scan.supersededAt || 'NOT SUPERSEDED'}`);
    console.log('');
});

db.close();

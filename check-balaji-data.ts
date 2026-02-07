import Database from 'better-sqlite3';

const db = new Database('./crew_management.db');

console.log('=== Checking VENKATARANGAN BALAJI Passport Data ===\n');

// Query crew member and passport data
const result = db.prepare(`
  SELECT 
    cm.firstName,
    cm.lastName,
    cm.dateOfBirth,
    d.id as docId,
    d.documentNumber,
    d.expiryDate,
    d.issueDate,
    d.issuingAuthority
  FROM crew_members cm
  JOIN documents d ON cm.id = d.crewMemberId
  WHERE cm.firstName = 'VENKATARANGAN' 
    AND cm.lastName = 'BALAJI'
    AND d.type = 'passport'
`).get();

if (!result) {
    console.log('❌ No passport found for VENKATARANGAN BALAJI');
    process.exit(1);
}

console.log('✅ Found passport in database:');
console.log('   Crew Name:', result.firstName, result.lastName);
console.log('   Date of Birth:', result.dateOfBirth);
console.log('   ---');
console.log('   Document ID:', result.docId);
console.log('   Document Number:', result.documentNumber);
console.log('   Expiry Date:', result.expiryDate);
console.log('   Issue Date:', result.issueDate);
console.log('   Issuing Authority:', result.issuingAuthority);

db.close();

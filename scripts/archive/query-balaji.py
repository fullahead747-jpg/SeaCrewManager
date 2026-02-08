import sqlite3
import sys

try:
    conn = sqlite3.connect('crew_management.db')
    cursor = conn.cursor()
    
    print("=== VENKATARANGAN BALAJI Passport Data ===\n")
    
    query = """
    SELECT 
        cm.firstName,
        cm.lastName,
        cm.dateOfBirth,
        d.id,
        d.documentNumber,
        d.expiryDate,
        d.issueDate,
        d.issuingAuthority
    FROM crew_members cm
    JOIN documents d ON cm.id = d.crewMemberId
    WHERE cm.firstName = 'VENKATARANGAN' 
      AND d.type = 'passport'
    """
    
    cursor.execute(query)
    result = cursor.fetchone()
    
    if result:
        print(f"Name: {result[0]} {result[1]}")
        print(f"Date of Birth: {result[2]}")
        print(f"---")
        print(f"Document ID: {result[3]}")
        print(f"Passport Number: {result[4]}")
        print(f"Expiry Date: {result[5]}")
        print(f"Issue Date: {result[6]}")
        print(f"Issuing Authority: {result[7]}")
    else:
        print("No passport found for VENKATARANGAN BALAJI")
    
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

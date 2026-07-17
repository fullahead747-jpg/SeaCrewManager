// @ts-nocheck

import { DatabaseStorage } from "./server/storage";
import { db } from "./server/db";
import { documents } from "./shared/schema";
import { sql } from "drizzle-orm";

async function inspectDates() {
    console.log("Inspecting document dates for -1 or problematic values...");
    
    // Check for any documents where issue_date or expiry_date might be problematic
    // Since they are timestamp columns, they can't literally be "-1" as a string,
    // but they could be epoch-adjacent or null.
    
    const allDocs = await db.select().from(documents);
    
    let issues = 0;
    for (const doc of allDocs) {
        const issueStr = doc.issueDate ? doc.issueDate.toISOString() : 'NULL';
        const expiryStr = doc.expiryDate ? doc.expiryDate.toISOString() : 'NULL';
        
        if (issueStr.includes("1969") || issueStr.includes("1970") || 
            expiryStr.includes("1969") || expiryStr.includes("1970")) {
            console.log(`[POTENTIAL ISSUE] Doc ID: ${doc.id}, Type: ${doc.type}`);
            console.log(`  Issue Date:  ${issueStr}`);
            console.log(`  Expiry Date: ${expiryStr}`);
            issues++;
        }
    }
    
    console.log(`\nFound ${issues} documents with suspicious (epoch-adjacent) dates.`);
    process.exit(0);
}

inspectDates().catch(console.error);

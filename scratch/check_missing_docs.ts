
import { db } from "../server/db";
import { crewMembers, documents } from "../shared/schema";
import { count, isNull, eq, isNotNull, asc, desc } from "drizzle-orm";

async function checkMissingDocuments() {
    console.log("🔍 Checking for missing documents...");

    // 1. Documents with missing file paths - get earliest and latest creation dates
    const docsWithNoFile = await db.select({
        id: documents.id,
        type: documents.type,
        createdAt: documents.createdAt
    })
    .from(documents)
    .where(isNull(documents.filePath))
    .orderBy(desc(documents.createdAt));

    console.log(`⚠️ Total documents with MISSING file paths: ${docsWithNoFile.length}`);
    
    if (docsWithNoFile.length > 0) {
        console.log("\n📄 Most recent documents with MISSING file paths:");
        docsWithNoFile.slice(0, 5).forEach(d => console.log(`   - [${d.type}] Created: ${d.createdAt}`));
        
        console.log("\n📄 Oldest documents with MISSING file paths:");
        docsWithNoFile.slice(-5).forEach(d => console.log(`   - [${d.type}] Created: ${d.createdAt}`));
    }

    // 2. Check if any documents were created TODAY (April 30th)
    const today = new Date();
    today.setHours(0,0,0,0);
    const docsToday = await db.select({ value: count() }).from(documents).where(eq(documents.createdAt, today));
    // Wait, equality check on timestamp is tricky. Let's use greater than.
    const docsSinceToday = await db.select({ value: count() }).from(documents).where(sql`created_at >= ${today.toISOString()}`);
    console.log(`\n📅 Documents created since today (April 30th): ${docsSinceToday[0].value}`);

    console.log("\n✅ Check complete.");
}

import { sql } from "drizzle-orm";
checkMissingDocuments().catch(console.error);

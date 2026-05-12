
import { db } from "../server/db";
import { activityLogs } from "../shared/schema";
import { desc, eq, and, sql } from "drizzle-orm";

async function checkDeletions() {
    console.log("🔍 Checking for recent deletions in activity logs...");

    const recentLogs = await db.select()
        .from(activityLogs)
        .where(and(
            eq(activityLogs.action, 'delete'),
            sql`created_at >= NOW() - INTERVAL '24 hours'`
        ))
        .orderBy(desc(activityLogs.createdAt));

    console.log(`📊 Recent deletions (last 24h): ${recentLogs.length}`);
    recentLogs.forEach(log => {
        console.log(`   - [${log.createdAt}] ${log.username} deleted ${log.entityType}: ${log.description}`);
    });

    const updateLogs = await db.select()
        .from(activityLogs)
        .where(and(
            eq(activityLogs.action, 'update'),
            sql`created_at >= NOW() - INTERVAL '24 hours'`
        ))
        .orderBy(desc(activityLogs.createdAt))
        .limit(10);

    console.log(`\n📊 Recent updates (last 10 logs):`);
    updateLogs.forEach(log => {
        console.log(`   - [${log.createdAt}] ${log.username} updated ${log.entityType}: ${log.description}`);
    });
}

checkDeletions().catch(console.error);

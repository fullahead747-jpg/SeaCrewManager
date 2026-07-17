// @ts-nocheck
import { db } from "../server/db";
import { emailSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function disableAllNotifications() {
  console.log("🛠️  Disabling all notifications in database...");
  
  const existingSettings = await db.select().from(emailSettings).limit(1);
  
  if (existingSettings.length > 0) {
    await db.update(emailSettings)
      .set({ 
        enabled: false,
        overdueEnabled: false,
        criticalEnabled: false,
        upcomingEnabled: false,
        attentionEnabled: false,
        updatedAt: new Date()
      })
      .where(eq(emailSettings.id, existingSettings[0].id));
    console.log(`✅ Updated existing settings (ID: ${existingSettings[0].id}) to disabled.`);
  } else {
    // If no settings exist, create one in disabled state
    await db.insert(emailSettings).values({
      enabled: false,
      overdueEnabled: false,
      criticalEnabled: false,
      upcomingEnabled: false,
      attentionEnabled: false,
    });
    console.log("✅ Created new disabled settings record.");
  }
  
  process.exit(0);
}

disableAllNotifications().catch(err => {
  console.error("❌ Error disabling notifications:", err);
  process.exit(1);
});

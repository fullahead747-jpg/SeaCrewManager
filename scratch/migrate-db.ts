import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("Adding column coe_extension_not_applicable to crew_members table...");
    await db.execute(sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS coe_extension_not_applicable BOOLEAN DEFAULT FALSE`);
    console.log("Successfully added column coe_extension_not_applicable");
  } catch (error) {
    console.error("Error migrating DB:", error);
  } finally {
    process.exit(0);
  }
}

migrate();

import { db } from "../server/db";
import { vessels, crewMembers } from "../shared/schema";
import { sql } from "drizzle-orm";

async function checkDb() {
  try {
    const vesselCount = await db.select({ count: sql`count(*)` }).from(vessels);
    console.log("Vessel count:", vesselCount[0].count);

    const crewCount = await db.select({ count: sql`count(*)` }).from(crewMembers);
    console.log("Crew count:", crewCount[0].count);
    
    // Check if column exists
    try {
        await db.execute(sql`SELECT coe_extension_not_applicable FROM crew_members LIMIT 1`);
        console.log("Column coe_extension_not_applicable exists");
    } catch (e) {
        console.log("Column coe_extension_not_applicable DOES NOT exist");
    }
  } catch (error) {
    console.error("Error checking DB:", error);
  } finally {
    process.exit(0);
  }
}

checkDb();

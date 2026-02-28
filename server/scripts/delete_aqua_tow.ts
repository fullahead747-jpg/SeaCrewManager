
import { db } from "../db";
import { contracts } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const contractId = "bc9024fe-c62d-4981-8c7a-68d6093a32fc";
    console.log(`Attempting to delete contract ID: ${contractId} (Aqua Tow for RAJPAL SINGH)`);

    const result = await db.delete(contracts).where(eq(contracts.id, contractId));

    console.log("Deletion complete.");
    console.log(`Rows affected: ${result.rowCount}`);

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

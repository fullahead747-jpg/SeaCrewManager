
import { DatabaseStorage } from "./server/storage.js";
import { config } from "dotenv";
config();

async function verify() {
    const storage = new DatabaseStorage();
    const stats = await storage.getDashboardStats();
    console.log("--- FINAL STATS VERIFICATION ---");
    console.log("Expired Docs Count:", stats.documentHealth.expired);
    console.log("Valid/Permanent Docs Count:", stats.documentHealth.valid);
    console.log("Total Documents:", stats.documentHealth.total);
    console.log("Check: expired + critical + warning + attention + valid == total");
    const h = stats.documentHealth;
    const sum = h.expired + h.critical + h.warning + h.attention + h.valid;
    console.log(`Sum: ${sum} vs Total: ${h.total}`);
    console.log("-------------------------------");
    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});

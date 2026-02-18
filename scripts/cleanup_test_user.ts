import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { config } from 'dotenv';

config();

async function cleanup() {
    try {
        await db.delete(users).where(eq(users.username, "testuser@example.com"));
        console.log('Test User deleted successfully.');
    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanup();

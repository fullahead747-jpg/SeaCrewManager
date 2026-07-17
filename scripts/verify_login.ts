// @ts-nocheck
import { storage } from "../server/storage";
import { comparePasswords } from "../server/auth";
import { config } from 'dotenv';

config();

async function verifyLogin() {
    try {
        const username = "testuser@example.com";
        const password = "password123";

        const user = await storage.getUserByUsername(username);
        if (!user) {
            console.error('User not found');
            return;
        }

        const match = await comparePasswords(password, user.password);
        console.log(`Password match for ${username}: ${match}`);
    } catch (err) {
        console.error('Verification failed:', err);
    }
}

verifyLogin();

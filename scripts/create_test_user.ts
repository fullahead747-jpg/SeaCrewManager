// @ts-nocheck
import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";
import { config } from 'dotenv';

config();

async function createTestUser() {
    try {
        const password = "password123";
        const hashedPassword = await hashPassword(password);

        const user = await storage.createUser({
            username: "testuser@example.com",
            email: "testuser@example.com",
            password: hashedPassword,
            name: "Test User",
            role: "office_staff"
        });

        console.log('Test User created successfully:', user.username);
    } catch (err) {
        console.error('Failed to create test user:', err);
    }
}

createTestUser();

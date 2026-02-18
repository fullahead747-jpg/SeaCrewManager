import { storage } from "../server/storage";
import { config } from 'dotenv';

config();

async function listUsers() {
    try {
        const users = await storage.getAllUsers();
        console.log('Registered Users:');
        users.forEach(u => {
            console.log(`- ID: ${u.id}, Username: ${u.username}, Email: ${u.email}, Name: ${u.name}`);
        });
    } catch (err) {
        console.error('Failed to list users:', err);
    }
}

listUsers();

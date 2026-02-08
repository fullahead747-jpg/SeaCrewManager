
import 'dotenv/config';
console.log('--- DATABASE DIAGNOSTIC ---');
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log('Host:', url.hostname);
        console.log('Database:', url.pathname);
        console.log('Protocol:', url.protocol);
    } catch (e) {
        console.log('Invalid URL format');
    }
} else {
    console.log('DATABASE_URL is MISSING');
}
console.log('---------------------------');

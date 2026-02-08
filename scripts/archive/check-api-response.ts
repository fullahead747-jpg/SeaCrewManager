// Quick API Response Check
// Run in Replit Shell: npx tsx check-api-response.ts

import fetch from 'node-fetch';

async function checkAPI() {
    try {
        const baseUrl = process.env.REPL_SLUG
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : 'http://localhost:5000';

        console.log('🔍 Checking API responses...\n');
        console.log('Base URL:', baseUrl);

        // Check vessels endpoint
        const vesselsRes = await fetch(`${baseUrl}/api/vessels`);
        const vessels = await vesselsRes.json();

        console.log('\n📊 Vessels API Response:');
        console.log('Status:', vesselsRes.status);
        console.log('Count:', Array.isArray(vessels) ? vessels.length : 'Not an array');
        console.log('Data:', JSON.stringify(vessels, null, 2));

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

checkAPI();

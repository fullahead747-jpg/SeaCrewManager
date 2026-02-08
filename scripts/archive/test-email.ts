
import { storage } from './server/storage';
import { smtpEmailService } from './server/services/smtp-email-service';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

async function testEmailConfiguration() {
    console.log('🔍 Testing Email Configuration...');

    try {
        // 1. Check environment variables
        console.log('\n1. Checking Environment Variables:');
        console.log('   GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set (' + process.env.GMAIL_USER + ')' : '❌ Missing');
        console.log('   GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Missing');

        // 2. Check Database Settings
        console.log('\n2. Checking Database Settings:');
        try {
            const settings = await storage.getEmailSettings();
            console.log('   Settings found:', settings ? '✅ Yes' : '❌ No');
            if (settings) {
                console.log('   Recipient Email:', settings.recipientEmail);
                console.log('   Enabled:', settings.enabled);
            } else {
                console.log('   ⚠️ No email settings found in database. Route handler will fail.');
            }
        } catch (dbError) {
            console.error('   ❌ Database Error:', dbError);
        }

        // 3. Test SMTP Connection/Sending
        console.log('\n3. Testing SMTP Service:');
        try {
            const isReady = smtpEmailService.isReady();
            console.log('   SMTP Service Ready:', isReady ? '✅ Yes' : '❌ No');

            if (process.env.GMAIL_USER) {
                console.log('   Attempting to send test email to:', process.env.GMAIL_USER);
                const result = await smtpEmailService.sendTestEmail(process.env.GMAIL_USER);
                console.log('   Send Result:', result);
            } else {
                console.log('   ⚠️ Cannot test sending: GMAIL_USER not set');
            }
        } catch (smtpError) {
            console.error('   ❌ SMTP Error:', smtpError);
        }

    } catch (error) {
        console.error('❌ Error during test:', error);
    }

    process.exit(0);
}

testEmailConfiguration();

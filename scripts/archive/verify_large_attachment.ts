
import * as dotenv from 'dotenv';
dotenv.config();

// Import after config
import { smtpEmailService } from './server/services/smtp-email-service';

async function verifyLargeAttachment() {
    console.log('🐘 Testing Large Attachment (26MB)...');

    // Create a 26MB buffer (Gmail limit is 25MB)
    const size = 26 * 1024 * 1024;
    const buffer = Buffer.alloc(size, 'x'); // 26MB of 'x'

    try {
        if (!process.env.GMAIL_USER) {
            console.log("❌ GMAIL_USER not set. Cannot test.");
            return;
        }

        console.log(`   Attempting to send ${size / 1024 / 1024}MB attachment to ${process.env.GMAIL_USER}...`);

        // Using the developer's own email to test
        const result = await smtpEmailService.sendEmailWithAttachment(
            process.env.GMAIL_USER,
            'TEST: Large Attachment',
            '<p>This is a test of a large attachment.</p>',
            [{ filename: 'large_file.txt', content: buffer, contentType: 'text/plain' }]
        );

        console.log('✅ Sent successfully? (Result):', result);

    } catch (error: any) {
        console.log('❌ Failed as expected!');
        console.log('   Error Name:', error.name);
        console.log('   Error Message:', error.message);
        if (error.response) {
            console.log('   SMTP Response:', error.response);
        }
    }
}

verifyLargeAttachment();

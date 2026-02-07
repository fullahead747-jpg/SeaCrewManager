import 'dotenv/config';
import { documentAccessService } from './server/services/document-access-service';
import { sendCDCExpiryAlert, sendPassportExpiryAlert } from './server/services/smtp-email-service';
import { db } from './server/db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function sendTestEmailWithLink() {
  console.log('📧 Sending test email with secure document link...\n');

  try {
    // Get a test document from your database
    const testDocs = await db
      .select()
      .from(documents)
      .limit(1);

    if (testDocs.length === 0) {
      console.log('❌ No documents found in database');
      console.log('💡 Please upload a document first, then run this script again.');
      process.exit(1);
    }

    const doc = testDocs[0];
    console.log(`📄 Using document: ${doc.type} - ${doc.documentNumber}`);

    // Generate secure token
    const token = await documentAccessService.generateAccessToken(
      doc.id,
      48,
      'test_email'
    );

    const viewUrl = documentAccessService.generateViewUrl(token);
    console.log(`🔗 Generated secure link: ${viewUrl}\n`);

    // Prepare email data
    const emailData = {
      crewMemberName: 'UPENDRA KUMAR',
      crewMemberRank: 'Chief Engineer',
      crewMemberNationality: 'India',
      vesselName: 'MV OCEAN STAR',
      cdcNumber: doc.documentNumber || 'TEST-CDC-12345',
      issuingAuthority: doc.issuingAuthority || 'Directorate General of Shipping',
      expiryDate: doc.expiryDate || new Date('2026-03-15'),
      daysUntilExpiry: 45,
      documentViewUrl: viewUrl // Phase 2A: Secure link
    };

    // Get recipient email from environment or use default
    const recipientEmail = process.env.GMAIL_USER || 'admin@offing.biz';

    console.log(`📬 Sending test email to: ${recipientEmail}\n`);

    // Send test email
    const result = await sendCDCExpiryAlert(recipientEmail, emailData);

    if (result.success) {
      console.log('✅ Test email sent successfully!\n');
      console.log('📋 Email Details:');
      console.log('   - Recipient:', recipientEmail);
      console.log('   - Document Type: CDC');
      console.log('   - Document Number:', emailData.cdcNumber);
      console.log('   - Days Until Expiry:', emailData.daysUntilExpiry);
      console.log('   - Secure Link:', viewUrl);
      console.log('   - Link Expires: 48 hours\n');
      console.log('💡 Check your email inbox and click the "View Document" button!');
      console.log('🔗 You can also test the link directly by opening:', viewUrl);
    } else {
      console.log('❌ Failed to send email:', result.error);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

sendTestEmailWithLink();

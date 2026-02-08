import 'dotenv/config';
import { db } from './server/db';
import { documents, crewMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { smtpEmailService } from './server/services/smtp-email-service';

/**
 * Send test emails for all document types (CDC, COC, Medical)
 */
async function sendAllDocumentTypeEmails() {
    console.log('📧 Sending test emails for all document types...\n');

    const documentTypes = ['cdc', 'coc', 'medical'];
    const recipientEmail = process.env.TEST_EMAIL || 'admin@offing.biz';

    for (const docType of documentTypes) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📄 Processing ${docType.toUpperCase()} document...`);
        console.log('='.repeat(60));

        try {
            // Fetch document of this type
            const docs = await db
                .select()
                .from(documents)
                .where(eq(documents.type, docType))
                .limit(1);

            if (docs.length === 0) {
                console.log(`⚠️  No ${docType.toUpperCase()} documents found in database.`);
                console.log(`   Skipping ${docType.toUpperCase()}...\n`);
                continue;
            }

            const document = docs[0];

            // Fetch crew member details
            const crewData = await db
                .select()
                .from(crewMembers)
                .where(eq(crewMembers.id, document.crewMemberId))
                .limit(1);

            if (crewData.length === 0) {
                console.log(`⚠️  Crew member not found for ${docType.toUpperCase()}.`);
                continue;
            }

            const crew = crewData[0];

            // Calculate days until expiry
            const expiryDate = document.expiryDate ? new Date(document.expiryDate) : null;
            const today = new Date();
            const daysUntilExpiry = expiryDate
                ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            // Determine urgency
            let urgencyColor = '#2563eb';
            let urgencyText = 'NOTICE';
            let urgencyBg = '#eff6ff';

            if (daysUntilExpiry < 0) {
                if (Math.abs(daysUntilExpiry) > 7) {
                    urgencyColor = '#dc2626';
                    urgencyText = 'CRITICAL';
                    urgencyBg = '#fee2e2';
                } else {
                    urgencyColor = '#f59e0b';
                    urgencyText = 'URGENT';
                    urgencyBg = '#fef3c7';
                }
            } else if (daysUntilExpiry <= 7) {
                urgencyColor = '#f59e0b';
                urgencyText = 'URGENT';
                urgencyBg = '#fef3c7';
            } else if (daysUntilExpiry <= 15) {
                urgencyColor = '#eab308';
                urgencyText = 'Action Required';
                urgencyBg = '#fef9c3';
            }

            const crewName = `${crew.firstName} ${crew.lastName}`.toUpperCase();
            const documentType = document.type.toUpperCase();

            console.log(`\n📋 Document Details:`);
            console.log(`   Crew: ${crewName}`);
            console.log(`   Type: ${documentType}`);
            console.log(`   Number: ${document.documentNumber || 'N/A'}`);
            console.log(`   Issue Date: ${document.issueDate ? new Date(document.issueDate).toLocaleDateString() : 'N/A'}`);
            console.log(`   Expiry Date: ${expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}`);
            console.log(`   Issuing Authority: ${document.issuingAuthority || 'N/A'}`);
            console.log(`   Status: ${document.status}`);
            console.log(`   Days Until Expiry: ${daysUntilExpiry}`);

            const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              background: #f8f9fa; 
              margin: 0; 
              padding: 0;
              line-height: 1.6;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              padding: 0 20px; 
            }
            .card { 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              color: #1e3a5f; 
              margin: 0 0 10px 0; 
              font-size: 28px;
              font-weight: 700;
            }
            .urgency-badge { 
              display: inline-block;
              background: ${urgencyColor}; 
              color: white; 
              padding: 10px 20px; 
              border-radius: 6px; 
              font-weight: 700;
              font-size: 14px;
              margin-bottom: 30px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-section {
              background: #f8f9fa;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row { 
              padding: 12px 0; 
              border-bottom: 1px solid #e5e7eb; 
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label { 
              font-weight: 600; 
              color: #374151;
              font-size: 14px;
            }
            .info-value { 
              color: #6b7280;
              font-size: 14px;
              text-align: right;
              max-width: 60%;
              word-break: break-word;
            }
            .days-remaining { 
              font-size: 48px; 
              font-weight: 800; 
              color: ${urgencyColor}; 
              text-align: center;
              margin: 30px 0;
              line-height: 1;
            }
            .days-label {
              font-size: 16px;
              color: #6b7280;
              text-align: center;
              margin-top: 10px;
              font-weight: 400;
            }
            .alert-box {
              background: ${urgencyBg};
              border-left: 4px solid ${urgencyColor};
              padding: 20px;
              margin: 25px 0;
              border-radius: 6px;
            }
            .alert-title {
              color: ${urgencyColor};
              font-weight: 700;
              font-size: 16px;
              margin: 0 0 8px 0;
            }
            .alert-text {
              color: #374151;
              margin: 0;
              font-size: 14px;
            }
            .cta-button {
              display: inline-block;
              background: #2563eb;
              color: white !important;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 700;
              margin: 25px 0;
              font-size: 16px;
              box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
            }
            .footer { 
              text-align: center;
              color: #9ca3af; 
              font-size: 13px; 
              margin-top: 30px;
              padding-top: 30px;
              border-top: 2px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo-text {
              font-size: 24px;
              font-weight: 800;
              color: #1e3a5f;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="logo">
                <h1 class="logo-text">⚓ SeaCrewManager</h1>
              </div>
              
              <h2 class="header">Document Expiry ${urgencyText}</h2>
              <div class="urgency-badge">${urgencyText}</div>
              
              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">👤 Crew Member</span>
                  <span class="info-value">${crewName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">🎖️ Rank/Position</span>
                  <span class="info-value">${crew.rank || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">🌍 Nationality</span>
                  <span class="info-value">${crew.nationality || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">📄 Document Type</span>
                  <span class="info-value">${documentType}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">🔢 Document Number</span>
                  <span class="info-value">${document.documentNumber || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">🏛️ Issuing Authority</span>
                  <span class="info-value">${document.issuingAuthority || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">📅 Issue Date</span>
                  <span class="info-value">${document.issueDate ? new Date(document.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">📅 Expiry Date</span>
                  <span class="info-value">${expiryDate ? expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                </div>
              </div>
              
              <div class="days-remaining">
                ${Math.abs(daysUntilExpiry)}
              </div>
              <div class="days-label">
                ${daysUntilExpiry > 0 ? 'Days Remaining' : 'Days Overdue'}
              </div>
              
              ${daysUntilExpiry < -7 ? `
                <div class="alert-box">
                  <p class="alert-title">⚠️ CREW BLOCKED FROM ASSIGNMENTS</p>
                  <p class="alert-text">This crew member cannot be assigned to any vessel until this document is renewed. The grace period has expired.</p>
                </div>
              ` : daysUntilExpiry < 0 ? `
                <div class="alert-box">
                  <p class="alert-title">⏰ GRACE PERIOD ACTIVE (${7 - Math.abs(daysUntilExpiry)} Days Remaining)</p>
                  <p class="alert-text">Crew can finish current voyage but will be blocked from new assignments in ${7 - Math.abs(daysUntilExpiry)} days. Please renew immediately.</p>
                </div>
              ` : daysUntilExpiry <= 15 ? `
                <div class="alert-box">
                  <p class="alert-title">📋 Action Required</p>
                  <p class="alert-text">Please upload the renewed document as soon as possible to avoid any disruption to crew assignments.</p>
                </div>
              ` : `
                <div class="alert-box">
                  <p class="alert-title">📋 Advance Notice</p>
                  <p class="alert-text">This is an early notification to allow sufficient time for document renewal. Please begin the renewal process soon.</p>
                </div>
              `}
              
              <div style="text-align: center;">
                <a href="http://localhost:5000/documents" class="cta-button">
                  📤 Upload Renewed Document
                </a>
              </div>
              
              <div class="footer">
                <p><strong>SeaCrewManager</strong> - Automated Document Compliance System</p>
                <p>This is an automated notification. Please do not reply to this email.</p>
                <p style="margin-top: 15px; font-size: 11px;">
                  You are receiving this because you are listed as the contact for crew member ${crewName}.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

            console.log(`\n📬 Sending to: ${recipientEmail}`);

            const result = await smtpEmailService.sendEmail({
                to: recipientEmail,
                subject: `📋 ${crewName}'s ${documentType} ${daysUntilExpiry > 0 ? `Expires in ${daysUntilExpiry} Days` : `Expired ${Math.abs(daysUntilExpiry)} Days Ago`}`,
                html: emailHtml
            });

            if (result.success) {
                console.log(`✅ ${documentType} email sent successfully!`);
            } else {
                console.error(`❌ Failed to send ${documentType} email`);
                console.error('Error:', result.error || 'Unknown error');
            }

            // Small delay between emails
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`❌ Error processing ${docType.toUpperCase()}:`, error);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ All test emails completed!');
    console.log('='.repeat(60));
    console.log('\n📧 Check your inbox at', recipientEmail);
    console.log('   You should have received emails for:');
    console.log('   1. PASSPORT ✅ (already sent)');
    console.log('   2. CDC');
    console.log('   3. COC');
    console.log('   4. MEDICAL CERTIFICATE\n');
}

// Run the script
sendAllDocumentTypeEmails()
    .then(() => {
        console.log('Test completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed:', error);
        process.exit(1);
    });

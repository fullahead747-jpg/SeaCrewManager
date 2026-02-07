import { MailService } from '@sendgrid/mail';

// Type definitions for notification data
export interface CrewNotificationData {
  crewName: string;
  vesselName?: string;
  alertType: 'contract_expiry' | 'document_expiry' | 'crew_rotation';
  daysUntilExpiry: number;
  contractEndDate?: Date;
  documentType?: string;
  documentExpiryDate?: Date;
}

// SendGrid Email Service - Using your API key for real email delivery
export class SendGridEmailService {
  private mailService: MailService;

  constructor() {
    this.mailService = new MailService();
    
    // Use the SendGrid API key from environment (stored in your app secrets)  
    const apiKey = process.env.SendGrid || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing SendGrid API key in environment");
      throw new Error("SendGrid API key not found in environment variables");
    }
    
    this.mailService.setApiKey(apiKey);
    console.log('🔑 SendGrid API key configured successfully');
    console.log('✅ SendGrid email service ready for real email delivery');
  }

  async sendEmail(emailData: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📧 Sending real email via SendGrid to: ${emailData.to}`);
      console.log(`📧 Subject: ${emailData.subject}`);
      
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'admin@offing.biz';
      
      const result = await this.mailService.send({
        to: emailData.to,
        from: fromEmail, // Using configurable verified sender
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });
      
      console.log('✅ Real email sent successfully via SendGrid!');
      console.log('📧 Message ID:', result[0]?.headers?.['x-message-id']);
      console.log('🎯 Email delivered to actual inbox:', emailData.to);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send email via SendGrid:', error);
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (error instanceof Error && 'response' in error) {
        const sgError = error as any;
        if (sgError.response?.body) {
          console.error('SendGrid error details:', sgError.response.body);
          errorMessage = sgError.response.body?.errors?.[0]?.message || errorMessage;
        }
      }
      return { success: false, error: errorMessage };
    }
  }

  async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
    const testEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; margin: 0; font-size: 24px;">🚀 SendGrid Email Working!</h1>
            <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System - Real Email Delivery</p>
          </div>
          
          <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #155724;">✅ Real Email System Active</h3>
            <p style="margin: 0; color: #155724;">
              Your crew management system is now sending <strong>real emails</strong> via SendGrid to:
            </p>
            <ul style="margin: 10px 0 0 20px; color: #155724;">
              <li>✉️ Contract renewals and expirations</li>
              <li>📋 Document expiry reminders</li>
              <li>🚢 Crew rotation schedules</li>
              <li>⚠️ System alerts and notifications</li>
            </ul>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #495057;">📋 System Status</h3>
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              ✅ Email service: <strong>SendGrid (Real Delivery)</strong><br>
              ✅ Recipient: <strong>${recipientEmail}</strong><br>
              ✅ Templates: <strong>Professional HTML + Text</strong><br>
              ✅ Scheduler: <strong>Running every hour</strong><br>
              ✅ API Key: <strong>Active & Configured</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px; margin: 0;">
              Real email sent via SendGrid at: ${new Date().toLocaleString()}
            </p>
            <p style="color: #6c757d; font-size: 12px; margin: 5px 0 0 0;">
              Check your actual inbox at ${recipientEmail}
            </p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: '🚀 SendGrid Test - Real Email Delivered!',
      html: testEmailHtml
    });
  }


  async sendUpcomingEventsReport(recipientEmail: string, upcomingEvents: any[]): Promise<{ success: boolean; error?: string }> {
    // Group events by type
    const contractEvents = upcomingEvents.filter(event => event.type === 'contract');
    const documentEvents = upcomingEvents.filter(event => event.type === 'document');
    const vesselDocumentEvents = upcomingEvents.filter(event => event.type === 'vessel_document');

    const formatEventsList = (events: any[]) => {
      if (events.length === 0) return '<p style="color: #6c757d; font-style: italic;">No upcoming events</p>';
      
      return events.map(event => {
        const urgencyClass = event.daysUntil <= 7 ? 'urgent' : event.daysUntil <= 15 ? 'warning' : 'normal';
        const urgencyColor = urgencyClass === 'urgent' ? '#dc3545' : urgencyClass === 'warning' ? '#fd7e14' : '#28a745';
        const urgencyIcon = urgencyClass === 'urgent' ? '🚨' : urgencyClass === 'warning' ? '⚠️' : '📅';
        
        return `
          <div style="border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 10px 0; background: ${urgencyClass === 'urgent' ? '#fff5f5' : urgencyClass === 'warning' ? '#fffaf0' : '#f8fff9'};">
            <div style="font-weight: bold; color: ${urgencyColor};">
              ${urgencyIcon} ${event.title}
            </div>
            <div style="color: #495057; font-size: 14px; margin-top: 5px;">
              ${event.description}
            </div>
            <div style="color: #6c757d; font-size: 12px; margin-top: 8px;">
              Due: ${event.date} (${event.daysUntil} days from now)
            </div>
          </div>
        `;
      }).join('');
    };

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007bff; margin: 0; font-size: 24px;">📋 Upcoming Events Report</h1>
            <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System - ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div style="background: #e3f2fd; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #0d47a1;">📊 Summary</h3>
            <p style="margin: 0; color: #0d47a1;">
              Total upcoming events: <strong>${upcomingEvents.length}</strong><br>
              Contract renewals: <strong>${contractEvents.length}</strong><br>
              Document expirations: <strong>${documentEvents.length}</strong><br>
              Vessel document expirations: <strong>${vesselDocumentEvents.length}</strong>
            </p>
          </div>
          
          <!-- Contract Events -->
          <div style="margin: 30px 0;">
            <h3 style="color: #495057; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              📝 Contract Renewals (${contractEvents.length})
            </h3>
            ${formatEventsList(contractEvents)}
          </div>
          
          <!-- Document Events -->
          <div style="margin: 30px 0;">
            <h3 style="color: #495057; border-bottom: 2px solid #fd7e14; padding-bottom: 10px;">
              📄 Document Expirations (${documentEvents.length})
            </h3>
            ${formatEventsList(documentEvents)}
          </div>
          
          <!-- Vessel Document Events -->
          <div style="margin: 30px 0;">
            <h3 style="color: #495057; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
              🚢 Vessel Document Expirations (${vesselDocumentEvents.length})
            </h3>
            ${formatEventsList(vesselDocumentEvents)}
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px; margin: 0;">
              Report generated: ${new Date().toLocaleString()}
            </p>
            <p style="color: #6c757d; font-size: 12px; margin: 5px 0 0 0;">
              Crew Management Pro - Automated Notification System
            </p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `📋 Upcoming Events Report - ${upcomingEvents.length} Events (${new Date().toLocaleDateString()})`,
      html: emailHtml
    });
  }
}

// Create singleton instance
export const sendGridEmailService = new SendGridEmailService();

// Export the send function for backward compatibility with notification service
export async function sendEmail(emailParams: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  return await sendGridEmailService.sendEmail({
    to: emailParams.to,
    subject: emailParams.subject,
    html: emailParams.html,
    text: emailParams.text
  });
}

// Export simple function for direct use
export async function sendNotificationEmail(recipientEmail: string, subject: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  return await sendGridEmailService.sendEmail({
    to: recipientEmail,
    subject: subject,
    html: htmlContent
  });
}

// Email template generators
export function generateContractExpiryEmail(data: CrewNotificationData): { subject: string; html: string; text: string } {
  const urgencyColor = data.daysUntilExpiry <= 7 ? '#dc3545' : data.daysUntilExpiry <= 15 ? '#fd7e14' : '#28a745';
  const urgencyIcon = data.daysUntilExpiry <= 7 ? '🚨' : data.daysUntilExpiry <= 15 ? '⚠️' : '📅';
  const urgencyText = data.daysUntilExpiry <= 7 ? 'URGENT' : data.daysUntilExpiry <= 15 ? 'WARNING' : 'NOTICE';

  const subject = `${urgencyIcon} Contract Expiry ${urgencyText} - ${data.crewName} (${data.daysUntilExpiry} days)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: ${urgencyColor}; margin: 0; font-size: 24px;">${urgencyIcon} Contract Expiry Alert</h1>
          <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System - ${urgencyText}</p>
        </div>
        
        <div style="background: ${data.daysUntilExpiry <= 7 ? '#fff5f5' : data.daysUntilExpiry <= 15 ? '#fffaf0' : '#f8fff9'}; border-left: 4px solid ${urgencyColor}; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: ${urgencyColor};">${urgencyIcon} Contract Renewal Required</h3>
          <p style="margin: 0; color: #495057;">
            <strong>Crew Member:</strong> ${data.crewName}<br>
            ${data.vesselName ? `<strong>Vessel:</strong> ${data.vesselName}<br>` : ''}
            <strong>Contract End Date:</strong> ${data.contractEndDate?.toLocaleDateString()}<br>
            <strong>Days Remaining:</strong> ${data.daysUntilExpiry} days
          </p>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #0d47a1;">📋 Action Required</h3>
          <p style="margin: 0; color: #0d47a1;">
            Please review and renew this contract before expiry to ensure continued crew assignment.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            This is an automated notification from your Crew Management System
          </p>
          <p style="color: #6c757d; font-size: 12px; margin: 5px 0 0 0;">
            Sent: ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
CONTRACT EXPIRY ALERT - ${urgencyText}

Crew Member: ${data.crewName}
${data.vesselName ? `Vessel: ${data.vesselName}\n` : ''}Contract End Date: ${data.contractEndDate?.toLocaleDateString()}
Days Remaining: ${data.daysUntilExpiry} days

ACTION REQUIRED: Please review and renew this contract before expiry to ensure continued crew assignment.

This is an automated notification from your Crew Management System.
Sent: ${new Date().toLocaleString()}
  `;

  return { subject, html, text };
}

export function generateDocumentExpiryEmail(data: CrewNotificationData): { subject: string; html: string; text: string } {
  const urgencyColor = data.daysUntilExpiry <= 7 ? '#dc3545' : data.daysUntilExpiry <= 15 ? '#fd7e14' : '#28a745';
  const urgencyIcon = data.daysUntilExpiry <= 7 ? '🚨' : data.daysUntilExpiry <= 15 ? '⚠️' : '📅';
  const urgencyText = data.daysUntilExpiry <= 7 ? 'URGENT' : data.daysUntilExpiry <= 15 ? 'WARNING' : 'NOTICE';

  const subject = `${urgencyIcon} Document Expiry ${urgencyText} - ${data.crewName} ${data.documentType} (${data.daysUntilExpiry} days)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: ${urgencyColor}; margin: 0; font-size: 24px;">${urgencyIcon} Document Expiry Alert</h1>
          <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System - ${urgencyText}</p>
        </div>
        
        <div style="background: ${data.daysUntilExpiry <= 7 ? '#fff5f5' : data.daysUntilExpiry <= 15 ? '#fffaf0' : '#f8fff9'}; border-left: 4px solid ${urgencyColor}; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: ${urgencyColor};">${urgencyIcon} Document Renewal Required</h3>
          <p style="margin: 0; color: #495057;">
            <strong>Crew Member:</strong> ${data.crewName}<br>
            <strong>Document Type:</strong> ${data.documentType?.toUpperCase()}<br>
            <strong>Expiry Date:</strong> ${data.documentExpiryDate?.toLocaleDateString()}<br>
            <strong>Days Remaining:</strong> ${data.daysUntilExpiry} days
          </p>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #0d47a1;">📋 Action Required</h3>
          <p style="margin: 0; color: #0d47a1;">
            Please renew this document before expiry to maintain crew compliance and certification.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            This is an automated notification from your Crew Management System
          </p>
          <p style="color: #6c757d; font-size: 12px; margin: 5px 0 0 0;">
            Sent: ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
DOCUMENT EXPIRY ALERT - ${urgencyText}

Crew Member: ${data.crewName}
Document Type: ${data.documentType?.toUpperCase()}
Expiry Date: ${data.documentExpiryDate?.toLocaleDateString()}
Days Remaining: ${data.daysUntilExpiry} days

ACTION REQUIRED: Please renew this document before expiry to maintain crew compliance and certification.

This is an automated notification from your Crew Management System.
Sent: ${new Date().toLocaleString()}
  `;

  return { subject, html, text };
}
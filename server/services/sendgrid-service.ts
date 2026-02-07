import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface CrewNotificationData {
  crewName: string;
  vesselName?: string;
  contractEndDate?: Date;
  documentType?: string;
  documentExpiryDate?: Date;
  alertType: 'contract_expiry' | 'document_expiry' | 'crew_rotation';
  daysUntilExpiry: number;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    });
    console.log(`✅ Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error);
    return false;
  }
}

export function generateContractExpiryEmail(data: CrewNotificationData): { subject: string; html: string; text: string } {
  const subject = `🚨 Contract Expiry Alert - ${data.crewName} (${data.daysUntilExpiry} days)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc3545; margin: 0; font-size: 24px;">⚠️ Contract Expiry Alert</h1>
          <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System Notification</p>
        </div>
        
        <div style="background: #fff5f5; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #dc3545;">Contract Expiring Soon</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Crew Member:</td>
              <td style="padding: 8px 0; color: #212529;">${data.crewName}</td>
            </tr>
            ${data.vesselName ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Vessel:</td>
              <td style="padding: 8px 0; color: #212529;">${data.vesselName}</td>
            </tr>` : ''}
            ${data.contractEndDate ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Contract End Date:</td>
              <td style="padding: 8px 0; color: #dc3545; font-weight: bold;">${data.contractEndDate.toLocaleDateString()}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Days Remaining:</td>
              <td style="padding: 8px 0; color: #dc3545; font-weight: bold; font-size: 18px;">${data.daysUntilExpiry} days</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #e7f3ff; border: 1px solid #b3d7ff; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #0066cc;">
            <strong>Action Required:</strong> Please review and renew the contract before it expires to avoid service disruption.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            This is an automated notification from your Crew Management System
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
🚨 CONTRACT EXPIRY ALERT

Crew Member: ${data.crewName}
${data.vesselName ? `Vessel: ${data.vesselName}` : ''}
${data.contractEndDate ? `Contract End Date: ${data.contractEndDate.toLocaleDateString()}` : ''}
Days Remaining: ${data.daysUntilExpiry} days

ACTION REQUIRED: Please review and renew the contract before it expires.

This is an automated notification from your Crew Management System.
  `;

  return { subject, html, text };
}

export function generateDocumentExpiryEmail(data: CrewNotificationData): { subject: string; html: string; text: string } {
  const subject = `📄 Document Expiry Alert - ${data.crewName} ${data.documentType} (${data.daysUntilExpiry} days)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffc107; margin: 0; font-size: 24px;">📄 Document Expiry Alert</h1>
          <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System Notification</p>
        </div>
        
        <div style="background: #fffbf0; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #856404;">Document Expiring Soon</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Crew Member:</td>
              <td style="padding: 8px 0; color: #212529;">${data.crewName}</td>
            </tr>
            ${data.documentType ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Document Type:</td>
              <td style="padding: 8px 0; color: #212529;">${data.documentType}</td>
            </tr>` : ''}
            ${data.documentExpiryDate ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Expiry Date:</td>
              <td style="padding: 8px 0; color: #ffc107; font-weight: bold;">${data.documentExpiryDate.toLocaleDateString()}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #495057;">Days Remaining:</td>
              <td style="padding: 8px 0; color: #ffc107; font-weight: bold; font-size: 18px;">${data.daysUntilExpiry} days</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #e7f3ff; border: 1px solid #b3d7ff; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #0066cc;">
            <strong>Action Required:</strong> Please renew or update this document before it expires to maintain compliance.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            This is an automated notification from your Crew Management System
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
📄 DOCUMENT EXPIRY ALERT

Crew Member: ${data.crewName}
${data.documentType ? `Document Type: ${data.documentType}` : ''}
${data.documentExpiryDate ? `Expiry Date: ${data.documentExpiryDate.toLocaleDateString()}` : ''}
Days Remaining: ${data.daysUntilExpiry} days

ACTION REQUIRED: Please renew or update this document before it expires.

This is an automated notification from your Crew Management System.
  `;

  return { subject, html, text };
}
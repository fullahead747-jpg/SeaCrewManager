import nodemailer from 'nodemailer';

// Gmail SMTP Email Service using App Password
export class SMTPEmailService {
  private transporter!: nodemailer.Transporter;
  private isConfigured: boolean = false;

  constructor() {
    this.attemptConfiguration();
  }

  private attemptConfiguration(): boolean {
    if (this.isConfigured) return true;

    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (gmailUser && gmailAppPassword) {
      try {
        // Use Gmail SMTP with App Password
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailAppPassword,
          },
        });
        this.isConfigured = true;
        console.log('✅ Gmail SMTP configured successfully with:', gmailUser);
        return true;
      } catch (error) {
        console.error('❌ Failed to create Gmail transporter:', error);
        return false;
      }
    } else {
      // Fallback to ethereal for testing if Gmail not configured
      // Only log this once deeply, or if specifically asked
      if (!this.transporter) {
        console.log('⚠️ Gmail configuration incomplete (v2.4-diagnostic):');
        if (!gmailUser) console.log('   - GMAIL_USER is missing');
        if (!gmailAppPassword) console.log('   - GMAIL_APP_PASSWORD is missing');

        const allKeys = Object.keys(process.env);
        const gmailRelated = allKeys.filter(k => k.toLowerCase().includes('gmail') || k.toLowerCase().includes('mail'));
        console.log('   Gmail-related keys found:', gmailRelated.length > 0 ? gmailRelated.join(', ') : 'NONE');
        console.log('   All available keys (first 20):', allKeys.slice(0, 20).join(', '));
        console.log('   Current working directory:', process.cwd());
        console.log('   Using test transport (Ethereal) temporarily');

        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: 'ethereal.user@ethereal.email',
            pass: 'ethereal.pass',
          },
        });
      }
      return false;
    }
  }

  isReady(): boolean {
    if (!this.isConfigured) {
      this.attemptConfiguration();
    }
    return this.isConfigured;
  }

  async sendEmail(emailData: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📧 Sending email to: ${emailData.to}`);
      console.log(`📧 Subject: ${emailData.subject}`);
      console.log(`📧 Gmail configured: ${this.isConfigured} (v2.4-diagnostic)`);
      if (!this.isConfigured) {
        console.log('🔍 Diagnostic Info:');
        console.log('   GMAIL_USER present:', !!process.env.GMAIL_USER);
        console.log('   GMAIL_APP_PASSWORD present:', !!process.env.GMAIL_APP_PASSWORD);
        console.log('   Available Keys:', Object.keys(process.env).filter(k => k.includes('GMAIL') || k.includes('API')).join(', '));
      }

      const fromEmail = process.env.GMAIL_USER || 'admin@offing.biz, management@fullahead.in';
      const info = await this.transporter.sendMail({
        from: `"Crew Management System" <${fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });

      console.log('✅ Email sent successfully:', info.messageId);
      if (nodemailer.getTestMessageUrl(info)) {
        console.log('🔗 View email online:', nodemailer.getTestMessageUrl(info));
      }
      console.log('📧 Email Details:');
      console.log('Subject:', emailData.subject);
      console.log('To:', emailData.to);
      console.log('✉️ REAL EMAIL SENT - Check your email or the online link above!');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to send email:', errorMessage);
      console.error('Full error:', error);
      return { success: false, error: errorMessage };
    }
  }

  async sendEmailWithAttachment(emailData: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📧 Sending email with attachment to: ${emailData.to}`);
      console.log(`📧 Subject: ${emailData.subject}`);
      console.log(`📧 Attachments: ${emailData.attachments?.length || 0}`);
      console.log(`📧 Gmail configured: ${this.isConfigured} (v2.2-diagnostic)`);
      if (!this.isConfigured) {
        console.log('🔍 Diagnostic Info:');
        console.log('   GMAIL_USER present:', !!process.env.GMAIL_USER);
        console.log('   GMAIL_APP_PASSWORD present:', !!process.env.GMAIL_APP_PASSWORD);
        console.log('   Available Keys:', Object.keys(process.env).filter(k => k.includes('GMAIL') || k.includes('API')).join(', '));
      }

      const fromEmail = process.env.GMAIL_USER || 'admin@offing.biz, management@fullahead.in';
      const info = await this.transporter.sendMail({
        from: `"Crew Management System" <${fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
        attachments: emailData.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType || 'application/pdf',
        })),
      });

      console.log('✅ Email with attachment sent successfully:', info.messageId);
      if (nodemailer.getTestMessageUrl(info)) {
        console.log('🔗 View email online:', nodemailer.getTestMessageUrl(info));
      }
      console.log('📧 Email Details:');
      console.log('Subject:', emailData.subject);
      console.log('To:', emailData.to);
      console.log('Attachments:', emailData.attachments?.map(a => a.filename).join(', '));
      console.log('✉️ REAL EMAIL WITH ATTACHMENT SENT!');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to send email with attachment:', errorMessage);
      console.error('Full error:', error);
      return { success: false, error: errorMessage };
    }
  }

  async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
    const testEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; margin: 0; font-size: 24px;">✅ Email System Working!</h1>
            <p style="color: #6c757d; margin: 10px 0 0 0;">Crew Management System</p>
          </div>
          
          <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #155724;">📧 Email Notifications Ready</h3>
            <p style="margin: 0; color: #155724;">
              Your crew management system is now successfully sending emails for:
            </p>
            <ul style="margin: 10px 0 0 20px; color: #155724;">
              <li>Contract renewals and expirations</li>
              <li>Document expiry reminders</li>
              <li>Crew rotation schedules</li>
              <li>System alerts and notifications</li>
            </ul>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #495057;">📋 System Status</h3>
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              ✅ Email service: <strong>Active</strong><br>
              ✅ Recipient: <strong>${recipientEmail}</strong><br>
              ✅ Templates: <strong>Professional HTML + Text</strong><br>
              ✅ Scheduler: <strong>Running every hour</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px; margin: 0;">
              Test sent at: ${new Date().toLocaleString()}
            </p>
            <p style="color: #6c757d; font-size: 12px; margin: 5px 0 0 0;">
              Crew Management Pro - Email Notification System
            </p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: '✅ Email Test Successful - Crew Management System',
      html: testEmailHtml
    });
  }

  async sendUpcomingEventsEmail(recipientEmail: string, events: any[]): Promise<{ success: boolean; error?: string }> {
    const severityColors: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#d97706',
      low: '#059669'
    };

    const severityBg: Record<string, string> = {
      critical: '#fef2f2',
      high: '#fff7ed',
      medium: '#fffbeb',
      low: '#f0fdf4'
    };

    const upcomingEventsHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; margin: 0; font-size: 24px;">📋 Upcoming Events Report</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Crew Management System - Next 30 Days</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 15px;">Summary</h2>
            <p style="color: #374151; line-height: 1.5;">
              This report contains ${events.length} upcoming events requiring attention:
            </p>
            <ul style="color: #374151; margin: 10px 0;">
              <li>${events.filter(e => e.type === 'contract_expiry').length} Contract Expiries</li>
              <li>${events.filter(e => e.type === 'document_expiry').length} Document Expiries</li>
              <li>${events.filter(e => e.type === 'crew_rotation').length} Crew Rotations</li>
            </ul>
          </div>

          ${events.map((event, index) => {
      let title, description, icon;
      if (event.type === 'contract_expiry') {
        title = `Contract Expiry - ${event.crewMemberName}`;
        description = `Contract on vessel ${event.vesselName} expires on ${event.date.toDateString()}`;
        icon = '📋';
      } else if (event.type === 'document_expiry') {
        title = `Document Expiry - ${event.crewMemberName}`;
        description = `${event.documentType} expires on ${event.date.toDateString()}`;
        icon = '📄';
      } else if (event.type === 'crew_rotation') {
        title = `Crew Rotation - ${event.crewMemberName}`;
        description = `Scheduled to ${event.rotationType} vessel ${event.vesselName} on ${event.date.toDateString()}`;
        icon = '🔄';
      }

      return `
              <div style="background: ${severityBg[event.severity]}; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid ${severityColors[event.severity]};">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                  <span style="font-size: 20px; margin-right: 10px;">${icon}</span>
                  <h3 style="color: #1f2937; margin: 0; font-size: 16px;">${title}</h3>
                  <span style="margin-left: auto; background: ${severityColors[event.severity]}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; text-transform: uppercase; font-weight: bold;">${event.severity}</span>
                </div>
                <p style="color: #374151; margin: 0; line-height: 1.5;">${description}</p>
                <div style="margin-top: 10px; font-size: 14px; color: #6b7280;">
                  <strong>Days remaining:</strong> ${Math.ceil((event.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                </div>
              </div>
            `;
    }).join('')}

          <div style="margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 6px;">
            <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">📧 Notification Settings</h3>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This email was sent to: <strong>${recipientEmail}</strong><br>
              Generated on: ${new Date().toLocaleString()}<br>
              System: Crew Management Pro
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px 0; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated notification from the Crew Management System<br>
              Please contact your system administrator if you have any questions
            </p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: '📋 Upcoming Events Report - Crew Management System',
      html: upcomingEventsHtml
    });
  }

  async sendNotificationEmail(
    recipientEmail: string,
    title: string,
    description: string,
    type: string
  ): Promise<{ success: boolean; error?: string }> {
    const typeIcons: Record<string, string> = {
      contract_expiry: '📋',
      document_expiry: '📄',
      crew_rotation: '🔄'
    };

    const notificationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 24px;">${typeIcons[type] || '🔔'} ${title}</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Crew Management System Alert</p>
          </div>
          
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <p style="color: #374151; margin: 0; line-height: 1.5; font-size: 16px;">
              ${description}
            </p>
          </div>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">📧 Alert Details</h3>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Alert Type: <strong>${type.replace('_', ' ')}</strong><br>
              Sent to: <strong>${recipientEmail}</strong><br>
              Time: <strong>${new Date().toLocaleString()}</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding: 20px 0; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This is an automated alert from the Crew Management System<br>
              Please take appropriate action as required
            </p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `🚨 ${title} - Crew Management Alert`,
      html: notificationHtml
    });
  }

  async sendComplianceDigest(recipientEmail: string, alerts: any[]): Promise<{ success: boolean; error?: string }> {
    const criticalAlerts = alerts.filter(a => a.daysUntilExpiry <= 15);
    const urgentAlerts = alerts.filter(a => a.daysUntilExpiry > 15 && a.daysUntilExpiry <= 30);
    const planningAlerts = alerts.filter(a => a.daysUntilExpiry > 30 && a.daysUntilExpiry <= 60);

    const digestHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background: #1e3a5f; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 20px;">Daily Compliance Digest</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${new Date().toLocaleDateString()}</p>
          </div>

          <div style="padding: 20px;">
            <p style="color: #374151;">Hello Fleet Manager,</p>
            <p style="color: #374151;">Here is the daily summary of crew document compliance alerts that require your attention.</p>
            
            <div style="display: grid; grid-template-cols: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
              <div style="background: #fee2e2; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="color: #b91c1c; font-size: 24px; font-weight: bold;">${criticalAlerts.length}</div>
                <div style="color: #b91c1c; font-size: 10px; text-transform: uppercase;">Critical</div>
              </div>
              <div style="background: #ffedd5; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="color: #9a3412; font-size: 24px; font-weight: bold;">${urgentAlerts.length}</div>
                <div style="color: #9a3412; font-size: 10px; text-transform: uppercase;">Urgent</div>
              </div>
              <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="color: #475569; font-size: 24px; font-weight: bold;">${planningAlerts.length}</div>
                <div style="color: #475569; font-size: 10px; text-transform: uppercase;">Planning</div>
              </div>
            </div>

            ${criticalAlerts.length > 0 ? `
              <h3 style="color: #b91c1c; border-bottom: 2px solid #fee2e2; padding-bottom: 5px;">🚨 Critical Alerts (≤ 15 days)</h3>
              ${criticalAlerts.map(a => `
                <div style="margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">
                  <strong style="color: #1e293b;">${a.crewMember.firstName} ${a.crewMember.lastName}</strong> (${a.crewMember.rank || 'N/A'})
                  <div style="font-size: 13px; color: #64748b;">
                    ${a.document.type.toUpperCase()} - Expires in <strong>${a.daysUntilExpiry} days</strong> (${new Date(a.document.expiryDate).toLocaleDateString()})
                    ${a.vesselName ? `<br>Vessel: ${a.vesselName}` : ''}
                  </div>
                </div>
              `).join('')}
            ` : ''}

            ${urgentAlerts.length > 0 ? `
              <h3 style="color: #9a3412; border-bottom: 2px solid #ffedd5; padding-bottom: 5px; margin-top: 20px;">⚠️ Urgent Alerts (16-30 days)</h3>
              ${urgentAlerts.map(a => `
                <div style="margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">
                  <strong style="color: #1e293b;">${a.crewMember.firstName} ${a.crewMember.lastName}</strong>
                  <div style="font-size: 13px; color: #64748b;">
                    ${a.document.type.toUpperCase()} - Expires in ${a.daysUntilExpiry} days
                  </div>
                </div>
              `).join('')}
            ` : ''}

            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.APP_URL || 'http://localhost:5000'}/dashboard" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Dashboard</a>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
            This is an automated daily digest from Crew Management Pro.
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `Daily Compliance Digest - ${criticalAlerts.length} Critical Alerts`,
      html: digestHtml
    });
  }
}

export const smtpEmailService = new SMTPEmailService();

// Export functions for backward compatibility
export const sendEmail = (emailData: any) => smtpEmailService.sendEmail(emailData);
export const sendTestEmail = (recipientEmail: string) => smtpEmailService.sendTestEmail(recipientEmail);
export const sendNotificationEmail = (recipientEmail: string, title: string, description: string, type: string) =>
  smtpEmailService.sendNotificationEmail(recipientEmail, title, description, type);

// CDC Document Expiry Alert Email Template
export interface CDCExpiryAlertData {
  crewMemberName: string;
  crewMemberRank?: string;
  crewMemberNationality?: string;
  vesselName?: string;
  cdcNumber: string;
  issuingAuthority: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  documentViewUrl?: string; // Phase 2A: Secure document link
}

export function generateCDCExpiryEmail(data: CDCExpiryAlertData): { subject: string; html: string; text: string } {
  const urgencyLevel = data.daysUntilExpiry <= 10 ? 'critical' :
    data.daysUntilExpiry <= 30 ? 'high' :
      data.daysUntilExpiry <= 45 ? 'medium' : 'low';

  const urgencyColors = {
    critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
    high: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', badge: '#ea580c' },
    medium: { bg: '#fffbeb', border: '#d97706', text: '#92400e', badge: '#d97706' },
    low: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', badge: '#22c55e' }
  };

  const colors = urgencyColors[urgencyLevel];
  const urgencyText = urgencyLevel === 'critical' ? 'URGENT' :
    urgencyLevel === 'high' ? 'HIGH PRIORITY' :
      urgencyLevel === 'medium' ? 'ATTENTION NEEDED' : 'REMINDER';

  const formattedExpiryDate = data.expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = urgencyLevel === 'critical'
    ? `🚨 URGENT: CDC Expiring in ${data.daysUntilExpiry} days - ${data.crewMemberName}`
    : `📋 CDC Expiry Alert (${data.daysUntilExpiry} days) - ${data.crewMemberName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
            🚢 Crew Management System
          </h1>
          <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">
            Document Expiry Notification
          </p>
        </div>
        
        <!-- Main Content -->
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Urgency Banner -->
          <div style="background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <span style="background: ${colors.badge}; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px;">
              ${urgencyText}
            </span>
            <h2 style="color: ${colors.text}; margin: 15px 0 5px 0; font-size: 28px; font-weight: bold;">
              ${data.daysUntilExpiry} Days Until Expiry
            </h2>
            <p style="color: ${colors.text}; margin: 0; font-size: 14px;">
              Continuous Discharge Certificate (CDC)
            </p>
          </div>

          <!-- Crew Member Info Card -->
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
              <span style="margin-right: 8px;">👤</span> Crew Member Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Name:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberName}</td>
              </tr>
              ${data.crewMemberRank ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rank:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberRank}</td>
              </tr>
              ` : ''}
              ${data.crewMemberNationality ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nationality:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberNationality}</td>
              </tr>
              ` : ''}
              ${data.vesselName ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Current Vessel:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.vesselName}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- CDC Document Info Card -->
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
              <span style="margin-right: 8px;">📄</span> CDC Document Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #78350f; font-size: 14px; width: 40%;">CDC Number:</td>
                <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">${data.cdcNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #78350f; font-size: 14px;">Issuing Authority:</td>
                <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">${data.issuingAuthority}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #78350f; font-size: 14px;">Expiry Date:</td>
                <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">${formattedExpiryDate}</td>
              </tr>
            </table>
          </div>

          <!-- Action Required Section -->
          <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 16px;">
              ⚡ Recommended Actions
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
              <li style="margin-bottom: 10px;">Contact the crew member to initiate CDC renewal process</li>
              <li style="margin-bottom: 10px;">Verify current vessel assignment and schedule</li>
              <li style="margin-bottom: 10px;">Prepare required documentation for renewal application</li>
              <li style="margin-bottom: 0;">Update crew records once renewal is completed</li>
            </ul>
          </div>

          <!-- View Document Button (Phase 2A) -->
          ${data.documentViewUrl ? `
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; text-align: center;">
            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
              📄 View Your Document
            </h3>
            <a href="${data.documentViewUrl}" 
               style="background: #ffffff; color: #2563eb; padding: 14px 32px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🔗 Open CDC Document
            </a>
            <p style="color: #dbeafe; font-size: 13px; margin: 15px 0 0 0;">
              ⏰ This secure link expires in 48 hours
            </p>
          </div>
          ` : ''}

          <!-- Alert Schedule Info -->
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">
              📅 <strong>Alert Schedule:</strong> Notifications are sent at 60, 45, 30, and 10 days before expiry
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This is an automated notification from the Crew Management System<br>
            Sent to: ${data.crewMemberName} | ${new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
CDC DOCUMENT EXPIRY ALERT - ${urgencyText}

${data.daysUntilExpiry} Days Until Expiry

CREW MEMBER DETAILS:
- Name: ${data.crewMemberName}
${data.crewMemberRank ? `- Rank: ${data.crewMemberRank}` : ''}
${data.crewMemberNationality ? `- Nationality: ${data.crewMemberNationality}` : ''}
${data.vesselName ? `- Current Vessel: ${data.vesselName}` : ''}

CDC DOCUMENT INFORMATION:
- CDC Number: ${data.cdcNumber}
- Issuing Authority: ${data.issuingAuthority}
- Expiry Date: ${formattedExpiryDate}

RECOMMENDED ACTIONS:
1. Contact the crew member to initiate CDC renewal process
2. Verify current vessel assignment and schedule
3. Prepare required documentation for renewal application
4. Update crew records once renewal is completed

Alert Schedule: Notifications are sent at 60, 45, 30, and 10 days before expiry

---
This is an automated notification from the Crew Management System
  `;

  return { subject, html, text };
}

export async function sendCDCExpiryAlert(recipientEmail: string, data: CDCExpiryAlertData): Promise<{ success: boolean; error?: string }> {
  const emailContent = generateCDCExpiryEmail(data);
  return smtpEmailService.sendEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  });
}

// Passport Document Expiry Alert Email Template
export interface PassportExpiryAlertData {
  crewMemberName: string;
  crewMemberRank?: string;
  crewMemberNationality?: string;
  vesselName?: string;
  passportNumber: string;
  issuingAuthority: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  documentViewUrl?: string; // Phase 2A: Secure document link
}

export function generatePassportExpiryEmail(data: PassportExpiryAlertData): { subject: string; html: string; text: string } {
  const urgencyLevel = data.daysUntilExpiry <= 10 ? 'critical' :
    data.daysUntilExpiry <= 30 ? 'high' :
      data.daysUntilExpiry <= 45 ? 'medium' : 'low';

  const urgencyColors = {
    critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
    high: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', badge: '#ea580c' },
    medium: { bg: '#fffbeb', border: '#d97706', text: '#92400e', badge: '#d97706' },
    low: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', badge: '#22c55e' }
  };

  const colors = urgencyColors[urgencyLevel];
  const urgencyText = urgencyLevel === 'critical' ? 'URGENT' :
    urgencyLevel === 'high' ? 'HIGH PRIORITY' :
      urgencyLevel === 'medium' ? 'ATTENTION NEEDED' : 'REMINDER';

  const formattedExpiryDate = data.expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const subject = urgencyLevel === 'critical'
    ? `🚨 URGENT: Passport Expiring in ${data.daysUntilExpiry} days - ${data.crewMemberName}`
    : `🛂 Passport Expiry Alert (${data.daysUntilExpiry} days) - ${data.crewMemberName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
            🚢 Crew Management System
          </h1>
          <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">
            Passport Expiry Notification
          </p>
        </div>
        
        <!-- Main Content -->
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Urgency Banner -->
          <div style="background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <span style="background: ${colors.badge}; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 1px;">
              ${urgencyText}
            </span>
            <h2 style="color: ${colors.text}; margin: 15px 0 5px 0; font-size: 28px; font-weight: bold;">
              ${data.daysUntilExpiry} Days Until Expiry
            </h2>
            <p style="color: ${colors.text}; margin: 0; font-size: 14px;">
              Passport Document
            </p>
          </div>

          <!-- Crew Member Info Card -->
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
              <span style="margin-right: 8px;">👤</span> Crew Member Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Name:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberName}</td>
              </tr>
              ${data.crewMemberRank ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rank:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberRank}</td>
              </tr>
              ` : ''}
              ${data.crewMemberNationality ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nationality:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberNationality}</td>
              </tr>
              ` : ''}
              ${data.vesselName ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Current Vessel:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.vesselName}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Passport Document Info Card -->
          <div style="background: #dbeafe; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
            <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
              <span style="margin-right: 8px;">🛂</span> Passport Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #1e40af; font-size: 14px; width: 40%;">Passport Number:</td>
                <td style="padding: 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">${data.passportNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #1e40af; font-size: 14px;">Issuing Country:</td>
                <td style="padding: 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">${data.issuingAuthority}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #1e40af; font-size: 14px;">Expiry Date:</td>
                <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">${formattedExpiryDate}</td>
              </tr>
            </table>
          </div>

          <!-- Action Required Section -->
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">
              ⚡ Recommended Actions
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 10px;">Contact the crew member to initiate passport renewal process</li>
              <li style="margin-bottom: 10px;">Verify current vessel assignment and travel schedule</li>
              <li style="margin-bottom: 10px;">Ensure visa requirements are reviewed for new passport</li>
              <li style="margin-bottom: 0;">Update crew records once renewal is completed</li>
            </ul>
          </div>

          <!-- View Document Button (Phase 2A) -->
          ${data.documentViewUrl ? `
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; text-align: center;">
            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
              📄 View Your Document
            </h3>
            <a href="${data.documentViewUrl}" 
               style="background: #ffffff; color: #2563eb; padding: 14px 32px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🔗 Open Passport Document
            </a>
            <p style="color: #dbeafe; font-size: 13px; margin: 15px 0 0 0;">
              ⏰ This secure link expires in 48 hours
            </p>
          </div>
          ` : ''}

          <!-- Alert Schedule Info -->
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">
              📅 <strong>Alert Schedule:</strong> Notifications are sent at 60, 45, 30, and 10 days before expiry
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            This is an automated notification from the Crew Management System<br>
            Sent to: ${data.crewMemberName} | ${new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PASSPORT EXPIRY ALERT - ${urgencyText}

${data.daysUntilExpiry} Days Until Expiry

CREW MEMBER DETAILS:
- Name: ${data.crewMemberName}
${data.crewMemberRank ? `- Rank: ${data.crewMemberRank}` : ''}
${data.crewMemberNationality ? `- Nationality: ${data.crewMemberNationality}` : ''}
${data.vesselName ? `- Current Vessel: ${data.vesselName}` : ''}

PASSPORT INFORMATION:
- Passport Number: ${data.passportNumber}
- Issuing Country: ${data.issuingAuthority}
- Expiry Date: ${formattedExpiryDate}

RECOMMENDED ACTIONS:
1. Contact the crew member to initiate passport renewal process
2. Verify current vessel assignment and travel schedule
3. Ensure visa requirements are reviewed for new passport
4. Update crew records once renewal is completed

Alert Schedule: Notifications are sent at 60, 45, 30, and 10 days before expiry

---
This is an automated notification from the Crew Management System
  `;

  return { subject, html, text };
}

export async function sendPassportExpiryAlert(recipientEmail: string, data: PassportExpiryAlertData): Promise<{ success: boolean; error?: string }> {
  const emailContent = generatePassportExpiryEmail(data);
  return smtpEmailService.sendEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  });
}

// COC (Certificate of Competency) Document Expiry Alert Email Template
export interface COCExpiryAlertData {
  crewMemberName: string;
  crewMemberRank?: string;
  crewMemberNationality?: string;
  vesselName?: string;
  cocNumber: string;
  issuingAuthority: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  documentViewUrl?: string; // Phase 2A: Secure document link
}

export function generateCOCExpiryEmail(data: COCExpiryAlertData): { subject: string; html: string; text: string } {
  const urgencyLevel = data.daysUntilExpiry <= 10 ? 'critical' :
    data.daysUntilExpiry <= 30 ? 'high' :
      data.daysUntilExpiry <= 45 ? 'medium' : 'low';

  const urgencyColors = {
    critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
    high: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', badge: '#ea580c' },
    medium: { bg: '#fffbeb', border: '#d97706', text: '#92400e', badge: '#d97706' },
    low: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', badge: '#22c55e' }
  };

  const colors = urgencyColors[urgencyLevel];
  const urgencyText = urgencyLevel === 'critical' ? 'URGENT' :
    urgencyLevel === 'high' ? 'HIGH PRIORITY' :
      urgencyLevel === 'medium' ? 'ATTENTION NEEDED' : 'REMINDER';

  const formattedExpiryDate = data.expiryDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const subject = urgencyLevel === 'critical'
    ? `🚨 URGENT: COC Expiring in ${data.daysUntilExpiry} days - ${data.crewMemberName}`
    : `📜 COC Expiry Alert (${data.daysUntilExpiry} days) - ${data.crewMemberName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚢 Crew Management System</h1>
          <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">Certificate of Competency Expiry Notification</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <span style="background: ${colors.badge}; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">${urgencyText}</span>
            <h2 style="color: ${colors.text}; margin: 15px 0 5px 0; font-size: 28px; font-weight: bold;">${data.daysUntilExpiry} Days Until Expiry</h2>
            <p style="color: ${colors.text}; margin: 0; font-size: 14px;">Certificate of Competency (COC)</p>
          </div>
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">👤 Crew Member Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Name:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberName}</td></tr>
              ${data.crewMemberRank ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rank:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberRank}</td></tr>` : ''}
              ${data.crewMemberNationality ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nationality:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberNationality}</td></tr>` : ''}
              ${data.vesselName ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Current Vessel:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.vesselName}</td></tr>` : ''}
            </table>
          </div>
          <div style="background: #e0e7ff; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #4f46e5;">
            <h3 style="color: #3730a3; margin: 0 0 15px 0; font-size: 16px;">📜 COC Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #3730a3; font-size: 14px; width: 40%;">COC Number:</td><td style="padding: 8px 0; color: #3730a3; font-size: 14px; font-weight: 600;">${data.cocNumber}</td></tr>
              <tr><td style="padding: 8px 0; color: #3730a3; font-size: 14px;">Issuing Authority:</td><td style="padding: 8px 0; color: #3730a3; font-size: 14px; font-weight: 600;">${data.issuingAuthority}</td></tr>
              <tr><td style="padding: 8px 0; color: #3730a3; font-size: 14px;">Expiry Date:</td><td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">${formattedExpiryDate}</td></tr>
            </table>
          </div>
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">⚡ Recommended Actions</h3>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 10px;">Contact the crew member to initiate COC renewal process</li>
              <li style="margin-bottom: 10px;">Verify current vessel assignment and duties</li>
              <li style="margin-bottom: 10px;">Ensure all required sea service documentation is available</li>
              <li style="margin-bottom: 0;">Update crew records once renewal is completed</li>
            </ul>
          </div>

          <!-- View Document Button (Phase 2A) -->
          ${data.documentViewUrl ? `
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; text-align: center;">
            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
              📄 View Your Document
            </h3>
            <a href="${data.documentViewUrl}" 
               style="background: #ffffff; color: #2563eb; padding: 14px 32px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🔗 Open COC Document
            </a>
            <p style="color: #dbeafe; font-size: 13px; margin: 15px 0 0 0;">
              ⏰ This secure link expires in 48 hours
            </p>
          </div>
          ` : ''}
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">📅 <strong>Alert Schedule:</strong> Notifications are sent at 60, 45, 30, and 10 days before expiry</p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from the Crew Management System<br>Sent to: ${data.crewMemberName} | ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `COC EXPIRY ALERT - ${urgencyText}\n\n${data.daysUntilExpiry} Days Until Expiry\n\nCREW MEMBER: ${data.crewMemberName}${data.crewMemberRank ? `, ${data.crewMemberRank}` : ''}${data.vesselName ? ` on ${data.vesselName}` : ''}\n\nCOC INFORMATION:\n- COC Number: ${data.cocNumber}\n- Issuing Authority: ${data.issuingAuthority}\n- Expiry Date: ${formattedExpiryDate}\n\nAlert Schedule: 60, 45, 30, and 10 days before expiry`;

  return { subject, html, text };
}

export async function sendCOCExpiryAlert(recipientEmail: string, data: COCExpiryAlertData): Promise<{ success: boolean; error?: string }> {
  const emailContent = generateCOCExpiryEmail(data);
  return smtpEmailService.sendEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  });
}

// Medical Certificate Document Expiry Alert Email Template
export interface MedicalExpiryAlertData {
  crewMemberName: string;
  crewMemberRank?: string;
  crewMemberNationality?: string;
  vesselName?: string;
  medicalNumber: string;
  issuingAuthority: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  documentViewUrl?: string; // Phase 2A: Secure document link
}

export function generateMedicalExpiryEmail(data: MedicalExpiryAlertData): { subject: string; html: string; text: string } {
  const urgencyLevel = data.daysUntilExpiry <= 10 ? 'critical' :
    data.daysUntilExpiry <= 30 ? 'high' :
      data.daysUntilExpiry <= 45 ? 'medium' : 'low';

  const urgencyColors = {
    critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
    high: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', badge: '#ea580c' },
    medium: { bg: '#fffbeb', border: '#d97706', text: '#92400e', badge: '#d97706' },
    low: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', badge: '#22c55e' }
  };

  const colors = urgencyColors[urgencyLevel];
  const urgencyText = urgencyLevel === 'critical' ? 'URGENT' :
    urgencyLevel === 'high' ? 'HIGH PRIORITY' :
      urgencyLevel === 'medium' ? 'ATTENTION NEEDED' : 'REMINDER';

  const formattedExpiryDate = data.expiryDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const subject = urgencyLevel === 'critical'
    ? `🚨 URGENT: Medical Certificate Expiring in ${data.daysUntilExpiry} days - ${data.crewMemberName}`
    : `🏥 Medical Certificate Expiry Alert (${data.daysUntilExpiry} days) - ${data.crewMemberName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚢 Crew Management System</h1>
          <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">Medical Certificate Expiry Notification</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <span style="background: ${colors.badge}; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">${urgencyText}</span>
            <h2 style="color: ${colors.text}; margin: 15px 0 5px 0; font-size: 28px; font-weight: bold;">${data.daysUntilExpiry} Days Until Expiry</h2>
            <p style="color: ${colors.text}; margin: 0; font-size: 14px;">Medical Certificate</p>
          </div>
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">👤 Crew Member Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Name:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberName}</td></tr>
              ${data.crewMemberRank ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rank:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberRank}</td></tr>` : ''}
              ${data.crewMemberNationality ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nationality:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberNationality}</td></tr>` : ''}
              ${data.vesselName ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Current Vessel:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.vesselName}</td></tr>` : ''}
            </table>
          </div>
          <div style="background: #dcfce7; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #16a34a;">
            <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 16px;">🏥 Medical Certificate Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #166534; font-size: 14px; width: 40%;">Certificate Number:</td><td style="padding: 8px 0; color: #166534; font-size: 14px; font-weight: 600;">${data.medicalNumber}</td></tr>
              <tr><td style="padding: 8px 0; color: #166534; font-size: 14px;">Issuing Authority:</td><td style="padding: 8px 0; color: #166534; font-size: 14px; font-weight: 600;">${data.issuingAuthority}</td></tr>
              <tr><td style="padding: 8px 0; color: #166534; font-size: 14px;">Expiry Date:</td><td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">${formattedExpiryDate}</td></tr>
            </table>
          </div>
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">⚡ Recommended Actions</h3>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 10px;">Schedule a medical examination for the crew member</li>
              <li style="margin-bottom: 10px;">Verify current health requirements and fitness standards</li>
              <li style="margin-bottom: 10px;">Ensure all required medical tests are completed before renewal</li>
              <li style="margin-bottom: 0;">Update crew records once new certificate is issued</li>
            </ul>
          </div>

          <!-- View Document Button (Phase 2A) -->
          ${data.documentViewUrl ? `
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; text-align: center;">
            <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
              📄 View Your Document
            </h3>
            <a href="${data.documentViewUrl}" 
               style="background: #ffffff; color: #2563eb; padding: 14px 32px; text-decoration: none; 
                      border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              🔗 Open Medical Certificate
            </a>
            <p style="color: #dbeafe; font-size: 13px; margin: 15px 0 0 0;">
              ⏰ This secure link expires in 48 hours
            </p>
          </div>
          ` : ''}
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">📅 <strong>Alert Schedule:</strong> Notifications are sent at 60, 45, 30, and 10 days before expiry</p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from the Crew Management System<br>Sent to: ${data.crewMemberName} | ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `MEDICAL CERTIFICATE EXPIRY ALERT - ${urgencyText}\n\n${data.daysUntilExpiry} Days Until Expiry\n\nCREW MEMBER: ${data.crewMemberName}${data.crewMemberRank ? `, ${data.crewMemberRank}` : ''}${data.vesselName ? ` on ${data.vesselName}` : ''}\n\nMEDICAL CERTIFICATE INFORMATION:\n- Certificate Number: ${data.medicalNumber}\n- Issuing Authority: ${data.issuingAuthority}\n- Expiry Date: ${formattedExpiryDate}\n\nAlert Schedule: 60, 45, 30, and 10 days before expiry`;

  return { subject, html, text };
}

export async function sendMedicalExpiryAlert(recipientEmail: string, data: MedicalExpiryAlertData): Promise<{ success: boolean; error?: string }> {
  const emailContent = generateMedicalExpiryEmail(data);
  return smtpEmailService.sendEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  });
}

// Consolidated Document Expiry Alert - All documents in one email
export interface ConsolidatedDocumentData {
  crewMemberName: string;
  crewMemberRank?: string;
  crewMemberNationality?: string;
  vesselName?: string;
  documents: {
    type: 'CDC' | 'Passport' | 'COC' | 'Medical';
    documentNumber: string;
    issuingAuthority: string;
    expiryDate: Date;
    daysUntilExpiry: number;
  }[];
}

export function generateConsolidatedExpiryEmail(data: ConsolidatedDocumentData): { subject: string; html: string; text: string } {
  const minDays = Math.min(...data.documents.map(d => d.daysUntilExpiry));
  const urgencyLevel = minDays <= 10 ? 'critical' : minDays <= 30 ? 'high' : minDays <= 45 ? 'medium' : 'low';

  const urgencyColors = {
    critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
    high: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', badge: '#ea580c' },
    medium: { bg: '#fffbeb', border: '#d97706', text: '#92400e', badge: '#d97706' },
    low: { bg: '#f0fdf4', border: '#22c55e', text: '#166534', badge: '#22c55e' }
  };

  const colors = urgencyColors[urgencyLevel];
  const urgencyText = urgencyLevel === 'critical' ? 'URGENT' : urgencyLevel === 'high' ? 'HIGH PRIORITY' : urgencyLevel === 'medium' ? 'ATTENTION NEEDED' : 'REMINDER';

  const docTypeConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
    'CDC': { icon: '📋', color: '#1e40af', bgColor: '#dbeafe' },
    'Passport': { icon: '🛂', color: '#1e40af', bgColor: '#dbeafe' },
    'COC': { icon: '📜', color: '#3730a3', bgColor: '#e0e7ff' },
    'Medical': { icon: '🏥', color: '#166534', bgColor: '#dcfce7' }
  };

  const documentCards = data.documents.map(doc => {
    const config = docTypeConfig[doc.type] || docTypeConfig['CDC'];
    const formattedDate = doc.expiryDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const daysColor = doc.daysUntilExpiry <= 10 ? '#dc2626' : doc.daysUntilExpiry <= 30 ? '#ea580c' : '#d97706';
    return `
      <div style="background: ${config.bgColor}; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid ${config.color};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h4 style="color: ${config.color}; margin: 0; font-size: 16px;">${config.icon} ${doc.type}</h4>
          <span style="background: ${daysColor}; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">${doc.daysUntilExpiry} days</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; color: ${config.color}; font-size: 13px; width: 40%;">Number:</td><td style="padding: 4px 0; color: ${config.color}; font-size: 13px; font-weight: 600;">${doc.documentNumber}</td></tr>
          <tr><td style="padding: 4px 0; color: ${config.color}; font-size: 13px;">Authority:</td><td style="padding: 4px 0; color: ${config.color}; font-size: 13px; font-weight: 600;">${doc.issuingAuthority}</td></tr>
          <tr><td style="padding: 4px 0; color: ${config.color}; font-size: 13px;">Expires:</td><td style="padding: 4px 0; color: #dc2626; font-size: 13px; font-weight: bold;">${formattedDate}</td></tr>
        </table>
      </div>
    `;
  }).join('');

  const subject = urgencyLevel === 'critical'
    ? `🚨 URGENT: Multiple Documents Expiring - ${data.crewMemberName}`
    : `📋 Document Expiry Summary (${data.documents.length} documents) - ${data.crewMemberName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚢 Crew Management System</h1>
          <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">Consolidated Document Expiry Report</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <span style="background: ${colors.badge}; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold;">${urgencyText}</span>
            <h2 style="color: ${colors.text}; margin: 15px 0 5px 0; font-size: 24px; font-weight: bold;">${data.documents.length} Documents Require Attention</h2>
            <p style="color: ${colors.text}; margin: 0; font-size: 14px;">Earliest expiry: ${minDays} days</p>
          </div>
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">👤 Crew Member Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Name:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberName}</td></tr>
              ${data.crewMemberRank ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Rank:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberRank}</td></tr>` : ''}
              ${data.crewMemberNationality ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nationality:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.crewMemberNationality}</td></tr>` : ''}
              ${data.vesselName ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Current Vessel:</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.vesselName}</td></tr>` : ''}
            </table>
          </div>
          <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">📄 Expiring Documents</h3>
          ${documentCards}
          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-top: 25px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">⚡ Recommended Actions</h3>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li style="margin-bottom: 10px;">Review all expiring documents and prioritize renewals</li>
              <li style="margin-bottom: 10px;">Contact the crew member to initiate renewal processes</li>
              <li style="margin-bottom: 10px;">Ensure all required documentation is available</li>
              <li style="margin-bottom: 0;">Update crew records once renewals are completed</li>
            </ul>
          </div>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; text-align: center; margin-top: 20px;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">📅 <strong>Alert Schedule:</strong> Notifications are sent at 60, 45, 30, and 10 days before expiry</p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated notification from the Crew Management System<br>Sent to: ${data.crewMemberName} | ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const docList = data.documents.map(d => `- ${d.type}: ${d.documentNumber} (expires ${d.expiryDate.toLocaleDateString()}, ${d.daysUntilExpiry} days)`).join('\n');
  const text = `CONSOLIDATED DOCUMENT EXPIRY ALERT - ${urgencyText}\n\nCREW MEMBER: ${data.crewMemberName}${data.crewMemberRank ? `, ${data.crewMemberRank}` : ''}${data.vesselName ? ` on ${data.vesselName}` : ''}\n\nEXPIRING DOCUMENTS:\n${docList}\n\nAlert Schedule: 60, 45, 30, and 10 days before expiry`;

  return { subject, html, text };
}

export async function sendConsolidatedExpiryAlert(recipientEmail: string, data: ConsolidatedDocumentData): Promise<{ success: boolean; error?: string }> {
  const emailContent = generateConsolidatedExpiryEmail(data);
  return smtpEmailService.sendEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text
  });
}
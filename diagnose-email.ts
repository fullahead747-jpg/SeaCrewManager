
import { storage } from './server/storage';
import { smtpEmailService } from './server/services/smtp-email-service';
import 'dotenv/config';
import { db } from './server/db';
import { notificationHistory } from './shared/schema';
import { desc } from 'drizzle-orm';

async function diagnose() {
    console.log('--- Email Diagnostics ---');

    // Check Env
    console.log('Env GMAIL_USER:', process.env.GMAIL_USER ? 'PRESENT' : 'MISSING');
    console.log('Env GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'PRESENT' : 'MISSING');
    console.log('Env SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'PRESENT' : 'MISSING');
    console.log('Env DISABLE_EMAIL_NOTIFICATIONS:', process.env.DISABLE_EMAIL_NOTIFICATIONS);

    // Check DB Settings
    try {
        const settings = await storage.getEmailSettings();
        console.log('DB Settings:', JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Error fetching DB settings:', e);
    }

    // Check Notification History
    try {
        console.log('--- Recent Notification History ---');
        const todayStr = new Date().toISOString().split('T')[0];
        // Querying all history for today
        const history = await storage.getNotificationHistory('', '', 0);
        console.log('Total History Count:', history.length);

        // Let's just raw query if possible or list last 5
        const allHistory = await db.select().from(notificationHistory).orderBy(desc(notificationHistory.createdAt)).limit(10);
        console.log('Last 10 notifications:', JSON.stringify(allHistory.map(h => ({
            type: h.eventType,
            date: h.notificationDate,
            success: h.success,
            error: h.errorMessage
        })), null, 2));

        // Check if there are ANY failed notifications
        const failed = await storage.getFailedNotifications(5);
        console.log('Failed Notifications Count:', failed.length);
    } catch (e) {
        console.error('Error fetching notification history:', e);
    }

    // Check SMTP Readiness
    try {
        const ready = smtpEmailService.isReady();
        console.log('SMTP Service Ready:', ready);
    } catch (e) {
        console.error('Error checking SMTP readiness:', e);
    }

    // Check Activity Log for startup
    try {
        console.log('--- Recent Activity Logs ---');
        const logs = await storage.getActivityLogs();
        const recent = logs.slice(-10); // Last 10
        console.log('Recent logs:', JSON.stringify(recent.map(l => ({
            type: l.type,
            action: l.action,
            desc: l.description,
            date: l.createdAt
        })), null, 2));
    } catch (e) {
        console.error('Error fetching activity logs:', e);
    }

    // Check Category Counts (ManagedReportService logic)
    try {
        console.log('--- Managed Report Category Counts ---');
        const now = new Date();
        const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

        const allCrew = await storage.getCrewMembers();
        console.log('Total Crew Count:', allCrew.length);

        const categories = {
            critical: 0,
            upcoming: 0,
            attention: 0
        };

        for (const member of allCrew) {
            const contract = member.activeContract;
            if (!contract) {
                categories.attention++;
                continue;
            }
            const endDate = new Date(contract.endDate);
            if (endDate <= fifteenDaysFromNow) {
                categories.critical++;
            } else if (endDate <= thirtyDaysFromNow) {
                categories.upcoming++;
            } else if (endDate <= fortyFiveDaysFromNow) {
                categories.attention++;
            }
        }
        console.log('Category Matches:', categories);
    } catch (e) {
        console.error('Error checking category counts:', e);
    }

    // FINAL TEST: Actually try to send a test email to the recipient
    try {
        const settings = await storage.getEmailSettings();
        if (settings && settings.recipientEmail) {
            console.log('--- Attempting Real Test Email ---');
            console.log('Target:', settings.recipientEmail);
            const result = await smtpEmailService.sendEmail({
                to: settings.recipientEmail,
                subject: '🚨 DIAGNOSTIC TEST - Crew Management System',
                html: '<p>This is a diagnostic test email to verify your configuration. If you receive this, your email settings are working correctly.</p>'
            });
            console.log('Send Result Success: true');
        }
    } catch (e) {
        console.error('--- Real Test Email FAILED ---');
        console.error(e);
    }

    process.exit(0);
}

diagnose();

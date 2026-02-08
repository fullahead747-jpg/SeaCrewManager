import { getBaileysProvider } from './server/baileys-init';
import { storage } from './server/storage';

async function sendQuickTest() {
    console.log('📱 Sending test notification via existing server connection...');

    try {
        // Get the existing Baileys provider from the running server
        const provider = getBaileysProvider();

        if (!provider || !provider.isConnected()) {
            console.error('❌ Baileys provider not available or not connected');
            console.log('💡 Make sure the main server is running');
            return;
        }

        // Get WhatsApp settings
        const settings = await storage.getWhatsappSettings();

        if (!settings || !settings.groupId) {
            console.error('❌ WhatsApp settings not configured');
            return;
        }

        // Send test message
        const testMessage = `🔔 *TEST NOTIFICATION*

This is a test message to verify mobile push notifications are working.

📱 If you see this as a push notification on your phone, the fix is working!

Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

        const success = await provider.sendGroupMessage(settings.groupId, testMessage);

        if (success) {
            console.log('✅ Test notification sent successfully!');
            console.log('📱 Check your phone for a push notification');
        } else {
            console.error('❌ Failed to send test notification');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error sending test notification:', error);
        process.exit(1);
    }
}

sendQuickTest();

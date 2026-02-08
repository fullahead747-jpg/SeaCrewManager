import { storage } from './server/storage';
import { BaileysWhatsAppProvider } from './server/services/whatsapp-baileys-provider';

async function sendTestNotification() {
    console.log('📱 Sending test notification...');

    try {
        // Get WhatsApp settings
        const settings = await storage.getWhatsappSettings();

        if (!settings || !settings.groupId) {
            console.error('❌ WhatsApp settings not configured');
            return;
        }

        // Initialize Baileys provider
        const provider = new BaileysWhatsAppProvider('./baileys_auth_info');
        await provider.initialize();

        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!provider.isConnected()) {
            console.error('❌ Baileys not connected');
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

        // Disconnect
        await provider.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error sending test notification:', error);
        process.exit(1);
    }
}

sendTestNotification();

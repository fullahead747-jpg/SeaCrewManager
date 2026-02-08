import { storage } from './server/storage';
import { BaileysWhatsAppProvider } from './server/services/whatsapp-baileys-provider';

async function sendDirectTest() {
    console.log('📱 Sending test notification directly...');

    try {
        const settings = await storage.getWhatsappSettings();

        if (!settings || !settings.groupId) {
            console.error('❌ WhatsApp settings not configured');
            return;
        }

        console.log(`✅ Group ID: ${settings.groupId}`);
        console.log('🔄 Creating new Baileys instance...');

        const provider = new BaileysWhatsAppProvider('./baileys_auth_info');

        let connected = false;
        let attempts = 0;
        const maxAttempts = 30;

        await provider.initialize();

        // Wait for connection
        while (!connected && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            connected = provider.isConnected();
            attempts++;
            if (attempts % 5 === 0) {
                console.log(`⏳ Waiting for connection... (${attempts}/${maxAttempts})`);
            }
        }

        if (!connected) {
            console.error('❌ Failed to connect after 30 seconds');
            console.log('💡 You may need to scan the QR code again');
            console.log('💡 Run: npx tsx generate_baileys_qr.ts');
            process.exit(1);
        }

        console.log('✅ Connected! Sending test message...');

        const testMessage = `🔔 *TEST NOTIFICATION*

This is a test message to verify mobile push notifications.

📱 Check if this appears as a push notification on your phone!

Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

        const success = await provider.sendGroupMessage(settings.groupId, testMessage);

        if (success) {
            console.log('✅ Test notification sent successfully!');
            console.log('📱 Check your phone for a push notification');
        } else {
            console.error('❌ Failed to send test notification');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        await provider.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

sendDirectTest();

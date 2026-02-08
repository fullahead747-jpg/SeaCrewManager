import 'dotenv/config';
import { getBaileysProvider } from './server/baileys-init';
import { storage } from './server/storage';
import { BaileysWhatsAppProvider } from './server/services/whatsapp-baileys-provider';

async function sendQuickMessage() {
    console.log('📱 Sending another test message...');

    try {
        const settings = await storage.getWhatsappSettings();

        if (!settings || !settings.groupId) {
            console.error('❌ WhatsApp settings not configured');
            return;
        }

        const provider = new BaileysWhatsAppProvider('./baileys_auth_info');
        await provider.initialize();

        // Wait for connection
        let attempts = 0;
        while (!provider.isConnected() && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        if (!provider.isConnected()) {
            console.error('❌ Not connected');
            return;
        }

        const message = `🔔 *SECOND TEST MESSAGE*

This is another test to demonstrate the notification behavior.

Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

As discussed, this message will appear on the RIGHT side because it's sent from your WhatsApp account.`;

        await provider.sendGroupMessage(settings.groupId, message);
        console.log('✅ Message sent!');

        await new Promise(resolve => setTimeout(resolve, 2000));
        await provider.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

sendQuickMessage();

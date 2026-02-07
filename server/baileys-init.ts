import { BaileysWhatsAppProvider } from './services/whatsapp-baileys-provider';
import { WhatsAppChatbot } from './services/whatsapp-chatbot';
import { storage } from './storage';
import type { WAMessage } from '@whiskeysockets/baileys';

// Global Baileys instance
let baileysProvider: BaileysWhatsAppProvider | null = null;
let chatbot: WhatsAppChatbot | null = null;

export async function initializeBaileys() {
    try {
        console.log('🔄 Initializing Baileys WhatsApp...');

        // Get WhatsApp settings from database
        const settings = await storage.getWhatsappSettings();

        if (!settings?.enabled || !settings?.groupId) {
            console.log('⚠️  WhatsApp not configured in database');
            return null;
        }

        // Create Baileys provider
        baileysProvider = new BaileysWhatsAppProvider('./baileys_auth_info');

        // Initialize with message handler
        await baileysProvider.initialize((message: WAMessage) => {
            handleIncomingMessage(message, settings.groupId!);
        });

        // Create chatbot instance
        chatbot = new WhatsAppChatbot(baileysProvider, settings.groupId);

        console.log('✅ Baileys WhatsApp initialized');
        return baileysProvider;
    } catch (error) {
        console.error('❌ Failed to initialize Baileys:', error);
        return null;
    }
}

async function handleIncomingMessage(message: WAMessage, configuredGroupId: string) {
    try {
        const fromGroup = message.key.remoteJid || '';
        const fromUser = message.key.participant || message.key.remoteJid || '';

        // Extract message details
        const messageText = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.buttonsResponseMessage?.selectedButtonId ||
            message.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '';

        console.log(`🧐 Baileys checking message: fromGroup=${fromGroup}, target=${configuredGroupId}, text="${messageText.slice(0, 20)}..."`);

        // Only process messages from configured group
        if (!fromGroup.includes(configuredGroupId.replace('@g.us', ''))) {
            // console.log(`⏩ Ignoring message from outside group: ${fromGroup}`);
            return;
        }

        // Ignore empty messages
        if (!messageText.trim()) {
            console.log('⏩ Ignoring empty message');
            return;
        }

        console.log(`📩 Baileys message from ${fromUser}: "${messageText}"`);

        // Process with chatbot
        if (chatbot) {
            await chatbot.processMessage(messageText, fromUser);
        } else {
            console.log('❌ Chatbot not initialized when message arrived');
        }
    } catch (error) {
        console.error('❌ Error handling Baileys message:', error);
    }
}

export function getBaileysProvider(): BaileysWhatsAppProvider | null {
    return baileysProvider;
}

export function getBaileysChatbot(): WhatsAppChatbot | null {
    return chatbot;
}

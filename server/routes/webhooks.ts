import { Router, Request, Response } from 'express';
import { WhatsAppChatbot } from '../services/whatsapp-chatbot';
import { WAHAWebhookProvider } from '../services/whatsapp-waha-provider';
import { storage } from '../storage';

const router = Router();

/**
 * WAHA Webhook Handler
 * Receives incoming WhatsApp messages and processes them with the chatbot
 */

// Initialize chatbot (will be set up when webhook is first called)
let chatbot: WhatsAppChatbot | null = null;

async function initializeChatbot() {
    if (chatbot) return chatbot;

    try {
        // Get WhatsApp settings from database
        const settings = await storage.getWhatsappSettings();

        if (!settings || !settings.enabled) {
            console.log('WhatsApp chatbot not enabled');
            return null;
        }

        if (!settings.groupId) {
            console.log('WhatsApp group ID not configured');
            return null;
        }

        if (!settings.webhookUrl) {
            console.log('WhatsApp webhook URL not configured');
            return null;
        }

        // Initialize WhatsApp provider
        const provider = new WAHAWebhookProvider(
            settings.webhookUrl,
            settings.apiKey || undefined,
            'default'
        );

        // Initialize chatbot
        chatbot = new WhatsAppChatbot(provider, settings.groupId);
        console.log('✅ WhatsApp chatbot initialized');

        return chatbot;
    } catch (error) {
        console.error('Error initializing chatbot:', error);
        return null;
    }
}

/**
 * POST /api/webhooks/whatsapp
 * Receives webhook events from WAHA
 */
router.post('/whatsapp', async (req: Request, res: Response) => {
    try {
        const event = req.body;

        // Log webhook event for debugging
        console.log('📱 Webhook received:', {
            event: event.event,
            session: event.session,
            hasPayload: !!event.payload,
        });

        // Only process message events
        if (event.event !== 'message') {
            return res.status(200).json({ success: true, message: 'Event ignored' });
        }

        const payload = event.payload;

        // DETAILED LOGGING FOR DEBUGGING
        console.log('📦 Full webhook payload:', JSON.stringify(event, null, 2));
        console.log('📦 Payload details:', {
            type: payload?.type,
            body: payload?.body,
            from: payload?.from,
            author: payload?.author,
            fromMe: payload?.fromMe
        });

        // Ignore non-text messages (but allow undefined type for web interface)
        if (!payload || !payload.body) {
            console.log('⚠️  Ignoring message without body');
            return res.status(200).json({ success: true, message: 'No message body' });
        }

        // Check type only if it exists (WAHA sends type, web interface doesn't)
        if (payload.type && payload.type !== 'chat') {
            console.log('⚠️  Ignoring non-chat message type:', payload.type);
            return res.status(200).json({ success: true, message: 'Non-text message ignored' });
        }

        // Ignore messages from self
        if (payload.fromMe) {
            return res.status(200).json({ success: true, message: 'Own message ignored' });
        }

        // Get chatbot instance
        const bot = await initializeChatbot();
        if (!bot) {
            return res.status(200).json({ success: true, message: 'Chatbot not initialized' });
        }

        // Get WhatsApp settings to check group ID
        const settings = await storage.getWhatsappSettings();

        // Only process messages from the configured group
        if (payload.from !== settings?.groupId) {
            console.log('Message from different group, ignoring');
            return res.status(200).json({ success: true, message: 'Different group' });
        }

        // Extract message text and sender
        const messageText = payload.body;
        const fromUser = payload.author || payload.from;

        console.log(`📩 Processing message from ${fromUser}: "${messageText}"`);

        // Process message with chatbot (async, don't wait)
        bot.processMessage(messageText, fromUser).catch((error) => {
            console.error('Error processing message:', error);
        });

        // Respond immediately to WAHA
        res.status(200).json({ success: true, message: 'Message received' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/webhooks/whatsapp
 * Health check endpoint
 */
router.get('/whatsapp', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'WhatsApp webhook endpoint is active',
        chatbotInitialized: chatbot !== null,
    });
});

export default router;

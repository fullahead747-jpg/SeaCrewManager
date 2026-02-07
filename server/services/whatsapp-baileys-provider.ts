import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    proto,
    WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import { storage } from '../storage';

export interface WhatsAppMessage {
    title: string;
    description: string;
    date: string;
    severity: string;
    eventType: string;
    crewMemberName?: string;
    vesselName?: string;
}

export interface WhatsAppProvider {
    sendGroupMessage(groupId: string, message: string): Promise<boolean>;
    formatMessage(template: string, data: WhatsAppMessage): string;
    isConnected(): boolean;
}

export class BaileysWhatsAppProvider implements WhatsAppProvider {
    private sock: WASocket | null = null;
    private connected: boolean = false;
    private messageHandler: ((message: WAMessage) => void) | null = null;
    private authDir: string;
    private logger: any;

    constructor(authDir: string = './baileys_auth_info') {
        this.authDir = authDir;
        this.logger = P({ level: 'silent' }); // Silent logger to reduce noise
    }

    async initialize(onMessage?: (message: WAMessage) => void): Promise<void> {
        this.messageHandler = onMessage || null;

        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // We'll handle QR separately
            logger: this.logger,
        });

        // Handle connection updates
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📱 QR Code available - use generate_baileys_qr.ts to scan');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ Connection closed. Reconnecting:', shouldReconnect);

                if (shouldReconnect) {
                    // Reconnect
                    await this.initialize(this.messageHandler || undefined);
                } else {
                    this.connected = false;
                }
            } else if (connection === 'open') {
                console.log('✅ Baileys WhatsApp connected successfully!');
                this.connected = true;
            }
        });

        // Save credentials when updated
        this.sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            console.log(`📩 Baileys upsert: ${type}, count=${messages.length}`);
            for (const message of messages) {
                const messageId = message.key.id;
                const remoteJid = message.key.remoteJid;
                const fromMe = message.key.fromMe ?? false;
                const body = message.message?.conversation ||
                    message.message?.extendedTextMessage?.text ||
                    (message.message?.imageMessage ? '[Image]' : '') ||
                    (message.message?.videoMessage ? '[Video]' : '') ||
                    '[Other Message Type]';
                const senderName = fromMe ? 'Bot' : (message.pushName || undefined);

                if (messageId && remoteJid && body) {
                    try {
                        await storage.saveWhatsappMessage({
                            messageId,
                            remoteJid,
                            fromMe,
                            body,
                            senderName,
                            timestamp: message.messageTimestamp ? new Date((message.messageTimestamp as number) * 1000) : new Date(),
                            status: 'received'
                        });
                        console.log(`💾 Persisted message ${messageId} to DB`);
                    } catch (err) {
                        console.error(`❌ Failed to persist message ${messageId}:`, err);
                    }
                }

                // Route to chatbot/handler
                if (this.messageHandler) {
                    this.messageHandler(message);
                }
            }
        });
    }

    async sendGroupMessage(groupId: string, message: string): Promise<boolean> {
        if (!this.sock || !this.connected) {
            console.error('❌ Baileys not connected');
            return false;
        }

        try {
            // Ensure group ID has correct format
            const formattedGroupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;

            // Get group metadata to fetch participant list for mentions
            let mentions: string[] = [];
            try {
                const groupMetadata = await this.sock.groupMetadata(formattedGroupId);
                // Get all participant JIDs for @all mention
                mentions = groupMetadata.participants.map(p => p.id);
                console.log(`📱 Adding ${mentions.length} mentions to trigger notifications`);
            } catch (err) {
                console.warn('⚠️ Could not fetch group metadata for mentions:', err);
            }

            // Send message with mentions to trigger notifications
            const sentMsg = await this.sock.sendMessage(formattedGroupId, {
                text: message,
                mentions: mentions.length > 0 ? mentions : undefined
            });
            console.log('✅ Message sent via Baileys with mentions:', { groupId: formattedGroupId, mentionCount: mentions.length });

            // Persist outgoing message
            if (sentMsg?.key.id) {
                try {
                    await storage.saveWhatsappMessage({
                        messageId: sentMsg.key.id,
                        remoteJid: formattedGroupId,
                        fromMe: true,
                        body: message,
                        senderName: 'Bot',
                        timestamp: new Date(),
                        status: 'sent'
                    });
                } catch (err) {
                    console.error('❌ Failed to persist outgoing message:', err);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Baileys send error:', error);
            return false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    formatMessage(template: string, data: WhatsAppMessage): string {
        return template
            .replace('{{title}}', data.title)
            .replace('{{description}}', data.description)
            .replace('{{date}}', data.date)
            .replace('{{severity}}', this.getSeverityEmoji(data.severity));
    }

    private getSeverityEmoji(severity: string): string {
        switch (severity.toLowerCase()) {
            case 'high': return '🚨 HIGH';
            case 'warning': return '⚠️ WARNING';
            case 'info': return 'ℹ️ INFO';
            default: return '📋 ' + severity.toUpperCase();
        }
    }

    async disconnect(): Promise<void> {
        if (this.sock) {
            await this.sock.logout();
            this.sock = null;
            this.connected = false;
        }
    }

    getSocket(): WASocket | null {
        return this.sock;
    }
}

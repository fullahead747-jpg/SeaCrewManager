import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    proto,
    isJidGroup,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';

/**
 * Baileys WhatsApp Connection Manager
 * Handles WhatsApp connection, authentication, and message handling
 */

export class BaileysConnection {
    private sock: WASocket | null = null;
    private messageHandlers: Array<(message: any) => void> = [];
    private isConnected = false;
    private authFolder = path.join(process.cwd(), 'baileys_auth');

    constructor() {
        this.initialize();
    }

    private async initialize() {
        const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // We'll handle QR display ourselves
            logger: P({ level: 'silent' }), // Reduce noise in logs
        });

        this.sock = sock;

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Display QR code
            if (qr) {
                console.log('\n📱 Scan this QR code with WhatsApp:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n');
            }

            // Handle connection status
            if (connection === 'close') {
                const shouldReconnect =
                    (lastDisconnect?.error as Boom)?.output?.statusCode !==
                    DisconnectReason.loggedOut;

                console.log('❌ Connection closed. Reconnecting:', shouldReconnect);

                if (shouldReconnect) {
                    this.initialize(); // Reconnect
                }

                this.isConnected = false;
            } else if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                this.isConnected = true;
            }
        });

        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                // Ignore if message is from us or not a text message
                if (message.key.fromMe) continue;

                // Call all registered message handlers
                for (const handler of this.messageHandlers) {
                    try {
                        await handler(message);
                    } catch (error) {
                        console.error('Error in message handler:', error);
                    }
                }
            }
        });
    }

    /**
     * Register a handler for incoming messages
     */
    public onMessage(handler: (message: any) => void) {
        this.messageHandlers.push(handler);
    }

    /**
     * Send a message to a group or contact
     */
    public async sendMessage(jid: string, text: string) {
        if (!this.sock) {
            throw new Error('WhatsApp not connected');
        }

        await this.sock.sendMessage(jid, { text });
    }

    /**
     * Check if connected
     */
    public get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Get the socket instance
     */
    public getSocket(): WASocket | null {
        return this.sock;
    }
}

// Singleton instance
let connectionInstance: BaileysConnection | null = null;

export function getBaileysConnection(): BaileysConnection {
    if (!connectionInstance) {
        connectionInstance = new BaileysConnection();
    }
    return connectionInstance;
}

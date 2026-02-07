import type { WhatsAppProvider, WhatsAppMessage } from './whatsapp-notification';

/**
 * WAHA (WhatsApp HTTP API) Provider
 * 
 * This provider connects to an external WAHA instance via HTTP API.
 * WAHA can be hosted on:
 * - Railway.app (free tier)
 * - Render.com (free tier)
 * - Your local machine
 * - Any VPS
 * 
 * This approach is fully compatible with Replit since it only makes HTTP requests.
 */
export class WAHAWebhookProvider implements WhatsAppProvider {
    private baseUrl: string;
    private apiKey?: string;
    private sessionName: string;

    constructor(
        webhookUrl: string,
        apiKey?: string,
        sessionName: string = 'default'
    ) {
        // Remove trailing slash from webhook URL
        this.baseUrl = webhookUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.sessionName = sessionName;
    }

    /**
     * Send a message to a WhatsApp group
     * @param groupId - WhatsApp group ID (format: 1234567890-1234567890@g.us)
     * @param message - Message text to send
     */
    async sendGroupMessage(groupId: string, message: string): Promise<boolean> {
        try {
            // Ensure group ID has correct format
            const formattedGroupId = this.formatGroupId(groupId);

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Add API key if provided
            if (this.apiKey) {
                headers['X-Api-Key'] = this.apiKey;
            }

            // WAHA API endpoint for sending messages
            const endpoint = `${this.baseUrl}/api/sendText`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    session: this.sessionName,
                    chatId: formattedGroupId,
                    text: message,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('WAHA API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                });
                return false;
            }

            const result = await response.json();
            console.log('✅ WhatsApp message sent via WAHA:', {
                groupId: formattedGroupId,
                messageId: result.id,
            });

            return true;
        } catch (error) {
            console.error('WAHA WhatsApp error:', error);
            return false;
        }
    }

    /**
     * Format message using template and data
     */
    formatMessage(template: string, data: WhatsAppMessage): string {
        let formatted = template
            .replace('{{title}}', data.title)
            .replace('{{description}}', data.description)
            .replace('{{date}}', data.date)
            .replace('{{severity}}', this.getSeverityEmoji(data.severity));

        // Add optional fields if available
        if (data.crewMemberName) {
            formatted = formatted.replace('{{crewMemberName}}', data.crewMemberName);
        }
        if (data.vesselName) {
            formatted = formatted.replace('{{vesselName}}', data.vesselName);
        }

        return formatted;
    }

    /**
     * Get severity emoji based on severity level
     */
    private getSeverityEmoji(severity: string): string {
        switch (severity.toLowerCase()) {
            case 'high':
            case 'critical':
                return '🚨 CRITICAL';
            case 'warning':
            case 'medium':
                return '⚠️ WARNING';
            case 'info':
            case 'low':
                return 'ℹ️ INFO';
            default:
                return '📋 ' + severity.toUpperCase();
        }
    }

    /**
     * Format group ID to ensure it has the correct WhatsApp format
     * @param groupId - Raw group ID
     * @returns Formatted group ID (e.g., 1234567890-1234567890@g.us)
     */
    private formatGroupId(groupId: string): string {
        // If already formatted correctly, return as is
        if (groupId.includes('@g.us')) {
            return groupId;
        }

        // If it's just numbers, assume it needs @g.us suffix
        if (/^\d+-\d+$/.test(groupId)) {
            return `${groupId}@g.us`;
        }

        // Return as is and let WAHA handle it
        return groupId;
    }

    /**
     * Check if the WAHA instance is reachable and the session is active
     */
    async checkConnection(): Promise<boolean> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['X-Api-Key'] = this.apiKey;
            }

            // Check session status
            const endpoint = `${this.baseUrl}/api/sessions/${this.sessionName}`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                console.error('WAHA session check failed:', response.status);
                return false;
            }

            const session = await response.json();
            console.log('WAHA session status:', session.status);

            return session.status === 'WORKING' || session.status === 'READY';
        } catch (error) {
            console.error('WAHA connection check error:', error);
            return false;
        }
    }

    /**
     * Get all available WhatsApp groups (useful for setup)
     */
    async getGroups(): Promise<Array<{ id: string; name: string }>> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (this.apiKey) {
                headers['X-Api-Key'] = this.apiKey;
            }

            const endpoint = `${this.baseUrl}/api/${this.sessionName}/chats`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                console.error('Failed to get groups:', response.status);
                return [];
            }

            const chats = await response.json();

            // Filter only group chats
            return chats
                .filter((chat: any) => {
                    // Ensure chat.id exists and is a string
                    const chatId = typeof chat.id === 'string' ? chat.id : String(chat.id || '');
                    return chatId.includes('@g.us');
                })
                .map((chat: any) => ({
                    id: typeof chat.id === 'string' ? chat.id : String(chat.id),
                    name: chat.name || 'Unnamed Group',
                }));
        } catch (error) {
            console.error('Error getting groups:', error);
            return [];
        }
    }
}

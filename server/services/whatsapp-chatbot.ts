import type { WhatsAppProvider } from './whatsapp-notification';
import { storage } from '../storage';

/**
 * WhatsApp Chatbot Service
 * Handles incoming messages and responds to keyword-based commands
 */

export interface ChatbotCommand {
    type: 'crew' | 'contract' | 'document' | 'help' | 'unknown';
    action: string;
    parameter?: string;
}

export class WhatsAppChatbot {
    private whatsappProvider: WhatsAppProvider;
    private groupId: string;

    constructor(whatsappProvider: WhatsAppProvider, groupId: string) {
        this.whatsappProvider = whatsappProvider;
        this.groupId = groupId;
    }

    /**
     * Parse incoming message and extract command
     */
    parseCommand(message: string): ChatbotCommand {
        const msg = message.toLowerCase().trim();
        console.log(`🤖 Chatbot parsing: "${msg}"`);

        // Help command
        if (msg === 'help' || msg === 'commands') {
            return { type: 'help', action: 'show' };
        }

        // Crew commands
        if (msg.startsWith('crew ')) {
            const param = message.substring(5).trim();
            if (param === 'list' || param === '') {
                return { type: 'crew', action: 'list' };
            }
            return { type: 'crew', action: 'vessel', parameter: param };
        }

        if (msg.startsWith('captain ')) {
            const param = message.substring(8).trim();
            return { type: 'crew', action: 'captain', parameter: param };
        }

        // Contract commands
        if (msg.startsWith('contract ')) {
            const param = message.substring(9).trim();
            return { type: 'contract', action: 'member', parameter: param };
        }

        if (msg.startsWith('contracts ')) {
            const param = message.substring(10).trim();
            if (param === 'expiring') {
                return { type: 'contract', action: 'expiring' };
            }
            return { type: 'contract', action: 'vessel', parameter: param };
        }

        // Document commands
        if (msg.startsWith('passport ')) {
            const param = message.substring(9).trim();
            return { type: 'document', action: 'passport', parameter: param };
        }

        if (msg.startsWith('medical ')) {
            const param = message.substring(8).trim();
            return { type: 'document', action: 'medical', parameter: param };
        }

        if (msg.startsWith('documents ')) {
            const param = message.substring(10).trim();
            if (param === 'expiring') {
                return { type: 'document', action: 'expiring' };
            }
        }

        return { type: 'unknown', action: 'unknown' };
    }

    /**
     * Handle crew-related commands
     */
    async handleCrewCommand(action: string, parameter?: string): Promise<string> {
        try {
            if (action === 'list') {
                const crew = await storage.getCrewMembers();

                if (crew.length === 0) {
                    return '📋 No crew members found in the system.';
                }

                const vessels = await storage.getVessels();
                const vesselMap = new Map(vessels.map(v => [v.id, v.name]));

                let response = `👥 *All Crew Members* (${crew.length} total):\n\n`;

                // Process only first 10 for brevety in group
                for (let i = 0; i < Math.min(crew.length, 10); i++) {
                    const member = crew[i];
                    const vesselName = member.currentVesselId ? (vesselMap.get(member.currentVesselId) || 'Unknown Vessel') : 'On Shore';

                    response += `${i + 1}. *${member.firstName} ${member.lastName}*\n`;
                    response += `   Rank: ${member.rank}\n`;
                    response += `   Vessel: ${vesselName}\n`;

                    // Look for active contract dates
                    const contracts = await storage.getContractsByCrewMember(member.id);
                    const activeContract = contracts.find(c => c.status === 'active');
                    if (activeContract) {
                        const start = new Date(activeContract.startDate).toLocaleDateString('en-GB');
                        const end = new Date(activeContract.endDate).toLocaleDateString('en-GB');
                        response += `   Contract: ${start} to ${end}\n`;
                    }

                    response += '\n';
                }

                if (crew.length > 10) {
                    response += `\n... and ${crew.length - 10} more crew members`;
                }

                return response;
            }

            if (action === 'vessel' && parameter) {
                const vessels = await storage.getVessels();
                const vessel = vessels.find(v =>
                    v.name.toLowerCase().includes(parameter.toLowerCase())
                );

                if (!vessel) {
                    return `📋 No vessel found matching "${parameter}".\n\n💡 Try: crew list`;
                }

                const crew = await storage.getCrewMembersByVessel(vessel.id);

                if (crew.length === 0) {
                    return `📋 No crew found on ${vessel.name}.`;
                }

                let response = `👥 *Crew on ${vessel.name}* (${crew.length} members):\n\n`;
                crew.forEach((member, index) => {
                    response += `${index + 1}. *${member.firstName} ${member.lastName}* - ${member.rank}\n`;
                });

                return response;
            }

            if (action === 'captain' && parameter) {
                const vessels = await storage.getVessels();
                const vessel = vessels.find(v =>
                    v.name.toLowerCase().includes(parameter.toLowerCase())
                );

                if (!vessel) {
                    return `📋 No vessel found matching "${parameter}".`;
                }

                const crew = await storage.getCrewMembersByVessel(vessel.id);
                const captain = crew.find(c =>
                    c.rank.toLowerCase().includes('captain') ||
                    c.rank.toLowerCase().includes('master')
                );

                if (!captain) {
                    return `📋 No captain found for *${vessel.name}*.`;
                }

                let response = `👨‍✈️ *Captain of ${vessel.name}*:\n\n`;
                response += `*${captain.firstName} ${captain.lastName}*\n`;
                response += `Rank: ${captain.rank}\n`;

                return response;
            }

            return '❌ Invalid crew command.\n\n💡 Try: help';
        } catch (error) {
            console.error('Error handling crew command:', error);
            return '❌ Error fetching crew information. Please try again.';
        }
    }

    /**
     * Handle contract-related commands
     */
    async handleContractCommand(action: string, parameter?: string): Promise<string> {
        try {
            if (action === 'expiring') {
                const contracts = await storage.getContracts();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

                const expiringContracts = contracts.filter(contract => {
                    const endDate = new Date(contract.endDate);
                    return endDate <= thirtyDaysFromNow && endDate >= new Date();
                });

                if (expiringContracts.length === 0) {
                    return '✅ No contracts expiring in the next 30 days.';
                }

                let response = `⚠️ *Expiring Contracts* (Next 30 days):\n\n`;

                for (const contract of expiringContracts.slice(0, 10)) {
                    const crew = await storage.getCrewMember(contract.crewMemberId);
                    if (!crew) continue;

                    const expiryDate = new Date(contract.endDate);
                    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const urgency = daysRemaining <= 7 ? '🚨' : daysRemaining <= 14 ? '⚠️' : 'ℹ️';

                    response += `${urgency} *${crew.firstName} ${crew.lastName}*\n`;
                    response += `   Expires: ${expiryDate.toLocaleDateString()} (${daysRemaining} days)\n\n`;
                }

                if (expiringContracts.length > 10) {
                    response += `\n... and ${expiringContracts.length - 10} more contracts`;
                }

                return response;
            }

            if (action === 'member' && parameter) {
                const crew = await storage.getCrewMembers();
                const member = crew.find(c =>
                    `${c.firstName} ${c.lastName}`.toLowerCase().includes(parameter.toLowerCase())
                );

                if (!member) {
                    return `📋 No crew member found matching "${parameter}".\n\n💡 Try: crew list`;
                }

                const contracts = await storage.getContractsByCrewMember(member.id);
                const activeContract = contracts.find(c => c.status === 'active');

                if (!activeContract) {
                    return `📋 *${member.firstName} ${member.lastName}* has no active contract.`;
                }

                const expiryDate = new Date(activeContract.endDate);
                const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const status = daysRemaining > 0 ? '✅ Valid' : '❌ Expired';

                let response = `📋 *Contract Status for ${member.firstName} ${member.lastName}*:\n\n`;
                response += `Position: ${member.rank}\n`;
                response += `Contract Start: ${new Date(activeContract.startDate).toLocaleDateString()}\n`;
                response += `Contract End: ${expiryDate.toLocaleDateString()}\n`;
                response += `Status: ${status} (${daysRemaining} days remaining)\n`;

                return response;
            }

            return '❌ Invalid contract command.\n\n💡 Try: help';
        } catch (error) {
            console.error('Error handling contract command:', error);
            return '❌ Error fetching contract information. Please try again.';
        }
    }

    /**
     * Handle document-related commands
     */
    async handleDocumentCommand(action: string, parameter?: string): Promise<string> {
        try {
            if (action === 'expiring') {
                const documents = await storage.getDocuments();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

                const expiringDocs = documents.filter(doc => {
                    const expiryDate = new Date(doc.expiryDate);
                    return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
                });

                if (expiringDocs.length === 0) {
                    return '✅ No documents expiring in the next 30 days.';
                }

                let response = `📄 *Expiring Documents* (Next 30 days):\n\n`;

                for (const doc of expiringDocs.slice(0, 10)) {
                    const crew = await storage.getCrewMember(doc.crewMemberId);
                    if (!crew) continue;

                    const expiryDate = new Date(doc.expiryDate);
                    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const urgency = daysRemaining <= 7 ? '🚨' : daysRemaining <= 14 ? '⚠️' : 'ℹ️';

                    response += `${urgency} *${crew.firstName} ${crew.lastName}* - ${doc.type}\n`;
                    response += `   Expires: ${expiryDate.toLocaleDateString()} (${daysRemaining} days)\n\n`;
                }

                if (expiringDocs.length > 10) {
                    response += `\n... and ${expiringDocs.length - 10} more documents`;
                }

                return response;
            }

            if ((action === 'passport' || action === 'medical') && parameter) {
                const crew = await storage.getCrewMembers();
                const member = crew.find(c =>
                    `${c.firstName} ${c.lastName}`.toLowerCase().includes(parameter.toLowerCase())
                );

                if (!member) {
                    return `📋 No crew member found matching "${parameter}".\n\n💡 Try: crew list`;
                }

                const documents = await storage.getDocumentsByCrewMember(member.id);
                const docType = action === 'passport' ? 'PASSPORT' : 'MEDICAL';
                const doc = documents.find(d => d.type === docType);

                if (!doc) {
                    return `📋 No ${action} document found for *${member.firstName} ${member.lastName}*.`;
                }

                const expiryDate = new Date(doc.expiryDate);
                const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const status = daysRemaining > 0 ? '✅ Valid' : '❌ Expired';
                const emoji = action === 'passport' ? '🛂' : '🏥';

                let response = `${emoji} *${action.toUpperCase()} - ${member.firstName} ${member.lastName}*:\n\n`;
                if (doc.documentNumber) {
                    response += `Document Number: ${doc.documentNumber}\n`;
                }
                response += `Issue Date: ${new Date(doc.issueDate).toLocaleDateString()}\n`;
                response += `Expiry Date: ${expiryDate.toLocaleDateString()}\n`;
                response += `Status: ${status} (${daysRemaining} days remaining)\n`;

                return response;
            }

            return '❌ Invalid document command.\n\n💡 Try: help';
        } catch (error) {
            console.error('Error handling document command:', error);
            return '❌ Error fetching document information. Please try again.';
        }
    }

    /**
     * Show help message with available commands
     */
    getHelpMessage(): string {
        return `🤖 *Crew Management Bot* - Available Commands:

👥 *CREW:*
• crew list - Show all crew
• crew [vessel] - Show crew on vessel
• captain [vessel] - Show captain

📋 *CONTRACTS:*
• contract [name] - Show contract status
• contracts expiring - Show expiring contracts

📄 *DOCUMENTS:*
• passport [name] - Check passport
• medical [name] - Check medical cert
• documents expiring - Show expiring docs

💡 *TIP:* Commands are case-insensitive!
Type "help" anytime to see this message.`;
    }

    /**
     * Process incoming message and send response
     */
    async processMessage(message: string, fromUser: string): Promise<void> {
        try {
            console.log(`🤖 Chatbot processing message: "${message}" from ${fromUser}`);
            // Ignore unknown commands or empty messages if needed
            const command = this.parseCommand(message);
            console.log(`🤖 Chatbot parsed command: type=${command.type}, action=${command.action}`);

            let response: string;

            switch (command.type) {
                case 'help':
                    response = this.getHelpMessage();
                    break;

                case 'crew':
                    response = await this.handleCrewCommand(command.action, command.parameter);
                    break;

                case 'contract':
                    response = await this.handleContractCommand(command.action, command.parameter);
                    break;

                case 'document':
                    response = await this.handleDocumentCommand(command.action, command.parameter);
                    break;

                case 'unknown':
                default:
                    console.log('🤖 Chatbot ignored unknown command');
                    // Ignore unknown commands silently
                    return;
            }

            console.log(`🤖 Chatbot sending response to group ${this.groupId}`);
            // Send response to WhatsApp group
            const success = await this.whatsappProvider.sendGroupMessage(this.groupId, response);
            console.log(`🤖 Chatbot response send status: ${success ? 'SUCCESS' : 'FAILURE'}`);
        } catch (error) {
            console.error('❌ Chatbot Error:', error);
        }
    }
}

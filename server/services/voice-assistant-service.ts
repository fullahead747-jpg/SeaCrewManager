import Groq from 'groq-sdk';
import { storage } from '../storage';

export interface AssistantMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AssistantContext {
    crewMembers?: any[];
    vessels?: any[];
    contracts?: any[];
    documents?: any[];
}

/**
 * Voice Assistant Service
 * Handles intelligent responses to voice queries using Groq LLM with RAG
 */
export class VoiceAssistantService {
    private client: Groq | null = null;

    private getClient(): Groq {
        if (!this.client) {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) {
                throw new Error('GROQ_API_KEY is not set');
            }
            this.client = new Groq({ apiKey });
        }
        return this.client;
    }

    isAvailable(): boolean {
        const key = process.env.GROQ_API_KEY;
        return !!key && key.length > 10;
    }

    /**
     * Retrieve relevant context from the database based on the user's query
     */
    async retrieveContext(query: string): Promise<AssistantContext> {
        const context: AssistantContext = {};
        const lowerQuery = query.toLowerCase();

        try {
            // Determine what data to fetch based on query keywords
            const needsCrew = lowerQuery.includes('crew') ||
                lowerQuery.includes('captain') ||
                lowerQuery.includes('master') ||
                lowerQuery.includes('officer') ||
                lowerQuery.includes('seafarer');

            const needsVessels = lowerQuery.includes('vessel') ||
                lowerQuery.includes('ship') ||
                lowerQuery.includes('fleet');

            const needsContracts = lowerQuery.includes('contract') ||
                lowerQuery.includes('expiring') ||
                lowerQuery.includes('renewal');

            const needsDocuments = lowerQuery.includes('document') ||
                lowerQuery.includes('passport') ||
                lowerQuery.includes('medical') ||
                lowerQuery.includes('cdc') ||
                lowerQuery.includes('coc');

            // Fetch relevant data
            if (needsVessels || needsCrew || needsContracts) {
                context.vessels = await storage.getVessels();
            }

            if (needsCrew || needsContracts) {
                const crew = await storage.getCrewMembers();
                context.crewMembers = crew.map(c => ({
                    id: c.id,
                    name: `${c.firstName} ${c.lastName}`,
                    rank: c.rank,
                    vesselId: c.currentVesselId,
                    nationality: c.nationality
                }));
            }

            if (needsContracts) {
                const contracts = await storage.getContracts();
                // Get active and soon-to-expire contracts
                const now = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(now.getDate() + 30);

                context.contracts = contracts
                    .filter(c => {
                        const endDate = new Date(c.endDate);
                        return c.status === 'active' || (endDate >= now && endDate <= thirtyDaysFromNow);
                    })
                    .map(c => ({
                        id: c.id,
                        crewMemberId: c.crewMemberId,
                        startDate: c.startDate,
                        endDate: c.endDate,
                        status: c.status
                    }));
            }

            if (needsDocuments) {
                const documents = await storage.getDocuments();
                // Get documents expiring soon
                const now = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(now.getDate() + 30);

                context.documents = documents
                    .filter(d => {
                        const expiryDate = new Date(d.expiryDate);
                        return expiryDate >= now && expiryDate <= thirtyDaysFromNow;
                    })
                    .map(d => ({
                        crewMemberId: d.crewMemberId,
                        type: d.type,
                        expiryDate: d.expiryDate,
                        documentNumber: d.documentNumber
                    }));
            }

            console.log('📊 Retrieved context:', {
                vessels: context.vessels?.length || 0,
                crew: context.crewMembers?.length || 0,
                contracts: context.contracts?.length || 0,
                documents: context.documents?.length || 0
            });

            return context;
        } catch (error) {
            console.error('Error retrieving context:', error);
            return {};
        }
    }

    /**
     * Format date in a voice-friendly way (e.g., "1st February 2026")
     */
    private formatDateForVoice(date: Date | string): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        const day = d.getDate();
        const month = d.toLocaleDateString('en-GB', { month: 'long' });
        const year = d.getFullYear();

        // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
        const suffix = (day: number) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };

        return `${day}${suffix(day)} ${month} ${year}`;
    }

    /**
     * Generate a system prompt with the retrieved context
     */
    buildSystemPrompt(context: AssistantContext): string {
        let prompt = `You are "Captain", an intelligent voice assistant for a maritime crew management system. 

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. ONLY use information from the data provided below
2. NEVER make up or invent vessel names, crew names, dates, or any other information
3. If asked about data NOT in the context below, politely redirect: "I specialize in fleet management. Please ask questions related to crew, vessels, contracts, or documents available on the website."
4. Do NOT use example data like "MV Horizon", "MV Sea Dragon", etc.
5. ONLY reference actual crew members, vessels, and contracts listed below
6. For out-of-scope questions (weather, jokes, general knowledge), respond: "I'd love to help! However, I specialize in fleet management. Please ask me about your crew, vessels, contracts, or expiring documents."
7. NEVER say "I don't have an answer" - always try to be helpful or redirect appropriately

PERSONALITY:
- Professional but friendly
- Concise and to-the-point (voice responses should be brief)
- Use maritime terminology appropriately
- Address the user respectfully
- Helpful and guiding

RESPONSE FORMATTING (CRITICAL FOR VOICE):
- Start with a brief summary (e.g., "I found 5 expiring contracts")
- Use numbered lists for multiple items (e.g., "1. John Smith...", "2. Mary Jones...")
- Keep each item on a separate line for clarity
- Use natural speech patterns (e.g., "expires on" instead of just the date)
- Format dates as "1st February 2026" or "February 1st, 2026" (easy to speak)
- For long lists (>5 items), group by urgency or ask if they want details
- End with a helpful closing (e.g., "Would you like more details?")

EXAMPLE GOOD RESPONSE:
"I found 3 expiring contracts. 
1. John Smith - expires on February 15th, 2026
2. Sarah Johnson - expires on March 20th, 2026  
3. Mike Wilson - expires on April 10th, 2026
Would you like more details on any of these?"

EXAMPLE BAD RESPONSE:
"JOHN SMITH: 15/02/2026, SARAH JOHNSON: 20/03/2026, MIKE WILSON: 10/04/2026"

RESPONSE GUIDELINES:
- Keep responses under 150 words when possible
- Use natural, conversational language
- If you don't have the information, say so clearly
- Always cite specific data when available
- NEVER hallucinate or make up data
- Format for easy reading AND speaking aloud

`;

        // Add context data with clear markers
        if (context.vessels && context.vessels.length > 0) {
            prompt += `\n=== AVAILABLE VESSELS (ONLY USE THESE) ===\n`;
            context.vessels.forEach(v => {
                prompt += `- ${v.name} (ID: ${v.id}, IMO: ${v.imoNumber || 'N/A'})\n`;
            });
        } else {
            prompt += `\n=== NO VESSEL DATA AVAILABLE ===\n`;
        }

        if (context.crewMembers && context.crewMembers.length > 0) {
            prompt += `\n=== CREW MEMBERS (ONLY USE THESE) ===\n`;
            context.crewMembers.forEach(c => {
                const vesselInfo = context.vessels?.find(v => v.id === c.vesselId);
                const vesselName = vesselInfo ? vesselInfo.name : 'On Shore';
                prompt += `- ${c.name}, ${c.rank}, currently on ${vesselName}\n`;
            });
        } else {
            prompt += `\n=== NO CREW DATA AVAILABLE ===\n`;
        }

        if (context.contracts && context.contracts.length > 0) {
            prompt += `\n=== ACTIVE/EXPIRING CONTRACTS (ONLY USE THESE) ===\n`;
            context.contracts.forEach(c => {
                const crew = context.crewMembers?.find(cm => cm.id === c.crewMemberId);
                if (crew) {
                    const formattedDate = this.formatDateForVoice(c.endDate);
                    prompt += `- ${crew.name}: Contract ends on ${formattedDate} (${c.status})\n`;
                }
            });
        } else {
            prompt += `\n=== NO CONTRACT DATA AVAILABLE ===\n`;
        }

        if (context.documents && context.documents.length > 0) {
            prompt += `\n=== EXPIRING DOCUMENTS (Next 30 days - ONLY USE THESE) ===\n`;
            context.documents.forEach(d => {
                const crew = context.crewMembers?.find(cm => cm.id === d.crewMemberId);
                if (crew) {
                    const formattedDate = this.formatDateForVoice(d.expiryDate);
                    prompt += `- ${crew.name}: ${d.type} expires on ${formattedDate}\n`;
                }
            });
        } else {
            prompt += `\n=== NO EXPIRING DOCUMENTS ===\n`;
        }

        prompt += `\n=== END OF DATA ===\nREMEMBER: Only use the data listed above. Do not invent any information.\n`;

        return prompt;
    }

    /**
     * Process a voice query and generate a response
     */
    async processQuery(userQuery: string): Promise<string> {
        try {
            console.log('🎤 Processing voice query:', userQuery);

            // Retrieve relevant context
            const context = await this.retrieveContext(userQuery);

            // Build system prompt with context
            const systemPrompt = this.buildSystemPrompt(context);

            console.log('📝 System prompt length:', systemPrompt.length);
            console.log('📝 System prompt preview:', systemPrompt.substring(0, 500));

            // Call Groq LLM
            const client = this.getClient();
            const response = await client.chat.completions.create({
                model: 'llama-3.3-70b-versatile', // Fast and intelligent
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: userQuery
                    }
                ],
                max_tokens: 300, // Keep responses concise for voice
                temperature: 0.1 // Very low temperature to reduce hallucinations
            });

            const answer = response.choices[0]?.message?.content || 'I apologize, but I could not process your request.';

            console.log('🤖 Captain response:', answer);
            return answer;

        } catch (error) {
            console.error('❌ Voice Assistant Error:', error);
            return 'I apologize, but I encountered an error processing your request. Please try again.';
        }
    }
}

export const voiceAssistantService = new VoiceAssistantService();

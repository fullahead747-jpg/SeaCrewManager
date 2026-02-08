
import express from 'express';
import { registerRoutes } from './server/routes';
import { storage } from './server/storage';
import { smtpEmailService } from './server/services/smtp-email-service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// DO NOT MOCK - WE WANT TO TEST REAL SENDING (but carefully)

async function reproduceIssue() {
    console.log('🚀 Starting reproduction script (REAL SENDING)...');

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Register routes
    await registerRoutes(app);

    app.use((req, res, next) => { next(); });

    const PORT = 5052;
    const server = app.listen(PORT, async () => {
        console.log(`✅ Test server running on port ${PORT}`);

        try {
            console.log('🔍 Retrieving a crew member...');
            const crewMembers = await storage.getCrewMembers();
            // Pick the one that "worked" regarding getting to the point of sending
            const member = crewMembers.find(c => c.documents && c.documents.length > 0);

            if (!member) {
                console.log("No member with docs found.");
                process.exit(0);
            }

            console.log(`   Using member: ${member.firstName} ${member.lastName} (${member.id})`);

            // TEST 1: Valid Send
            console.log(`\n--- TEST 1: Valid Send to GMAIL_USER ---`);
            if (process.env.GMAIL_USER) {
                const payload1 = {
                    crewMemberId: member.id,
                    additionalEmail: process.env.GMAIL_USER
                };

                const response1 = await fetch(`http://localhost:${PORT}/api/email/send-crew-details`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer mock-token-test-admin',
                        'X-User-Role': 'admin'
                    },
                    body: JSON.stringify(payload1)
                });

                const result1 = await response1.json();
                console.log(`Test 1 Result: ${response1.status}`);
                if (!response1.ok) console.log(JSON.stringify(result1, null, 2));
                else console.log("✅ Sent successfully.");
            } else {
                console.log("Skipping Test 1 (GMAIL_USER not set)");
            }


            // TEST 2: Invalid Email Format
            console.log(`\n--- TEST 2: Invalid Email Format ---`);
            const payload2 = {
                crewMemberId: member.id,
                additionalEmail: 'invalid-email-format-@' // junk
            };

            const response2 = await fetch(`http://localhost:${PORT}/api/email/send-crew-details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer mock-token-test-admin',
                    'X-User-Role': 'admin'
                },
                body: JSON.stringify(payload2)
            });

            const result2 = await response2.json();
            console.log(`Test 2 Result: ${response2.status}`);
            console.log(JSON.stringify(result2, null, 2));


        } catch (error) {
            console.error('❌ Script error:', error);
        } finally {
            server.close();
            process.exit(0);
        }
    });
}

reproduceIssue();

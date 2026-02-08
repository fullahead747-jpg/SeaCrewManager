
const { documentVerificationService } = require('./server/services/document-verification-service');

async function test() {
    const userEntry = '2031-01-02'; // Jan 2, 2031
    const docValue = '01-12-2030';  // Dec 1, 2030

    const matches = documentVerificationService.dateMatch(userEntry, docValue);
    console.log(`Matching ${userEntry} against ${docValue}: ${matches}`);

    const d1 = documentVerificationService.parseRobustDate(userEntry);
    const d2 = documentVerificationService.parseRobustDate(docValue);

    console.log('Parsed User Entry:', d1 ? d1.toISOString() : 'null');
    console.log('Parsed Doc Value:', d2 ? d2.toISOString() : 'null');
}

test().catch(console.error);

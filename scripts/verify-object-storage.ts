/**
 * Verify Object Storage Configuration
 * Run this on Replit after setting up Object Storage
 */

import { DocumentStorageService } from '../server/objectStorage';

async function verifyObjectStorage() {
    console.log('🔍 Object Storage Configuration Verification');
    console.log('='.repeat(60));
    console.log('');

    // Check environment variable
    console.log('1️⃣  Checking Environment Variable:');
    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;

    if (!privateObjectDir) {
        console.log('   ❌ PRIVATE_OBJECT_DIR is NOT set');
        console.log('');
        console.log('   📝 To fix this:');
        console.log('      1. Go to Replit Secrets (lock icon)');
        console.log('      2. Add new secret:');
        console.log('         Key: PRIVATE_OBJECT_DIR');
        console.log('         Value: /[your-bucket-name]');
        console.log('      3. Restart the deployment');
        console.log('');
        process.exit(1);
    }

    console.log(`   ✅ PRIVATE_OBJECT_DIR is set: ${privateObjectDir}`);
    console.log('');

    // Validate format
    console.log('2️⃣  Validating Format:');
    if (!privateObjectDir.startsWith('/')) {
        console.log('   ❌ Invalid format - must start with "/"');
        console.log(`   Current value: ${privateObjectDir}`);
        console.log(`   Should be: /${privateObjectDir}`);
        console.log('');
        process.exit(1);
    }

    const bucketName = privateObjectDir.substring(1);
    console.log(`   ✅ Bucket name: ${bucketName}`);
    console.log('');

    // Check if running on Replit
    console.log('3️⃣  Checking Environment:');
    const isReplit = process.env.REPL_ID || process.env.REPLIT_DB_URL;

    if (!isReplit) {
        console.log('   ⚠️  Not running on Replit');
        console.log('   Object Storage only works on Replit deployments');
        console.log('   Local development will use uploads/ folder');
        console.log('');
    } else {
        console.log('   ✅ Running on Replit');
        console.log('');
    }

    // Test Object Storage service
    console.log('4️⃣  Testing Object Storage Service:');
    try {
        const storageService = new DocumentStorageService();

        // Try to get the private object directory
        const dir = storageService.getPrivateObjectDir();
        console.log(`   ✅ Service initialized successfully`);
        console.log(`   Directory: ${dir}`);
        console.log('');

        // Try to generate an upload URL (this will fail if bucket doesn't exist)
        if (isReplit) {
            try {
                const testUrl = await storageService.getDocumentUploadURL(
                    'crew',
                    'test-crew-id',
                    'test-document.pdf'
                );
                console.log('   ✅ Successfully generated upload URL');
                console.log('   Object Storage is working correctly!');
                console.log('');
            } catch (uploadError: any) {
                console.log('   ❌ Failed to generate upload URL');
                console.log(`   Error: ${uploadError.message}`);
                console.log('');
                console.log('   📝 Possible issues:');
                console.log('      - Bucket does not exist in Object Storage');
                console.log('      - Bucket name mismatch');
                console.log('      - Replit Object Storage service is down');
                console.log('');
                process.exit(1);
            }
        }
    } catch (error: any) {
        console.log('   ❌ Service initialization failed');
        console.log(`   Error: ${error.message}`);
        console.log('');
        process.exit(1);
    }

    // Summary
    console.log('✅ VERIFICATION COMPLETE');
    console.log('='.repeat(60));
    console.log('');
    console.log('Your Object Storage is configured correctly!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Upload a document through the UI');
    console.log('  2. Check server logs for [CLOUD-STORAGE] messages');
    console.log('  3. Verify file path in database starts with "/"');
    console.log('');
    console.log('All new uploads will be stored in Object Storage! 🚀');

    process.exit(0);
}

verifyObjectStorage().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

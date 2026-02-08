// Simple test to send a notification via the existing server
const testMessage = {
    groupId: '120363420779184169@g.us',
    message: `🔔 *TEST NOTIFICATION*

This is a test message to verify mobile push notifications are working.

📱 If you see this as a push notification on your phone, the fix is working!

Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
};

fetch('http://localhost:5000/api/whatsapp/send-test', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(testMessage)
})
    .then(res => res.json())
    .then(data => console.log('✅ Response:', data))
    .catch(err => console.error('❌ Error:', err));

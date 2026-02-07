package com.seacrewmanager.wakeword;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import ai.picovoice.porcupine.Porcupine;
import ai.picovoice.porcupine.PorcupineException;
import ai.picovoice.porcupine.PorcupineManager;
import ai.picovoice.porcupine.PorcupineManagerCallback;

/**
 * Foreground service that continuously listens for the "Captain" wake-word
 * using Porcupine wake-word detection engine.
 */
public class WakeWordService extends Service {
    private static final String TAG = "WakeWordService";
    private static final String CHANNEL_ID = "CaptainWakeWordChannel";
    private static final int NOTIFICATION_ID = 1001;

    private PorcupineManager porcupineManager;
    private boolean isListening = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "WakeWordService created");
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "WakeWordService started");

        // Start as foreground service with notification
        startForeground(NOTIFICATION_ID, createNotification());

        // Initialize wake-word detection
        initializeWakeWordDetection();

        // Service should restart if killed by system
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "WakeWordService destroyed");
        stopWakeWordDetection();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // We don't provide binding
    }

    /**
     * Initialize Porcupine wake-word detection
     */
    private void initializeWakeWordDetection() {
        try {
            // TODO: Replace with your actual Porcupine access key from Picovoice Console
            String accessKey = "YOUR_PORCUPINE_ACCESS_KEY_HERE";

            // Path to the custom "Captain" wake-word model file
            // This will be in res/raw/captain_android.ppn
            String keywordPath = getApplicationContext().getFilesDir().getAbsolutePath() + "/captain_android.ppn";

            // Create Porcupine manager with callback
            porcupineManager = new PorcupineManager.Builder()
                    .setAccessKey(accessKey)
                    .setKeywordPath(keywordPath)
                    .setSensitivity(0.5f) // 0.0 to 1.0, higher = more sensitive
                    .build(getApplicationContext(), new PorcupineManagerCallback() {
                        @Override
                        public void invoke(int keywordIndex) {
                            // Wake-word detected!
                            Log.i(TAG, "🎤 Wake-word 'Captain' detected!");
                            onWakeWordDetected();
                        }
                    });

            // Start listening
            porcupineManager.start();
            isListening = true;

            Log.i(TAG, "✅ Wake-word detection started successfully");
            updateNotification("Captain is listening...");

        } catch (PorcupineException e) {
            Log.e(TAG, "❌ Failed to initialize Porcupine: " + e.getMessage(), e);
            updateNotification("Captain failed to start");
        }
    }

    /**
     * Stop wake-word detection
     */
    private void stopWakeWordDetection() {
        if (porcupineManager != null) {
            try {
                porcupineManager.stop();
                porcupineManager.delete();
                isListening = false;
                Log.i(TAG, "Wake-word detection stopped");
            } catch (PorcupineException e) {
                Log.e(TAG, "Error stopping Porcupine: " + e.getMessage(), e);
            }
        }
    }

    /**
     * Called when wake-word is detected
     */
    private void onWakeWordDetected() {
        // Update notification
        updateNotification("Listening to your command...");

        // Broadcast wake-word detection to the app
        Intent intent = new Intent("com.seacrewmanager.WAKEWORD_DETECTED");
        sendBroadcast(intent);

        // TODO: Start speech recognition here
        // This will be implemented in the next phase

        // Reset notification after a delay
        new android.os.Handler().postDelayed(() -> {
            updateNotification("Captain is listening...");
        }, 3000);
    }

    /**
     * Create notification channel (required for Android 8.0+)
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Captain Wake-Word Detection",
                    NotificationManager.IMPORTANCE_LOW // Low importance = no sound
            );
            channel.setDescription("Allows Captain to listen for wake-word in background");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Create the foreground service notification
     */
    private Notification createNotification() {
        return createNotificationWithText("Captain is starting...");
    }

    /**
     * Update notification text
     */
    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, createNotificationWithText(text));
        }
    }

    /**
     * Create notification with custom text
     */
    private Notification createNotificationWithText(String text) {
        // Intent to open the app when notification is tapped
        Intent notificationIntent = new Intent(this, getMainActivityClass());
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🎤 Captain Assistant")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now) // TODO: Replace with custom icon
                .setContentIntent(pendingIntent)
                .setOngoing(true) // Cannot be dismissed by user
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    /**
     * Get the main activity class
     */
    private Class<?> getMainActivityClass() {
        try {
            return Class.forName(getPackageName() + ".MainActivity");
        } catch (ClassNotFoundException e) {
            Log.e(TAG, "MainActivity not found", e);
            return null;
        }
    }
}

package com.seacrewmanager.wakeword;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Capacitor plugin for native wake-word detection
 * Provides JavaScript interface to start/stop wake-word listening
 */
@CapacitorPlugin(name = "WakeWord", permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
})
public class WakeWordPlugin extends Plugin {
    private static final String TAG = "WakeWordPlugin";
    private static final int PERMISSION_REQUEST_CODE = 1001;

    private BroadcastReceiver wakeWordReceiver;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "WakeWordPlugin loaded");

        // Register broadcast receiver for wake-word detection
        registerWakeWordReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        unregisterWakeWordReceiver();
    }

    /**
     * Start wake-word detection service
     */
    @PluginMethod
    public void start(PluginCall call) {
        Log.d(TAG, "start() called");

        // Check if we have microphone permission
        if (!hasMicrophonePermission()) {
            Log.w(TAG, "Microphone permission not granted");
            call.reject("Microphone permission required");
            return;
        }

        // Check if we have notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!hasNotificationPermission()) {
                Log.w(TAG, "Notification permission not granted");
                call.reject("Notification permission required");
                return;
            }
        }

        try {
            // Start the foreground service
            Intent serviceIntent = new Intent(getContext(), WakeWordService.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            Log.i(TAG, "✅ Wake-word service started");

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Wake-word detection started");
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start service: " + e.getMessage(), e);
            call.reject("Failed to start wake-word service: " + e.getMessage());
        }
    }

    /**
     * Stop wake-word detection service
     */
    @PluginMethod
    public void stop(PluginCall call) {
        Log.d(TAG, "stop() called");

        try {
            Intent serviceIntent = new Intent(getContext(), WakeWordService.class);
            getContext().stopService(serviceIntent);

            Log.i(TAG, "Wake-word service stopped");

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Wake-word detection stopped");
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Failed to stop service: " + e.getMessage(), e);
            call.reject("Failed to stop wake-word service: " + e.getMessage());
        }
    }

    /**
     * Check if wake-word service is running
     */
    @PluginMethod
    public void isRunning(PluginCall call) {
        // TODO: Implement service status check
        JSObject result = new JSObject();
        result.put("isRunning", false); // Placeholder
        call.resolve(result);
    }

    /**
     * Request microphone permission
     */
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "requestPermissions() called");

        if (hasMicrophonePermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        // Request permission
        requestPermissionForAlias("microphone", call, "permissionCallback");
    }

    /**
     * Check if microphone permission is granted
     */
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("microphone", hasMicrophonePermission());
        result.put("notifications", hasNotificationPermission());
        call.resolve(result);
    }

    /**
     * Register broadcast receiver for wake-word detection events
     */
    private void registerWakeWordReceiver() {
        wakeWordReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Log.i(TAG, "🎤 Wake-word detected broadcast received");

                // Notify JavaScript
                JSObject data = new JSObject();
                data.put("wakeWord", "captain");
                data.put("timestamp", System.currentTimeMillis());
                notifyListeners("wakeWordDetected", data);
            }
        };

        IntentFilter filter = new IntentFilter("com.seacrewmanager.WAKEWORD_DETECTED");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(wakeWordReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(wakeWordReceiver, filter);
        }

        Log.d(TAG, "Wake-word broadcast receiver registered");
    }

    /**
     * Unregister broadcast receiver
     */
    private void unregisterWakeWordReceiver() {
        if (wakeWordReceiver != null) {
            try {
                getContext().unregisterReceiver(wakeWordReceiver);
                Log.d(TAG, "Wake-word broadcast receiver unregistered");
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver: " + e.getMessage());
            }
        }
    }

    /**
     * Check if microphone permission is granted
     */
    private boolean hasMicrophonePermission() {
        return ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Check if notification permission is granted (Android 13+)
     */
    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true; // Not required on older Android versions
    }
}

import { registerPlugin } from '@capacitor/core';

export interface WakeWordPlugin {
    /**
     * Start wake-word detection service
     */
    start(): Promise<{ success: boolean; message: string }>;

    /**
     * Stop wake-word detection service
     */
    stop(): Promise<{ success: boolean; message: string }>;

    /**
     * Check if wake-word service is running
     */
    isRunning(): Promise<{ isRunning: boolean }>;

    /**
     * Request microphone and notification permissions
     */
    requestPermissions(): Promise<{ granted: boolean }>;

    /**
     * Check current permissions status
     */
    checkPermissions(): Promise<{ microphone: boolean; notifications: boolean }>;

    /**
     * Add listener for wake-word detection events
     */
    addListener(
        eventName: 'wakeWordDetected',
        listenerFunc: (data: { wakeWord: string; timestamp: number }) => void
    ): Promise<any>;

    /**
     * Remove all listeners
     */
    removeAllListeners(): Promise<void>;
}

const WakeWord = registerPlugin<WakeWordPlugin>('WakeWord', {
    web: () => import('./web').then(m => new m.WakeWordWeb()),
});

export default WakeWord;

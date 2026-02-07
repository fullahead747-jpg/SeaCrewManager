import { WebPlugin } from '@capacitor/core';
import type { WakeWordPlugin } from './index';

/**
 * Web implementation of WakeWord plugin (fallback for browser)
 * Wake-word detection only works on native Android
 */
export class WakeWordWeb extends WebPlugin implements WakeWordPlugin {
    async start(): Promise<{ success: boolean; message: string }> {
        console.warn('Wake-word detection is only available on Android');
        return {
            success: false,
            message: 'Wake-word detection is only available on native Android app',
        };
    }

    async stop(): Promise<{ success: boolean; message: string }> {
        return {
            success: false,
            message: 'Wake-word detection is only available on native Android app',
        };
    }

    async isRunning(): Promise<{ isRunning: boolean }> {
        return { isRunning: false };
    }

    async requestPermissions(): Promise<{ granted: boolean }> {
        return { granted: false };
    }

    async checkPermissions(): Promise<{ microphone: boolean; notifications: boolean }> {
        return { microphone: false, notifications: false };
    }
}

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface VoiceAssistantProps {
    className?: string;
    minimalist?: boolean;
    baseUrl?: string;
}

export default function VoiceAssistant({ className, minimalist = false, baseUrl = 'http://192.168.0.198:5000' }: VoiceAssistantProps) {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [isEnabled, setIsEnabled] = useState(minimalist); // Auto-enable in minimalist mode
    const [error, setError] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [showNameInput, setShowNameInput] = useState(false);
    const [nameInputValue, setNameInputValue] = useState('');

    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    // Helper function to get time-based greeting
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) {
            return 'Good morning';
        } else if (hour >= 12 && hour < 17) {
            return 'Good afternoon';
        } else if (hour >= 17 && hour < 22) {
            return 'Good evening';
        } else {
            return 'Good night';
        }
    };

    // Initial greeting trigger
    useEffect(() => {
        const savedName = localStorage.getItem('captainUserName');
        console.log('🎤 Greeting effect triggered:', { savedName, minimalist, isEnabled });

        if (savedName && minimalist && isEnabled) {
            let attempts = 0;
            const triggerGreeting = () => {
                attempts++;
                const voices = synthRef.current?.getVoices();
                console.log(`🔊 Attempt ${attempts}: Voices loaded:`, voices?.length || 0);

                if (voices && voices.length > 0) {
                    console.log('✅ Playing welcome greeting');
                    const greeting = getTimeBasedGreeting();
                    const message = `${greeting} ${savedName}. I'm Captain, your fleet management assistant. How can I help you today?`;
                    console.log('📢 Greeting message:', message);
                    speak(message);
                } else if (attempts < 30) {
                    // Keep trying longer on mobile (30 attempts = 12 seconds)
                    console.log(`⏳ Retrying in 400ms... (attempt ${attempts}/30)`);
                    setTimeout(triggerGreeting, 400);
                } else {
                    console.error('❌ Greeting failed: Voices not loaded after 30 attempts');
                }
            };
            setTimeout(triggerGreeting, 800); // Increased initial delay
        }
        if (savedName) setUserName(savedName);
    }, [minimalist, isEnabled]);

    useEffect(() => {
        // Check if browser supports Web Speech API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setError('Your browser does not support voice recognition. Please use Chrome, Edge, or Safari.');
            return;
        }

        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        // Initialize Speech Synthesis
        if ('speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;

            // Force load voices and listen for voiceschanged event
            const loadVoices = () => {
                if (synthRef.current) {
                    const voices = synthRef.current.getVoices();
                    console.log('🔊 Voices loaded:', voices.length);
                    if (voices.length > 0) {
                        console.log('Available voices:', voices.map(v => v.name).join(', '));
                    }
                }
            };

            // Load voices immediately
            loadVoices();

            // Also listen for voiceschanged event (important for Chrome/Edge)
            if (synthRef.current) {
                synthRef.current.addEventListener('voiceschanged', loadVoices);
            }
        } else {
            console.warn('Speech synthesis not supported in this environment');
        }

        recognitionRef.current.onstart = () => {
            console.log('🎤 Microphone active');
            setIsListening(true);
            setError(null);
        };

        recognitionRef.current.onresult = async (event: any) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript.trim();

            console.log('🎤 Heard:', text);
            setTranscript(text);

            // Check for wake word
            const lowerText = text.toLowerCase();
            if (lowerText.includes('captain')) {
                console.log('🚢 Wake word detected!');

                // Extract the query after "captain"
                const query = text.replace(/(?:hey\s+)?captain[,\s]*/i, '').trim();

                if (query) {
                    await processQuery(query);
                } else {
                    const savedName = localStorage.getItem('captainUserName');
                    speak(`Yes ${savedName || ''}, how can I help you?`);
                }
            } else {
                // If it's not a wake word, but we just spoke, maybe we should still process?
                // For "Alexa-style", usually we only process after the wake word.
                // But if we want it to be more fluid, we can keep it simple.
            }
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please grant permission in your phone settings.');
            } else {
                setError(`Voice recognition error: ${event.error}`);
            }
            setIsListening(false);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
            // Auto-restart if enabled
            if (isEnabled && !isProcessing) {
                setTimeout(() => {
                    try {
                        recognitionRef.current?.start();
                    } catch (e) {
                        // Silently ignore
                    }
                }, 100);
            }
        };

        // Start automatically in minimalist mode
        if (minimalist && isEnabled) {
            const startRecognition = () => {
                if (!recognitionRef.current) return;
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.log('Recognition already started or failed to start:', e);
                }
            };

            // On some mobile devices, we need a small delay after initialization
            setTimeout(startRecognition, 100);
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (synthRef.current) {
                synthRef.current.cancel();
            }
        };
    }, [isEnabled, isProcessing, minimalist]);

    const processQuery = async (query: string) => {
        setIsProcessing(true);

        try {
            console.log('🤖 Processing query using baseUrl:', baseUrl);

            const res = await fetch(`${baseUrl}/api/assistant/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();
            const answer = data.response;

            console.log('🤖 Captain response:', answer);
            setResponse(answer);

            // Speak the response
            speak(answer);

        } catch (err) {
            console.error('Error processing query:', err);
            const errorMsg = `Connectivity error. Unable to reach Captain at ${baseUrl}. Please check your network and ensures the server is running.`;
            setResponse(errorMsg);
            speak(errorMsg);
        } finally {
            setIsProcessing(false);
        }
    };

    const speak = (text: string) => {
        if (!synthRef.current) return;

        // Cancel any ongoing speech
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Select best available female voice
        const voices = synthRef.current.getVoices();
        const femaleVoice = voices.find(voice =>
            voice.name.includes('Female') ||
            voice.name.includes('Zira') ||
            voice.name.includes('Samantha') ||
            voice.name.includes('Karen') ||
            voice.name.includes('Google UK English Female') ||
            voice.name.includes('Google US English Female')
        );

        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        // Voice characteristics: commanding yet warm
        utterance.rate = 0.95;    // Confident, measured pace
        utterance.pitch = 0.9;    // Slightly deeper for authority
        utterance.volume = 1.0;   // Clear, commanding presence

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        synthRef.current.speak(utterance);
    };

    const toggleAssistant = () => {
        if (isEnabled) {
            // Disable
            setIsEnabled(false);
            setIsListening(false);
            recognitionRef.current?.stop();
            synthRef.current?.cancel();
            setTranscript('');
            setResponse('');
        } else {
            // Check if user name is set
            if (!userName) {
                setShowNameInput(true);
                return;
            }

            // Enable
            setIsEnabled(true);
            setError(null);
            try {
                recognitionRef.current?.start();
                const timeGreeting = getTimeBasedGreeting();
                const greeting = `${timeGreeting} ${userName}! Captain is ready. Say "Captain" followed by your question.`;
                speak(greeting);
            } catch (e) {
                console.error('Failed to start recognition:', e);
                setError('Failed to start voice recognition. Please check your microphone permissions.');
            }
        }
    };

    const handleNameSubmit = () => {
        if (nameInputValue.trim()) {
            const name = nameInputValue.trim();
            setUserName(name);
            localStorage.setItem('captainUserName', name);
            setShowNameInput(false);
            setNameInputValue('');

            // Now enable Captain
            setIsEnabled(true);
            setError(null);
            try {
                recognitionRef.current?.start();
                const timeGreeting = getTimeBasedGreeting();
                const greeting = `${timeGreeting} ${name}! Nice to meet you. Captain is ready. Say "Captain" followed by your question.`;
                speak(greeting);
            } catch (e) {
                console.error('Failed to start recognition:', e);
                setError('Failed to start voice recognition. Please check your microphone permissions.');
            }
        }
    };

    if (error && !isEnabled) {
        return (
            <Card className={cn("p-4 bg-red-50 border-red-200", className)}>
                <p className="text-sm text-red-600">{error}</p>
            </Card>
        );
    }

    // Name input dialog (only shown in non-minimalist mode or if explicit)
    if (showNameInput && !minimalist) {
        return (
            <Card className={cn("p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200", className)}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
                        <Mic className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Welcome to Captain! 🎤</h3>
                        <p className="text-sm text-gray-600">
                            To provide personalized assistance, please tell me your name:
                        </p>
                    </div>
                    <div className="w-full max-w-sm">
                        <Input
                            type="text"
                            placeholder="Enter your name"
                            value={nameInputValue}
                            onChange={(e) => setNameInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                            className="text-center"
                            autoFocus
                        />
                    </div>
                    <Button
                        onClick={handleNameSubmit}
                        size="lg"
                        className="w-full max-w-sm bg-blue-600 hover:bg-blue-700"
                        disabled={!nameInputValue.trim()}
                    >
                        Continue
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <div className={cn("flex flex-col items-center gap-8 w-full max-w-md mx-auto", className)}>
            {/* Captain Icon & Status */}
            <div className="relative group">
                <div className={cn(
                    "w-48 h-48 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl",
                    isListening ? "bg-blue-600 scale-105 shadow-blue-500/50" :
                        isProcessing ? "bg-yellow-500 animate-pulse shadow-yellow-500/50" :
                            isSpeaking ? "bg-green-500 shadow-green-500/50" :
                                isEnabled ? "bg-blue-500/20 border-2 border-blue-500/30 backdrop-blur-sm" : "bg-slate-800"
                )}>
                    {isSpeaking ? (
                        <div className="flex gap-1 items-center">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-2 h-12 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                        </div>
                    ) : (
                        <Mic className={cn(
                            "w-20 h-20 transition-all duration-500",
                            isEnabled ? "text-blue-400" : "text-slate-600",
                            isListening && "text-white scale-110"
                        )} />
                    )}
                </div>

                {/* Listening waves animation */}
                {isListening && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
                        <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-10" style={{ animationDelay: '0.4s' }} />
                    </>
                )}
            </div>

            {/* Response Area */}
            <div className="w-full space-y-6 text-center">
                {transcript && (
                    <div className="space-y-1 animate-in slide-in-from-bottom-2">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">You said</p>
                        <p className="text-xl font-medium text-white/80 italic">"{transcript}"</p>
                    </div>
                )}

                {response && (
                    <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-500">
                        <p className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-3">Captain</p>
                        <p className="text-lg leading-relaxed text-slate-200">{response}</p>
                    </div>
                )}

                {/* Status Text and Toggle (Only shown in non-minimalist mode) */}
                {!minimalist && (
                    <>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-gray-900">
                                {isProcessing ? 'Processing...' :
                                    isSpeaking ? 'Captain Speaking...' :
                                        isListening ? 'Listening...' :
                                            isEnabled ? 'Say "Captain"' : 'Captain Offline'}
                            </h3>
                        </div>

                        <Button
                            onClick={toggleAssistant}
                            size="lg"
                            className={cn(
                                "w-full transition-all",
                                isEnabled ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            {isEnabled ? 'Disable Captain' : 'Enable Captain'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}


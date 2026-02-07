import VoiceAssistant from '@/components/voice-assistant';
import { Card } from '@/components/ui/card';

export default function CaptainPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Captain Voice Assistant</h1>
                <p className="text-gray-600 mt-2">
                    Your intelligent voice-powered fleet management assistant
                </p>
            </div>

            {/* Main Voice Assistant */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Voice Interface */}
                <div className="lg:col-span-2">
                    <VoiceAssistant />
                </div>

                {/* Information Panel */}
                <div className="space-y-4">
                    <Card className="p-6 bg-white">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Use Captain</h3>
                        <ol className="space-y-3 text-sm text-gray-600">
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">1</span>
                                <span>Click "Enable Captain" to activate voice recognition</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">2</span>
                                <span>Say "Hey Captain" to wake the assistant</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">3</span>
                                <span>Ask your question about crew, vessels, contracts, or documents</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">4</span>
                                <span>Listen to Captain's voice response</span>
                            </li>
                        </ol>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Example Questions</h3>
                        <div className="space-y-2 text-sm">
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-gray-700">"Hey Captain, who is the captain of Emerald?"</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-gray-700">"Hey Captain, show me all expiring contracts"</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-gray-700">"Hey Captain, list crew on shore"</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-gray-700">"Hey Captain, which documents are expiring soon?"</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-yellow-50 border-yellow-200">
                        <h3 className="text-sm font-semibold text-yellow-900 mb-2">Browser Compatibility</h3>
                        <p className="text-xs text-yellow-800">
                            Captain works best on Chrome, Edge, and Safari. Make sure to allow microphone access when prompted.
                        </p>
                    </Card>
                </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <Card className="p-6 text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">🎤</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Voice Activated</h4>
                    <p className="text-sm text-gray-600">
                        Hands-free operation with "Hey Captain" wake word
                    </p>
                </Card>

                <Card className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">🧠</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">AI-Powered</h4>
                    <p className="text-sm text-gray-600">
                        Intelligent responses based on your real fleet data
                    </p>
                </Card>

                <Card className="p-6 text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">⚡</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Lightning Fast</h4>
                    <p className="text-sm text-gray-600">
                        Instant responses powered by Groq's ultra-fast AI
                    </p>
                </Card>
            </div>
        </div>
    );
}

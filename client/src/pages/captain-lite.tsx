import { useState, useEffect } from 'react';
import VoiceAssistant from '@/components/voice-assistant';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mic, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CaptainLite() {
    const [userName, setUserName] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [mountCheck, setMountCheck] = useState(false);
    const [serverUrl, setServerUrl] = useState('http://192.168.0.198:5000');
    const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');

    useEffect(() => {
        console.log("CaptainLite Mounted v10");
        setMountCheck(true);
        const savedName = localStorage.getItem('captainUserName');
        const savedUrl = localStorage.getItem('captainServerUrl');
        if (savedName) {
            setUserName(savedName);
        }
        if (savedUrl) {
            setServerUrl(savedUrl);
        }
        setIsInitialized(true);
    }, []);

    const handleStart = () => {
        if (inputValue.trim()) {
            const name = inputValue.trim();
            localStorage.setItem('captainUserName', name);
            setUserName(name);
            setIsActive(true);
        }
    };

    const handleActivate = () => {
        setIsActive(true);
    };

    const testConnection = async () => {
        setConnStatus('testing');
        try {
            const res = await fetch(`${serverUrl}/api/assistant/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'health check' })
            });
            if (res.ok) setConnStatus('success');
            else setConnStatus('fail');
        } catch (e) {
            setConnStatus('fail');
        }
    };

    const updateServerUrl = (url: string) => {
        setServerUrl(url);
        localStorage.setItem('captainServerUrl', url);
        setConnStatus('idle');
    };

    if (!mountCheck) return <div className="fixed inset-0 bg-[#0f172a] text-white flex items-center justify-center">Loading Captain Assistant...</div>;
    if (!isInitialized) return <div className="fixed inset-0 bg-[#0f172a] text-white flex items-center justify-center">Initializing...</div>;

    // Onboarding Screen (First time only)
    if (!userName) {
        return (
            <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center p-6 text-white overflow-hidden z-50">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-4">
                        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20">
                            <Mic className="w-12 h-12 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Welcome to Captain</h1>
                        <p className="text-slate-400">Premium maritime intelligence</p>
                    </div>

                    <Card className="p-6 bg-slate-900/50 border-slate-800 backdrop-blur-xl">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">What should I call you?</label>
                                <Input
                                    autoFocus
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleStart()}
                                    placeholder="Enter your name"
                                    className="bg-slate-950 border-slate-700 text-white text-lg h-14 text-center rounded-2xl"
                                />
                            </div>
                            <Button
                                onClick={handleStart}
                                className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-bold rounded-2xl shadow-lg transition-all"
                                disabled={!inputValue.trim()}
                            >
                                Get Started
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    // Assistant Activation Screen
    if (!isActive) {
        return (
            <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center p-6 text-white z-50">
                <div className="w-full max-w-md text-center space-y-12">
                    <div className="space-y-4">
                        <div className="w-28 h-28 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 active:scale-95 transition-all shadow-2xl shadow-blue-500/10" onClick={handleActivate}>
                            <Mic className="w-14 h-14 text-blue-500" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight">Hello, {userName}</h1>
                        <p className="text-slate-400 text-lg">Tap to wake up Captain</p>
                    </div>
                    <Button
                        onClick={handleActivate}
                        className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-xl font-bold rounded-3xl shadow-xl shadow-blue-500/20"
                    >
                        Start Assistant
                    </Button>

                    <div className="pt-8 opacity-40">
                        <p className="text-[10px] text-slate-500">v10.final.stable</p>
                    </div>
                </div>
            </div>
        );
    }

    // Main Assistant Screen
    return (
        <div className="fixed inset-0 bg-[#0f172a] text-white flex flex-col items-center justify-center overflow-hidden z-50">
            {/* Visual background accents */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Settings Trigger */}
            <div className="absolute top-6 right-6">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-white/5 rounded-full">
                            <Settings className="w-6 h-6" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm sm:max-w-md rounded-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold">Network Settings</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400 font-medium">Captain Server Address</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={serverUrl}
                                        onChange={(e) => updateServerUrl(e.target.value)}
                                        className="bg-slate-950 border-slate-700 font-mono text-sm"
                                        placeholder="http://IP:PORT"
                                    />
                                    <Button size="icon" onClick={testConnection} className={cn(
                                        "shrink-0 rounded-xl",
                                        connStatus === 'success' ? 'bg-green-600' : 'bg-blue-600'
                                    )} disabled={connStatus === 'testing'}>
                                        {connStatus === 'testing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-500">Change this if your computer IP has changed.</p>
                            </div>

                            {connStatus === 'success' && (
                                <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-xl flex items-center gap-3 text-green-400">
                                    <Wifi className="w-4 h-4" />
                                    <span className="text-xs font-medium">Connected to Captain Engine</span>
                                </div>
                            )}
                            {connStatus === 'fail' && (
                                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400">
                                    <WifiOff className="w-4 h-4" />
                                    <span className="text-xs font-medium">Could not reach server. Check IP & Firewall.</span>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-800">
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                    <span>Version</span>
                                    <span>v10.1.final</span>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="w-full max-w-2xl px-6 py-12 flex flex-col h-full items-center justify-center relative">
                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-3xl font-bold tracking-tight text-white/90">
                        System Active
                    </h2>
                    <p className="text-blue-400 font-medium italic opacity-80">Listening for "Captain"</p>
                </div>

                <VoiceAssistant
                    className="w-full bg-transparent border-none shadow-none"
                    minimalist={true}
                    baseUrl={serverUrl}
                />

                <div className="mt-12 text-center space-y-4 max-w-sm animate-in fade-in duration-1000 delay-300">
                    <p className="text-slate-500 text-sm">
                        Say "Captain" followed by your request.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {["List crew", "Expiring contracts", "Vessel status"].map(tip => (
                            <span key={tip} className="px-3 py-1 bg-slate-800/50 rounded-full text-[10px] text-slate-400 border border-slate-700/50">
                                {tip}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

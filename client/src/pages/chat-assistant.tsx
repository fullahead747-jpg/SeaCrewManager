import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Search, User, MoreVertical, Paperclip, Smile, ShieldCheck, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/app-layout';
import { WhatsappMessage, WhatsappSettings } from '@shared/schema';

export default function ChatAssistant() {
    const [selectedJid, setSelectedJid] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch WhatsApp Settings to get the Group ID
    const { data: settings } = useQuery<WhatsappSettings>({
        queryKey: ['/api/whatsapp/settings'],
    });

    // Auto-select the fleet group if settings are loaded
    useEffect(() => {
        if (settings?.groupId && !selectedJid) {
            const jid = settings.groupId.includes('@g.us') ? settings.groupId : `${settings.groupId}@g.us`;
            setSelectedJid(jid);
        }
    }, [settings, selectedJid]);

    // Fetch message history for the selected group
    const { data: messages, isLoading } = useQuery<WhatsappMessage[]>({
        queryKey: [`/api/whatsapp/messages?remoteJid=${selectedJid}`],
        enabled: !!selectedJid,
        refetchInterval: 5000, // Poll every 5 seconds for simulation of real-time
    });

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const formatTime = (dateStr: string | Date) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-160px)]">
                {/* Header Section */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Chat Assistant</h1>
                    <p className="text-gray-500">Monitor your WhatsApp fleet group conversations</p>
                </div>

                {/* Main WhatsApp Window */}
                <Card className="flex flex-1 overflow-hidden border-none shadow-xl rounded-2xl bg-[#f0f2f5]">
                    {/* Left Sidebar: Chat List */}
                    <div className="w-80 bg-white border-r flex flex-col">
                        <div className="p-4 bg-[#f0f2f5] flex items-center justify-between border-b">
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <User className="text-gray-600 w-6 h-6" />
                            </div>
                            <div className="flex gap-2 text-gray-500">
                                <Smile className="w-5 h-5 cursor-pointer" />
                                <MoreVertical className="w-5 h-5 cursor-pointer" />
                            </div>
                        </div>

                        {/* Search bar */}
                        <div className="p-2 border-b bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search or start new chat"
                                    className="pl-10 bg-[#f0f2f5] border-none rounded-lg h-9 focus-visible:ring-0"
                                />
                            </div>
                        </div>

                        {/* Chats Table */}
                        <ScrollArea className="flex-1">
                            <div
                                className={cn(
                                    "p-3 flex items-center gap-3 cursor-pointer transition-colors",
                                    selectedJid ? "bg-[#f0f2f5]" : "hover:bg-gray-50"
                                )}
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="text-blue-600 w-6 h-6" />
                                </div>
                                <div className="flex-1 overflow-hidden border-b pb-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-gray-900 truncate">Fleet Group</h3>
                                        <span className="text-xs text-gray-500">
                                            {messages?.length ? formatTime(messages[messages.length - 1].timestamp) : 'Now'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 truncate mt-0.5">
                                        {messages?.length ? messages[messages.length - 1].body : 'Waiting for messages...'}
                                    </p>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right Panel: Conversation Thread */}
                    <div className="flex-1 flex flex-col bg-[#efeae2] relative">
                        {/* WhatsApp Background Pattern Overlay */}
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                            style={{ backgroundImage: 'url("https://w7.pngwing.com/pngs/422/126/png-transparent-whatsapp-pattern-vignette-thumbnail.png")' }}>
                        </div>

                        {/* Chat Header */}
                        <div className="p-3 bg-[#f0f2f5] border-b flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <ShieldCheck className="text-blue-600 w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 leading-tight">Fleet Group</h3>
                                    <p className="text-xs text-gray-500">Connected to WhatsApp</p>
                                </div>
                            </div>
                            <div className="flex gap-4 text-gray-500 px-2">
                                <Search className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                                <MoreVertical className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                            </div>
                        </div>

                        {/* Messages Area */}
                        <ScrollArea className="flex-1 p-6 z-10 h-full" viewportRef={scrollRef}>
                            <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                                <div className="self-center bg-white/80 px-3 py-1 text-[11px] rounded-lg shadow-sm text-gray-500 font-medium uppercase mb-4">
                                    Today
                                </div>

                                {isLoading ? (
                                    <div className="space-y-4">
                                        <Skeleton className="h-12 w-3/4 rounded-2xl rounded-tl-none" />
                                        <Skeleton className="h-12 w-1/2 self-end rounded-2xl rounded-tr-none" />
                                    </div>
                                ) : (
                                    messages?.map((msg) => {
                                        const isBot = msg.senderName === 'Bot';
                                        const isRight = msg.fromMe && !isBot;

                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "max-w-[80%] px-3 py-1.5 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative group",
                                                    isRight
                                                        ? "self-end bg-[#d9fdd3] rounded-tr-none"
                                                        : "self-start bg-white rounded-tl-none"
                                                )}
                                            >
                                                {(!msg.fromMe || isBot) && (
                                                    <div className={cn(
                                                        "text-[12.5px] font-semibold mb-0.5",
                                                        isBot ? "text-[#00a884]" : "text-blue-600"
                                                    )}>
                                                        {msg.senderName || 'Crew Member'}
                                                    </div>
                                                )}
                                                <div className="text-[14.2px] text-gray-900 leading-relaxed whitespace-pre-wrap pr-12">
                                                    {msg.body}
                                                </div>
                                                <div className="flex items-center gap-1 justify-end mt-[-8px] text-[11px] text-gray-500">
                                                    <span>{formatTime(msg.timestamp)}</span>
                                                    {isRight && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-3 bg-[#f0f2f5] border-t flex items-center gap-3 z-10">
                            <Smile className="w-6 h-6 text-gray-500 cursor-pointer hover:text-gray-700" />
                            <Paperclip className="w-6 h-6 text-gray-500 cursor-pointer hover:text-gray-700 rotate-45" />
                            <div className="flex-1 relative">
                                <Input
                                    className="bg-white border-none rounded-lg h-10 px-4 focus-visible:ring-0 shadow-sm"
                                    placeholder="Type a message (Send via WhatsApp to test)"
                                    disabled
                                />
                            </div>
                            <div className="bg-[#00a884] p-2.5 rounded-full cursor-not-allowed hover:bg-[#008f6f] transition-colors shadow-sm">
                                <Send className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}

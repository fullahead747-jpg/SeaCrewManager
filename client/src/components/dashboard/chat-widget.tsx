import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, MessageCircle, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WhatsappMessage, WhatsappSettings } from '@shared/schema';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

export default function ChatWidget() {
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: settings } = useQuery<WhatsappSettings>({
        queryKey: ['/api/whatsapp/settings'],
    });

    const selectedJid = settings?.groupId?.includes('@g.us')
        ? settings.groupId
        : (settings?.groupId ? `${settings.groupId}@g.us` : null);

    const { data: messages } = useQuery<WhatsappMessage[]>({
        queryKey: [`/api/whatsapp/messages?remoteJid=${selectedJid}`],
        enabled: !!selectedJid,
        refetchInterval: 5000,
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const formatTime = (dateStr: string | Date) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!selectedJid) return null;

    return (
        <Card className="h-full flex flex-col border-none shadow-md overflow-hidden bg-[#efeae2] relative min-h-[400px]">
            {/* WhatsApp Background Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'url("https://w7.pngwing.com/pngs/422/126/png-transparent-whatsapp-pattern-vignette-thumbnail.png")' }}>
            </div>

            <CardHeader className="bg-white/80 backdrop-blur-sm border-b p-3 flex-row items-center justify-between space-y-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <ShieldCheck className="text-blue-600 w-4 h-4" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold">Fleet Chat</CardTitle>
                        <p className="text-[10px] text-gray-500">Live Assistant</p>
                    </div>
                </div>
                <MessageCircle className="w-4 h-4 text-gray-400" />
            </CardHeader>

            <CardContent className="flex-1 p-3 z-10 flex flex-col justify-end">
                <ScrollArea className="flex-1 h-[300px]" viewportRef={scrollRef}>
                    <div className="flex flex-col gap-2">
                        {messages?.slice(-20).map((msg) => {
                            const isBot = msg.senderName === 'Bot';
                            const isRight = msg.fromMe && !isBot;

                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "max-w-[90%] px-2 py-1 rounded-lg shadow-sm text-[12px]",
                                        isRight
                                            ? "self-end bg-[#d9fdd3]"
                                            : "self-start bg-white"
                                    )}
                                >
                                    {(!msg.fromMe || isBot) && (
                                        <div className={cn(
                                            "text-[10px] font-bold mb-0.5",
                                            isBot ? "text-[#00a884]" : "text-blue-600"
                                        )}>
                                            {msg.senderName || 'Crew'}
                                        </div>
                                    )}
                                    <div className="text-gray-900 leading-snug">
                                        {msg.body}
                                    </div>
                                    <div className="text-[9px] text-gray-500 text-right mt-0.5">
                                        {formatTime(msg.timestamp)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <div className="mt-2 bg-white rounded-full px-3 py-2 flex items-center gap-2 shadow-sm border">
                    <span className="text-xs text-gray-400 flex-1">Read only via dashboard...</span>
                    <Send className="w-3 h-3 text-gray-300" />
                </div>
            </CardContent>
        </Card>
    );
}

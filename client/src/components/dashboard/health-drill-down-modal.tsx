
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2, AlertCircle, Anchor, Calendar, User, Ship, Clock } from "lucide-react";

interface HealthDrillDownModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryKey: string;
    categoryName: string;
    type: 'contract' | 'document';
}

export default function HealthDrillDownModal({
    isOpen,
    onClose,
    categoryKey,
    categoryName,
    type
}: HealthDrillDownModalProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['/api/dashboard/drilldown', type, categoryKey],
        queryFn: async () => {
            if (!categoryKey) return null;
            const response = await fetch(`/api/dashboard/drilldown?type=${type}&key=${categoryKey}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch detail data');
            return response.json();
        },
        enabled: isOpen && !!categoryKey,
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 shadow-2xl">
                <DialogHeader className="p-6 pb-2 border-b border-border/10">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        {type === 'contract' ? 'Contract Details' : 'Document Details'}
                        <Badge className="ml-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-bold">
                            {categoryName}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 dark:text-slate-400 font-medium">
                        {type === 'contract'
                            ? `List of crew members whose contracts are currently in the "${categoryName}" category.`
                            : `List of documents currently in the "${categoryName}" category.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-[400px] max-h-[calc(85vh-180px)] overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-black/20 p-4">
                    {isLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                            <p className="text-slate-600 dark:text-slate-400 animate-pulse text-sm font-medium tracking-tight">Retrieving real-time data...</p>
                        </div>
                    ) : error ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 text-destructive p-8 text-center">
                            <AlertCircle className="h-12 w-12" />
                            <p className="font-semibold text-slate-900 dark:text-white">Failed to load details</p>
                            <p className="text-sm opacity-80">{(error as Error).message}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data && data.length > 0 ? (
                                data.map((item: any) => {
                                    const statusColor = item.daysRemaining <= 15 ? 'bg-red-500' : item.daysRemaining <= 30 ? 'bg-amber-500' : 'bg-blue-500';
                                    const shadowColor = item.daysRemaining <= 15 ? 'hover:shadow-red-500/10' : item.daysRemaining <= 30 ? 'hover:shadow-amber-500/10' : 'hover:shadow-blue-500/10';

                                    return (
                                        <div
                                            key={item.id}
                                            className={`group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 pl-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${shadowColor} flex items-center gap-6`}
                                        >
                                            {/* Urgency Sidebar with Glow */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-2 ${statusColor} group-hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,0,0,0.1)] group-hover:shadow-[0_0_20px_rgba(0,0,0,0.2)]`} />

                                            {/* Main Content */}
                                            <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                                <div className="md:col-span-4 flex items-start gap-2.5">
                                                    <div className="mt-0.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md border border-slate-100 dark:border-slate-700 group-hover:bg-primary/5 transition-colors">
                                                        <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-primary transition-colors tracking-tight truncate">
                                                            {item.crewName || `${item.firstName} ${item.lastName}`}
                                                        </h4>
                                                        <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                            {item.rank || 'Professional Crew'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="md:col-span-4 flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 mb-0.5 flex items-center gap-1.5">
                                                        <Anchor className="h-2 w-2" />
                                                        Vessel / Project
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                                        <Ship className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                        {type === 'contract' ? (item.vesselName || 'Unknown') : item.docType}
                                                    </span>
                                                </div>

                                                <div className="md:col-span-4 flex flex-col border-l border-slate-100 dark:border-slate-800 pl-6">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 mb-0.5 flex items-center gap-1.5">
                                                        <Clock className="h-2 w-2" />
                                                        {type === 'contract' ? 'Expiry Date' : 'Document No.'}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
                                                        <Calendar className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                                                        {type === 'contract'
                                                            ? (item.expiryDate ? format(new Date(item.expiryDate), 'dd MMM yyyy') : 'N/A')
                                                            : (item.docNumber || '---')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Status Badge with Pulsing Dot */}
                                            <div className="flex-shrink-0 text-right pr-4">
                                                <Badge
                                                    className="px-4 py-2 font-black text-[9px] tracking-widest uppercase min-w-[100px] flex items-center justify-center gap-2 shadow-xl border-0 transition-all group-hover:scale-110"
                                                    variant={item.daysRemaining <= 0 ? 'destructive' : item.daysRemaining <= 15 ? 'destructive' : item.daysRemaining <= 30 ? 'warning' : 'secondary'}
                                                >
                                                    {item.daysRemaining !== undefined && (item.daysRemaining < 0 || item.daysRemaining <= 30) && (
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                                        </span>
                                                    )}
                                                    {item.daysRemaining !== undefined
                                                        ? (item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)} OVERDUE` : `${item.daysRemaining} days`)
                                                        : 'N/A'}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-48 flex items-center justify-center text-slate-500 dark:text-slate-400 italic font-medium bg-white/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                                    No records found for this category.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

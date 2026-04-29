
import React from 'react';
import { CrewAvatar } from './crew-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Eye, Edit, History, LogOut, LogIn,
    FileText, Download, Upload, Mail, ChevronDown, Trash2,
    CheckCircle2, AlertCircle, AlertTriangle, UserCog, Check, FileDown, Loader2
} from 'lucide-react';
import { CrewMemberWithDetails, Document } from '@shared/schema';
import { formatDate, formatShortDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { downloadFileFromResponse, openSecureView } from '@/lib/file-utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";

interface CrewDetailCardProps {
    member: CrewMemberWithDetails;
    documents: Document[];
    onView: (member: CrewMemberWithDetails) => void;
    onEdit: (member: CrewMemberWithDetails) => void;
    onVesselHistory: (member: CrewMemberWithDetails) => void;
    onSendMail: (member: CrewMemberWithDetails) => void;
    onDownload: (id: string, name: string) => void;
    onViewAOA: (member: CrewMemberWithDetails) => void;
    onDelete?: (member: CrewMemberWithDetails) => void;
    onDeleteDocument?: (docId: string, type: string, customMessage?: string) => void;
    onSignOn?: (member: CrewMemberWithDetails) => void;
    onSignOff?: (member: CrewMemberWithDetails) => void;
    onUpload?: (member: CrewMemberWithDetails, type: string) => void;
    onBulkUpload?: (member: CrewMemberWithDetails) => void;
    onToggleNA?: (member: CrewMemberWithDetails, type: string, value: boolean) => void;
    isMailPending?: boolean;
}

export const CrewDetailCard = React.memo<CrewDetailCardProps>(({
    member,
    documents,
    onView,
    onEdit,
    onVesselHistory,
    onSendMail,
    onDownload,
    onViewAOA,
    onDelete,
    onDeleteDocument,
    onSignOn,
    onSignOff,
    onUpload,
    onBulkUpload,
    onToggleNA,
    isMailPending
}) => {
    const { toast } = useToast();
    const now = React.useMemo(() => new Date(), []);
    const [loadingViewDocId, setLoadingViewDocId] = React.useState<string | null>(null);
    const [loadingDownloadDocId, setLoadingDownloadDocId] = React.useState<string | null>(null);

    const contractStats = React.useMemo(() => {
        const startDate = member.activeContract?.startDate ? new Date(member.activeContract.startDate) : null;
        const endDate = member.activeContract?.endDate ? new Date(member.activeContract.endDate) : null;

        let remainingDays = 0;
        let totalDays = 0;
        let progressPercent = 0;
        let progressColor = '#3B82F6'; // Default Blue

        if (member.status === 'onShore') {
            progressPercent = 100;
            progressColor = '#64748b'; // Signed off color
        } else if (startDate && endDate && member.activeContract?.status === 'active') {
            totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

            if (remainingDays < 0) {
                progressPercent = 100;
                progressColor = '#ef4444'; // Overdue
            } else {
                progressPercent = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;

                // Color based on health schema
                if (remainingDays <= 15) progressColor = '#f97316'; // Critical
                else if (remainingDays <= 30) progressColor = '#eab308'; // Upcoming
                else if (remainingDays <= 45) progressColor = '#3b82f6'; // Attention
                else progressColor = '#10b981'; // Not Due
            }
        }

        return { startDate, endDate, remainingDays, totalDays, progressPercent, progressColor };
    }, [member.activeContract, member.status, now]);

    const { startDate, endDate, progressPercent, progressColor } = contractStats;

    const formatShortDate = React.useCallback((date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }, []);

    const getDocTypeLabel = React.useCallback((type: string) => {
        const labels: Record<string, string> = {
            passport: 'Passport',
            cdc: 'CDC',
            coc: 'COC',
            medical: 'Medical',
            aoa: 'AOA',
            photo: 'Photo',
            nok: 'NOK',
            coe: 'COE',
            'coe-extension': 'COE-Extension',
            stcw_course: 'Courses'
        };
        return labels[type] || type.toUpperCase();
    }, []);

    const docStatuses = React.useMemo(() => {
        const TRACKED_DOC_TYPES = ['medical', 'cdc', 'coc', 'stcw_course', 'aoa', 'photo', 'nok', 'passport', 'coe', 'coe-extension'] as const;
        const crewDocs = documents.filter(doc => doc.crewMemberId === member.id);

        return TRACKED_DOC_TYPES.map(type => {
            const isNA = (member as any)[`${type}NotApplicable`] === true ||
                (type === 'stcw_course' && (member as any)['stcwNotApplicable'] === true) ||
                (type === 'coe-extension' && (member as any)['coeExtensionNotApplicable'] === true);

            if (isNA) return { type, status: 'na' as const, expiryDate: null, daysUntil: null, docId: null, filePath: null, isTbd: false };

            let doc = crewDocs.find(d => {
                const docType = d.type.toLowerCase();
                const searchType = type.toLowerCase();
                const isMatch = searchType === 'coc' ? (docType === 'coc' || docType === 'stcw') : (docType === searchType);
                return isMatch;
            });

            if (type === 'aoa' && !doc && member.activeContract) {
                const contract = member.activeContract;
                if (contract.filePath || contract.endDate) {
                    const expiryDate = contract.endDate ? new Date(contract.endDate) : null;
                    const daysUntil = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    let status: any = 'valid';
                    const threshold = 30; // AOA is always 30 days
                    if (daysUntil !== null && daysUntil < 0) status = 'expired';
                    else if (daysUntil !== null && daysUntil <= threshold) status = 'expiring';
                    return { 
                        type, 
                        status, 
                        expiryDate, 
                        daysUntil, 
                        docId: contract.id, 
                        filePath: contract.filePath, 
                        isContract: true,
                        isNoFile: !(contract.filePath)
                    };
                }
            }

            if (!doc) return { type, status: 'missing' as const, expiryDate: null, daysUntil: null, docId: null, filePath: null, isTbd: false };

            // Bypass expiry logic for COE and COE-Extension
            if (type === 'coe' || type === 'coe-extension') {
                return { type, status: 'valid' as const, expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null, daysUntil: null, docId: doc.id, filePath: doc.filePath, isTbd: doc.expiryDate === null, isContract: false };
            }

            let expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
            let isTbd = doc.expiryDate === null;

            // Inheritance logic: AOA inherits contract expiry if its own expiry date is not set
            // OR if the contract expiry is sooner.
            if (type === 'aoa' && member.activeContract?.endDate) {
                const contractEndDate = new Date(member.activeContract.endDate);
                if (!expiryDate || contractEndDate < expiryDate) {
                    expiryDate = contractEndDate;
                    isTbd = false; 
                }
            }

            const daysUntil = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

            let status: any = 'valid';
            if (expiryDate && daysUntil !== null) {
                const threshold = type === 'aoa' ? 30 : 60;
                if (daysUntil < 0) status = 'expired';
                else if (daysUntil <= threshold) status = 'expiring';
            }

            if (type === 'aoa') {
                console.log(`[AOA Debug] ${member.firstName} ${member.lastName}:`, {
                    expiryDate: expiryDate?.toISOString(),
                    now: now.toISOString(),
                    daysUntil,
                    threshold: type === 'aoa' ? 30 : 60,
                    status
                });
            }

            return { 
                type, 
                status, 
                expiryDate, 
                daysUntil, 
                docId: (doc as any)?.id || (doc as any)?.docId || null, 
                filePath: (doc as any)?.filePath || null, 
                isTbd, 
                isContract: (doc as any)?.isContract || false,
                isNoFile: !((doc as any)?.filePath)
            };
        });
    }, [member, documents, now]);

    const stats = React.useMemo(() => {
        // Only count compliance documents for Valid/Expiring/Expired
        // Exclude N/A documents from all counts
        const complianceDocs = docStatuses.filter(d => d.type !== 'photo' && d.type !== 'nok' && d.status !== 'na');

        const validCount = complianceDocs.filter(d => d.status === 'valid').length;
        const expiringCount = complianceDocs.filter(d => d.status === 'expiring').length;
        const expiredCount = complianceDocs.filter(d => d.status === 'expired').length;
        const pendingCount = complianceDocs.filter(d => d.status === 'missing').length;

        return { validCount, expiringCount, expiredCount, pendingCount };
    }, [docStatuses]);

    const { validCount, expiringCount, expiredCount, pendingCount } = stats;

    const handleDocClick = React.useCallback(async (doc: any) => {
        if (!doc.filePath || !doc.docId) {
            toast({ title: 'Not Available', description: 'No document file has been uploaded for this type.' });
            return;
        }
        
        setLoadingViewDocId(doc.docId);
        try {
            // Use token-based viewing system to preserve inline view and secure access
            const tokenEndpoint = doc.isContract ? `/api/contracts/${doc.docId}/view-token` : `/api/documents/${doc.docId}/view-token`;
            const tokenResponse = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            if (tokenResponse.ok) {
                const { viewUrl } = await tokenResponse.json();
                openSecureView(viewUrl);
                return;
            }

            console.warn('Token-based view failed, falling back to blob method');

            // Fallback / Contract Method
            const endpoint = doc.isContract ? `/api/contracts/${doc.docId}/view` : `/api/documents/${doc.docId}/view`;
            const response = await fetch(endpoint, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch document');
            await downloadFileFromResponse(response, `${doc.type.toUpperCase()}_${member.lastName}.pdf`);
        } catch (error) {
            console.error('Document viewer error:', error);
            toast({ title: 'Error', description: 'Failed to open document', variant: 'destructive' });
        } finally {
            setLoadingViewDocId(null);
        }
    }, [toast, member]);

    const handleDocDownload = React.useCallback(async (doc: any) => {
        if (!doc.filePath || !doc.docId) {
            toast({ title: 'Not Available', description: 'No document file has been uploaded for this type.' });
            return;
        }
        
        setLoadingDownloadDocId(doc.docId);
        try {
            const endpoint = doc.isContract ? `/api/contracts/${doc.docId}/view` : `/api/documents/${doc.docId}/view`;
            const response = await fetch(endpoint, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch document');
            await downloadFileFromResponse(response, `${doc.type.toUpperCase()}_${member.lastName}.pdf`);
        } catch (error) {
            console.error('Document download error:', error);
            toast({ title: 'Error', description: 'Failed to download document', variant: 'destructive' });
        } finally {
            setLoadingDownloadDocId(null);
        }
    }, [toast, member]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden mb-6 hover:shadow-lg transition-all duration-300 transform-gpu will-change-transform [content-visibility:auto] [contain-intrinsic-size:auto_350px]">
            <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {/* Left Column: Identity & Info */}
                <div className="lg:w-[48%] p-5">

                    {/* Header Identity Section */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                <CrewAvatar
                                    memberId={member.id}
                                    documents={documents}
                                    firstName={member.firstName}
                                    lastName={member.lastName}
                                    className="h-10 w-10 border border-white shadow-sm"
                                />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[#1E293B] leading-tight uppercase tracking-tight">
                                    {member.firstName} {member.lastName}
                                </h3>
                                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest mt-0.5">
                                    {member.nationality || 'INDIAN'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border-0 ${member.status === 'onBoard'
                                ? 'bg-blue-500 text-white'
                                : 'bg-[#10B981] text-white'
                                }`}>
                                {member.status === 'onBoard' ? 'On Board' : 'On Shore'}
                            </Badge>

                            {member.totalSailedMonths !== undefined && (
                                <HoverCard>
                                    <HoverCardTrigger asChild>
                                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full cursor-help hover:bg-slate-100 transition-colors shadow-sm">
                                            <History className="h-2.5 w-2.5" />
                                            <span className="text-[9px] font-bold uppercase tracking-tight">
                                                Current: {member.totalSailedMonths} Months
                                            </span>
                                        </div>
                                    </HoverCardTrigger>
                                    <HoverCardContent align="end" className="w-64 p-3 z-50">
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                                                <History className="h-3.5 w-3.5" /> Sailing History
                                            </h4>
                                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar">
                                                {member.sailingHistory && member.sailingHistory.length > 0 ? (
                                                    member.sailingHistory.map((history, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm">
                                                            <span className="font-medium text-slate-700 truncate pr-2">{history.vesselName}</span>
                                                            <span className="text-slate-500 text-xs whitespace-nowrap">{history.durationMonths} mos</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-slate-400 italic">No historical data available.</div>
                                                )}
                                            </div>
                                            <div className="border-t pt-1.5 mt-1.5 flex justify-between items-center text-xs font-bold text-slate-700">
                                                <span>Current Vessel Experience</span>
                                                <span className="text-blue-600">{member.totalSailedMonths} mos</span>
                                            </div>
                                        </div>
                                    </HoverCardContent>
                                </HoverCard>
                            )}
                        </div>
                    </div>

                    {/* Rank & Vessel Boxes */}
                    <div className="grid grid-cols-2 gap-2 mb-1.5">
                        <div className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-sm">
                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-0.5">Rank</p>
                            <p className="text-[#1E293B] font-semibold text-sm">{member.rank}</p>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-sm">
                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-0.5">
                                {member.status === 'onShore' ? 'Vessel Last Sailing' : 'Vessel'}
                            </p>
                            <p className={`text-[#1E293B] font-bold ${member.status === 'onShore' && member.lastVessel?.name && member.lastVessel.name.length > 15 ? 'text-sm' : 'text-base'}`}>
                                {member.status === 'onShore'
                                    ? (member.lastVessel?.name || 'Not assigned')
                                    : (member.currentVessel?.name || 'Not assigned')}
                            </p>
                        </div>
                    </div>

                    {/* Timeline & Contract Section */}
                    <div className="mb-4">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[11px] font-medium text-slate-500">
                                {formatShortDate(startDate)} – {formatShortDate(endDate)}
                            </span>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-normal text-slate-400">
                                    {formatShortDate(endDate, 'MMM d')}
                                </span>
                                {contractStats.remainingDays > 0 && (
                                    <span className="text-[9px] font-semibold text-blue-600 uppercase tracking-tighter bg-blue-50 px-1 rounded">
                                        {contractStats.remainingDays} Days Left
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden mb-2 relative">
                            {/* Visual Progress Indication */}
                            <div
                                className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-500 ease-in-out"
                                style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
                            />
                        </div>

                        <div className="pt-1.5 border-t border-slate-100">
                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-0.5">Contract</p>
                            <div className="flex items-center gap-1.5">
                                <FileText className="h-2.5 w-2.5 text-slate-400" />
                                <span className="text-[12px] font-medium text-slate-600">
                                    {formatShortDate(startDate)} – {formatShortDate(endDate)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                        <Button
                            variant="outline"
                            className="h-9 border-slate-200 rounded-lg text-slate-600 font-medium text-[11px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                            onClick={() => onView(member)}
                        >
                            <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                        </Button>
                        <Button
                            variant="outline"
                            className="h-9 border-slate-200 rounded-lg text-slate-600 font-medium text-[11px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                            onClick={() => onEdit(member)}
                        >
                            <UserCog className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                        <Button
                            variant="outline"
                            className="h-9 border-slate-200 rounded-lg text-slate-600 font-medium text-[11px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                            onClick={() => onVesselHistory(member)}
                        >
                            <History className="h-3.5 w-3.5 mr-1.5" /> History
                        </Button>
                        <Button
                            variant="outline"
                            className="h-9 border-slate-200 rounded-lg text-slate-600 font-medium text-[11px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                            onClick={() => onSendMail(member)}
                            disabled={isMailPending}
                        >
                            <Mail className="h-3.5 w-3.5 mr-1.5" /> Mail
                        </Button>
                        <Button
                            variant="outline"
                            className="h-9 border-slate-200 rounded-lg text-slate-600 font-medium text-[11px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                            onClick={() => onDownload(member.id, `${member.firstName} ${member.lastName}`)}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                        </Button>
                        <Button
                            className="h-9 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg font-medium text-[10px] uppercase tracking-tight shadow-sm transition-all active:scale-95"
                            onClick={() => onBulkUpload?.(member)}
                        >
                            <Upload className="h-3.5 w-3.5 mr-1.5" /> Bulk Upload
                        </Button>
                        {member.status === 'onBoard' ? (
                            <Button
                                className="h-9 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 rounded-lg font-medium text-[10px] uppercase tracking-tight shadow-sm transition-all active:scale-95"
                                onClick={() => onSignOff?.(member)}
                            >
                                <LogOut className="h-3.5 w-3.5 mr-1.5 rotate-180" /> Sign Off
                            </Button>
                        ) : (
                            <Button
                                className="h-9 bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7] hover:bg-[#DCFCE7] rounded-lg font-medium text-[10px] uppercase tracking-tight shadow-sm transition-all active:scale-95"
                                onClick={() => onSignOn?.(member)}
                            >
                                <LogIn className="h-3.5 w-3.5 mr-1.5" /> Sign On
                            </Button>
                        )}
                        {member.status === 'onShore' && onDelete && (
                            <Button
                                className="col-span-3 mt-1 h-9 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg font-medium text-[12px] uppercase tracking-tight shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                                onClick={() => onDelete(member)}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete Crew Member
                            </Button>
                        )}
                    </div>
                </div>

                <div className="lg:w-[52%] p-5 bg-white">
                    <div className="flex flex-col">
                        <div className="mb-4">
                            <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-1">Documents</h4>
                            <div className="flex items-center gap-1.5 text-[10px] font-normal">
                                <span className="text-slate-400">{docStatuses.length} Docs</span>
                                <span className="text-slate-200">•</span>
                                <span className="text-[#10B981]">{validCount} Valid</span>
                                <span className="text-slate-200">•</span>
                                <span className="text-[#F59E0B]">{expiringCount} Expiring</span>
                                <span className="text-slate-200">•</span>
                                <span className="text-[#EF4444]">{expiredCount} Expired</span>
                                <span className="text-slate-200">•</span>
                                <span className="text-[#EF4444]">{pendingCount} Pending</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            {docStatuses.map((doc) => {
                                const isInvalid = doc.status === 'missing' || (doc.status === 'expired' && !doc.filePath);
                                return (
                                    <div key={doc.type} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            {doc.status === 'na' ? (
                                                <div className="w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                                                    <span className="text-slate-300 text-[10px] font-bold">-</span>
                                                </div>
                                            ) : isInvalid ? (
                                                <div className="w-4 h-4 rounded-full bg-white border-2 border-[#EF4444] flex items-center justify-center">
                                                    <span className="text-[#EF4444] text-[8px] font-black">!</span>
                                                </div>
                                            ) : (
                                                <div className="w-4 h-4 rounded-full bg-white border-2 border-[#10B981] flex items-center justify-center">
                                                    <Check className="h-2.5 w-2.5 text-[#10B981] stroke-[4]" />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[13px] font-semibold text-slate-700 uppercase tracking-tight ${doc.status === 'na' ? 'line-through opacity-50' : ''}`}>
                                                    {getDocTypeLabel(doc.type)}
                                                </span>
                                                {doc.isNoFile && doc.status !== 'na' && doc.status !== 'missing' && (
                                                    <AlertTriangle className="h-3 w-3 text-orange-500" title="Data exists but no file uploaded" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {doc.status === 'na' && (
                                                <span className="text-slate-400 text-[10px] font-bold bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">N/A</span>
                                            )}
                                            {doc.status === 'missing' && (
                                                <span className="text-[#EF4444] text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">PENDING</span>
                                            )}
                                            {doc.status === 'expired' && (
                                                <span className="text-[#EF4444] text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">EXPIRED</span>
                                            )}
                                            {doc.status === 'expiring' && (
                                                <span className="text-[#F59E0B] text-[10px] font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">EXPIRING</span>
                                            )}

                                            {isInvalid && doc.status !== 'na' ? (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-3 bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] rounded-lg font-bold text-[11px] transition-all active:scale-95"
                                                        onClick={() => onUpload?.(member, doc.type)}
                                                    >
                                                        <Upload className="h-3 w-3 mr-1.5" />
                                                        Upload
                                                    </Button>
                                                    {doc.type === 'coe-extension' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-[11px] transition-all active:scale-95"
                                                            onClick={() => onToggleNA?.(member, doc.type, true)}
                                                        >
                                                            N/A
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (doc.isContract || doc.isNoFile) && doc.status !== 'na' ? (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-3 bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] rounded-lg font-bold text-[11px] transition-all active:scale-95"
                                                        onClick={() => onUpload?.(member, doc.type)}
                                                    >
                                                        <Upload className="h-3 w-3 mr-1.5" />
                                                        Upload
                                                    </Button>
                                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            onClick={() => handleDocClick(doc)}
                                                            disabled={loadingViewDocId === doc.docId || doc.isNoFile}
                                                        >
                                                            {loadingViewDocId === doc.docId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            onClick={() => {
                                                                const message = doc.isContract 
                                                                    ? `This AOA is inherited from the contract. Do you want to unlink it?`
                                                                    : undefined;
                                                                onDeleteDocument?.(doc.docId!, doc.type, message);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    {doc.status !== 'na' && (
                                                        <>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                onClick={() => handleDocClick(doc)}
                                                                disabled={loadingViewDocId === doc.docId}
                                                            >
                                                                {loadingViewDocId === doc.docId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                onClick={() => handleDocDownload(doc)}
                                                                disabled={loadingDownloadDocId === doc.docId || doc.isNoFile}
                                                            >
                                                                {loadingDownloadDocId === doc.docId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                onClick={() => onSendMail(member)}
                                                            >
                                                                <Mail className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className={`h-8 w-8 rounded-lg transition-colors ${doc.status === 'na' ? 'text-slate-300 hover:text-blue-600 hover:bg-blue-50' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                                                        onClick={() => {
                                                            if (doc.status === 'na') {
                                                                onToggleNA?.(member, doc.type, false);
                                                                return;
                                                            }
                                                            
                                                            const message = (doc as any).isContract 
                                                                ? `This AOA is inherited from the contract. Do you want to unlink it and upload a separate AOA document instead?`
                                                                : undefined;
                                                                
                                                            onDeleteDocument?.(doc.docId!, doc.type, message);
                                                        }}
                                                    >
                                                        {doc.status === 'na' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
});

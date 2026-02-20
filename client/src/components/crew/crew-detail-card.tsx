
import React from 'react';
import { CrewAvatar } from './crew-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Eye, Edit, History, LogOut, LogIn,
    FileText, Download, Upload, Mail, ChevronDown, Trash2,
    CheckCircle2, AlertCircle, UserCog, Check, FileDown
} from 'lucide-react';
import { CrewMemberWithDetails, Document } from '@shared/schema';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

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
    onDeleteDocument?: (docId: string, type: string) => void;
    onSignOn?: (member: CrewMemberWithDetails) => void;
    onSignOff?: (member: CrewMemberWithDetails) => void;
    onUpload?: (member: CrewMemberWithDetails, type: string) => void;
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
    isMailPending
}) => {
    const { toast } = useToast();
    const now = React.useMemo(() => new Date(), []);

    const contractStats = React.useMemo(() => {
        const startDate = member.activeContract?.startDate ? new Date(member.activeContract.startDate) : null;
        const endDate = member.activeContract?.endDate ? new Date(member.activeContract.endDate) : null;

        let remainingDays = 0;
        let totalDays = 0;
        let progressPercent = 0;

        if (startDate && endDate && member.activeContract?.status === 'active' && member.status !== 'onShore') {
            totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
            remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            progressPercent = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;
        }

        return { startDate, endDate, remainingDays, totalDays, progressPercent };
    }, [member.activeContract, member.status, now]);

    const { startDate, endDate, progressPercent } = contractStats;

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
            'coe-extension': 'COE-Extension'
        };
        return labels[type] || type.toUpperCase();
    }, []);

    const docStatuses = React.useMemo(() => {
        const TRACKED_DOC_TYPES = ['medical', 'cdc', 'coc', 'aoa', 'photo', 'nok', 'passport', 'coe', 'coe-extension'] as const;
        const crewDocs = documents.filter(doc => doc.crewMemberId === member.id);

        return TRACKED_DOC_TYPES.map(type => {
            let doc = crewDocs.find(d => {
                const docType = d.type.toLowerCase();
                const searchType = type.toLowerCase();
                const isMatch = searchType === 'coc' ? (docType === 'coc' || docType === 'stcw') : (docType === searchType);
                return isMatch && d.filePath;
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
                    return { type, status, expiryDate, daysUntil, docId: contract.id, filePath: contract.filePath, isContract: true };
                }
            }

            if (!doc) return { type, status: 'missing' as const, expiryDate: null, daysUntil: null, docId: null, filePath: null, isTbd: false };

            // Bypass expiry logic for COE and COE-Extension
            if (type === 'coe' || type === 'coe-extension') {
                return { type, status: 'valid' as const, expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null, daysUntil: null, docId: doc.id, filePath: doc.filePath, isTbd: doc.expiryDate === null };
            }

            const expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
            const isTbd = doc.expiryDate === null;
            const daysUntil = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

            let status: any = 'valid';
            if (expiryDate) {
                const threshold = type === 'aoa' ? 30 : 60;
                if (daysUntil !== null && daysUntil < 0) status = 'expired';
                else if (daysUntil !== null && daysUntil <= threshold) status = 'expiring';
            }

            return { type, status, expiryDate, daysUntil, docId: doc.id, filePath: doc.filePath, isTbd };
        });
    }, [member.id, member.activeContract, documents, now]);

    const stats = React.useMemo(() => {
        // Only count compliance documents for Valid/Expiring/Expired
        const complianceDocs = docStatuses.filter(d => d.type !== 'photo' && d.type !== 'nok');

        const validCount = complianceDocs.filter(d => d.status === 'valid').length;
        const expiringCount = complianceDocs.filter(d => d.status === 'expiring').length;
        const expiredCount = complianceDocs.filter(d => d.status === 'expired').length;
        const pendingCount = docStatuses.filter(d => d.status === 'missing').length;

        return { validCount, expiringCount, expiredCount, pendingCount };
    }, [docStatuses]);

    const { validCount, expiringCount, expiredCount, pendingCount } = stats;

    const handleDocClick = React.useCallback(async (doc: any) => {
        if (!doc.filePath || !doc.docId) {
            toast({ title: 'Not Available', description: 'No document file has been uploaded for this type.' });
            return;
        }
        try {
            const endpoint = doc.isContract ? `/api/contracts/${doc.docId}/view` : `/api/documents/${doc.docId}/view`;
            const response = await fetch(endpoint, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch document');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to open document', variant: 'destructive' });
        }
    }, [toast]);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {/* Left Column: Identity & Info */}
                <div className="lg:w-[48%] p-3">
                    {/* Header Identity Section */}
                    <div className="flex items-start justify-between mb-4">
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
                                <h3 className="text-sm font-extrabold text-[#1E293B] leading-tight uppercase tracking-tight">
                                    {member.firstName} {member.lastName}
                                </h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                    {member.nationality || 'INDIAN'}
                                </p>
                            </div>
                        </div>
                        <Badge className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border-0 ${member.status === 'onBoard'
                            ? 'bg-blue-500 text-white'
                            : 'bg-[#10B981] text-white'
                            }`}>
                            {member.status === 'onBoard' ? 'On Board' : 'On Shore'}
                        </Badge>
                    </div>

                    {/* Rank & Vessel Boxes */}
                    <div className="grid grid-cols-2 gap-2 mb-1.5">
                        <div className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-sm">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Rank</p>
                            <p className="text-[#1E293B] font-bold text-sm">{member.rank}</p>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-sm">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Vessel</p>
                            <p className="text-[#1E293B] font-extrabold text-base">{member.currentVessel?.name || 'Not assigned'}</p>
                        </div>
                    </div>

                    {/* Timeline & Contract Section */}
                    <div className="mb-4">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[11px] font-bold text-slate-500">
                                {formatShortDate(startDate)} – {formatShortDate(endDate)}
                            </span>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400">
                                    {formatShortDate(endDate, 'MMM d')}
                                </span>
                                {contractStats.remainingDays > 0 && (
                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-1 rounded">
                                        {contractStats.remainingDays} Days Left
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden mb-2 relative">
                            {/* Visual Progress Indication */}
                            <div className="absolute top-0 left-0 bottom-0 bg-[#3B82F6] w-3/4 rounded-full" />
                        </div>

                        <div className="pt-1.5 border-t border-slate-100">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">Contract</p>
                            <div className="flex items-center gap-1.5">
                                <FileText className="h-2.5 w-2.5 text-slate-400" />
                                <span className="text-[11px] font-bold text-slate-700">
                                    {formatShortDate(startDate)} – {formatShortDate(endDate)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Grid */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                        <Button
                            variant="outline"
                            className="h-7.5 border-slate-200 rounded-lg text-slate-600 font-bold text-[10px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm"
                            onClick={() => onView(member)}
                        >
                            <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                        <Button
                            variant="outline"
                            className="h-7.5 border-slate-200 rounded-lg text-slate-600 font-bold text-[10px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm"
                            onClick={() => onEdit(member)}
                        >
                            <UserCog className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                            variant="outline"
                            className="h-7.5 border-slate-200 rounded-lg text-slate-600 font-bold text-[10px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm"
                            onClick={() => onVesselHistory(member)}
                        >
                            <History className="h-3 w-3 mr-1" /> History
                        </Button>
                        <Button
                            variant="outline"
                            className="h-7.5 border-slate-200 rounded-lg text-slate-600 font-bold text-[10px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm"
                            onClick={() => onSendMail(member)}
                            disabled={isMailPending}
                        >
                            <Mail className="h-3 w-3 mr-1" /> Mail
                        </Button>
                        <Button
                            variant="outline"
                            className="h-7.5 border-slate-200 rounded-lg text-slate-600 font-bold text-[10px] uppercase tracking-tight bg-white hover:bg-slate-50 shadow-sm"
                            onClick={() => onDownload(member.id, `${member.firstName} ${member.lastName}`)}
                        >
                            <Download className="h-3 w-3 mr-1" /> Download
                        </Button>
                        {member.status === 'onBoard' ? (
                            <Button
                                className="h-7.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 rounded-lg font-bold text-[9px] uppercase tracking-tight shadow-sm"
                                onClick={() => onSignOff?.(member)}
                            >
                                <LogOut className="h-3 w-3 mr-1 rotate-180" /> Sign Off
                            </Button>
                        ) : (
                            <Button
                                className="h-7.5 bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7] hover:bg-[#DCFCE7] rounded-lg font-bold text-[9px] uppercase tracking-tight shadow-sm"
                                onClick={() => onSignOn?.(member)}
                            >
                                <LogIn className="h-3 w-3 mr-1" /> Sign On
                            </Button>
                        )}
                    </div>
                </div>

                <div className="lg:w-[52%] p-3 bg-white">
                    <div className="flex flex-col h-full">
                        <div className="mb-1.5">
                            <h4 className="text-base font-bold text-slate-900 uppercase tracking-tight mb-0.5">Documents</h4>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold">
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

                        <div className="flex-1 space-y-0.5">
                            {docStatuses.map((doc) => {
                                const isInvalid = doc.status === 'missing' || doc.status === 'expired';
                                return (
                                    <div key={doc.type} className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-4">
                                            {isInvalid ? (
                                                <div className="w-3.5 h-3.5 rounded-full bg-white border border-[#EF4444] flex items-center justify-center">
                                                    <span className="text-[#EF4444] text-[7px] font-black">!</span>
                                                </div>
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded-full bg-white border border-[#10B981] flex items-center justify-center">
                                                    <Check className="h-2 w-2 text-[#10B981] stroke-[4]" />
                                                </div>
                                            )}
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                                                {getDocTypeLabel(doc.type)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {doc.status === 'missing' && (
                                                <span className="text-[#EF4444] text-[9px] font-bold bg-red-50 px-1 py-0.5 rounded mr-1">PENDING</span>
                                            )}
                                            {doc.status === 'expired' && (
                                                <span className="text-[#EF4444] text-[9px] font-bold bg-red-50 px-1 py-0.5 rounded mr-1">EXPIRED</span>
                                            )}
                                            {doc.status === 'expiring' && (
                                                <span className="text-[#F59E0B] text-[9px] font-bold bg-orange-50 px-1 py-0.5 rounded mr-1">EXPIRING</span>
                                            )}

                                            {isInvalid ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2.5 bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] rounded-lg font-bold text-[10px] transition-colors"
                                                    onClick={() => onUpload?.(member, doc.type)}
                                                >
                                                    <Upload className="h-2.5 w-2.5 mr-1" />
                                                    Upload
                                                </Button>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"
                                                        onClick={() => handleDocClick(doc)}
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"
                                                        onClick={() => onDownload(doc.docId!, doc.type)}
                                                    >
                                                        <FileDown className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"
                                                        onClick={() => onSendMail(member)}
                                                    >
                                                        <Mail className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                        onClick={() => onDeleteDocument?.(doc.docId!, doc.type)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
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

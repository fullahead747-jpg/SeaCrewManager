
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Eye, Edit, History, LogOut, LogIn,
    FileText, Download, Upload, Mail, ChevronDown,
    CheckCircle2, AlertCircle, HelpCircle
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
    onSignOn?: (member: CrewMemberWithDetails) => void;
    onSignOff?: (member: CrewMemberWithDetails) => void;
    onUpload?: (member: CrewMemberWithDetails, type: string) => void;
    isMailPending?: boolean;
}

export const CrewDetailCard: React.FC<CrewDetailCardProps> = ({
    member,
    documents,
    onView,
    onEdit,
    onVesselHistory,
    onSendMail,
    onDownload,
    onViewAOA,
    onDelete,
    onSignOn,
    onSignOff,
    onUpload,
    isMailPending
}) => {
    const { toast } = useToast();
    const startDate = member.activeContract?.startDate ? new Date(member.activeContract.startDate) : null;
    const endDate = member.activeContract?.endDate ? new Date(member.activeContract.endDate) : null;
    const now = new Date();

    let remainingDays = 0;
    let totalDays = 0;
    let progressPercent = 0;

    if (startDate && endDate && member.activeContract?.status === 'active' && member.status !== 'onShore') {
        totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        progressPercent = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;
    }

    const formatShortDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getInitials = (firstName?: string | null, lastName?: string | null) => {
        const first = firstName?.charAt(0) || '';
        const last = lastName?.charAt(0) || '';
        return (first + last).toUpperCase() || '?';
    };

    const getDocTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            passport: 'Passport', cdc: 'CDC', coc: 'COC', medical: 'Medical', aoa: 'AOA', photo: 'Photo', nok: 'NOK'
        };
        return labels[type] || type.toUpperCase();
    };

    const getCrewDocumentExpiry = (member: any) => {
        const TRACKED_DOC_TYPES = ['medical', 'cdc', 'coc', 'aoa', 'photo', 'nok', 'passport'] as const;
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
                    if (daysUntil !== null && daysUntil < 0) status = 'expired';
                    else if (daysUntil !== null && daysUntil <= 30) status = 'expiring';
                    return { type, status, expiryDate, daysUntil, docId: contract.id, filePath: contract.filePath, isContract: true };
                }
            }

            if (!doc) return { type, status: 'missing' as const, expiryDate: null, daysUntil: null, docId: null, filePath: null };

            const expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
            const daysUntil = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

            let status: any = 'valid';
            if (expiryDate) {
                if (daysUntil !== null && daysUntil < 0) status = 'expired';
                else if (daysUntil !== null && daysUntil <= 30) status = 'expiring';
            }

            return { type, status, expiryDate, daysUntil, docId: doc.id, filePath: doc.filePath };
        });
    };

    const docStatuses = getCrewDocumentExpiry(member);
    const validCount = docStatuses.filter(d => d.status === 'valid').length;
    const expiringCount = docStatuses.filter(d => d.status === 'expiring').length;
    const expiredCount = docStatuses.filter(d => d.status === 'expired' || d.status === 'missing').length;

    const handleDocClick = async (doc: any) => {
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
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[400px]">
            {/* Left Pane - Profile Information */}
            <div className="flex-1 p-6 border-r border-slate-100 bg-[#FAFAFA]">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-lg font-bold">
                                {getInitials(member.firstName, member.lastName)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 tracking-tight leading-none mb-1">
                                {member.firstName} {member.lastName}
                            </h3>
                            <p className="text-slate-400 font-medium text-xs">{member.nationality || 'Nationality'}</p>
                        </div>
                    </div>
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                        {member.status === 'onBoard' ? 'On Board' : 'On Shore'}
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Rank</span>
                        <p className="text-[13px] font-semibold text-slate-700">{member.rank}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Vessel</span>
                        <p className="text-[13px] font-semibold text-slate-700">{member.currentVessel?.name || 'Not assigned'}</p>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between items-center text-[11px] font-semibold mb-2">
                        <span className="text-slate-500">{formatShortDate(startDate)} – {formatShortDate(endDate)}</span>
                        <span className="text-slate-400">{formatShortDate(endDate)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div
                            className="bg-sky-500 h-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contract</span>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                            <FileText className="h-3 w-3" />
                            <span>{formatShortDate(startDate)} – {formatShortDate(endDate)}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-100">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8 text-[11px] font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 px-2"
                        onClick={() => onView(member)}
                    >
                        <Eye className="h-3 w-3 mr-1.5" /> View Profile
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8 text-[11px] font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 px-2"
                        onClick={() => onEdit(member)}
                    >
                        <Edit className="h-3 w-3 mr-1.5" /> Edit Profile
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-8 text-[11px] font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 px-2 font-inter"
                        onClick={() => onVesselHistory(member)}
                    >
                        <History className="h-3 w-3 mr-1.5" /> History
                    </Button>
                    {member.status === 'onBoard' ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-8 text-[11px] font-semibold text-red-600 border-red-100 hover:bg-red-50 px-2"
                            onClick={() => onSignOff?.(member)}
                        >
                            <LogOut className="h-3 w-3 mr-1.5 rotate-180" /> Sign Off
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-8 text-[11px] font-semibold text-emerald-600 border-emerald-100 hover:bg-emerald-50 px-2"
                            onClick={() => onSignOn?.(member)}
                        >
                            <LogIn className="h-3 w-3 mr-1.5" /> Sign On
                        </Button>
                    )}
                </div>
            </div>

            {/* Right Pane - Document Intelligence */}
            <div className="flex-1 p-6 bg-white">
                <div className="mb-4">
                    <h4 className="text-base font-bold text-slate-800 mb-0.5">Document Intelligence</h4>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span className="text-slate-400">{docStatuses.length} Docs</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-emerald-500 font-bold">{validCount} Valid</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-amber-500 font-bold">{expiringCount} Expiring</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-rose-500 font-bold">{expiredCount} Expired</span>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {docStatuses.map((doc) => (
                        <div key={doc.type} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                {doc.status === 'valid' ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : doc.status === 'expiring' ? (
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-rose-500" />
                                )}
                                <span className="text-xs font-semibold text-slate-700">{getDocTypeLabel(doc.type)}</span>
                            </div>

                            <div className="flex items-center bg-slate-50/30 rounded-lg p-0.5">
                                {doc.status === 'missing' || !doc.filePath ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2.5 bg-blue-50/50 border border-blue-100/50 rounded-md"
                                        onClick={() => onUpload?.(member, doc.type)}
                                    >
                                        <Upload className="h-2.5 w-2.5 mr-1" /> Upload Document
                                    </Button>
                                ) : (
                                    <>
                                        {doc.status === 'expiring' && (
                                            <span className="text-[10px] font-bold text-amber-500 px-2">Expiring</span>
                                        )}
                                        <div className="flex items-center divide-x divide-slate-200">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-14 text-[10px] text-slate-600 hover:text-slate-900 border border-slate-200 bg-white shadow-sm rounded-l-md"
                                                onClick={() => handleDocClick(doc)}
                                            >
                                                <Eye className="h-3 w-3 mr-0.5" /> View
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-1.5 text-slate-500 hover:text-slate-800 border-y border-slate-200 bg-white shadow-sm"
                                                onClick={() => onDownload(doc.docId!, doc.type)}
                                            >
                                                <Download className="h-3 w-3" />
                                            </Button>
                                            {doc.type === 'nok' ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 bg-white shadow-sm rounded-r-md"
                                                        >
                                                            <Mail className="h-3 w-3 mr-0.5" />
                                                            <ChevronDown className="h-2.5 w-2.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuItem onClick={() => onSendMail(member)} className="text-[11px] font-medium cursor-pointer">
                                                            Email Emergency Contact
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-[11px] font-medium cursor-pointer">
                                                            Email Agency
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 bg-white shadow-sm rounded-r-md"
                                                    onClick={() => onSendMail(member)}
                                                >
                                                    <Mail className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

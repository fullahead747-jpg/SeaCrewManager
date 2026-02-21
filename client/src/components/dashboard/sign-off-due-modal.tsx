import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Ship, Users, X, Search, Eye, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { getAuthHeaders } from '@/lib/auth';
import { CrewMemberWithDetails, Document, Vessel } from '@shared/schema';
import { CrewDetailCard } from '@/components/crew/crew-detail-card';
import { CrewAvatar } from "@/components/crew/crew-avatar";
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import DocumentUpload from '@/components/documents/document-upload';
import EditCrewForm from '@/components/crew/edit-crew-form';
import SignOnWizardDialog from '@/components/crew/sign-on-wizard-dialog';

interface SignOffDueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface VesselGroup {
    vessel: Vessel;
    members: CrewMemberWithDetails[];
}

export default function SignOffDueModal({ isOpen, onClose }: SignOffDueModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearch = useDeferredValue(searchTerm);

    // Upload state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedCrewForUpload, setSelectedCrewForUpload] = useState<CrewMemberWithDetails | null>(null);
    const [selectedUploadType, setSelectedUploadType] = useState<string | undefined>(undefined);

    // View state
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMemberWithDetails | null>(null);

    // History state
    const [showVesselHistoryDialog, setShowVesselHistoryDialog] = useState(false);
    const [selectedCrewForHistory, setSelectedCrewForHistory] = useState<CrewMemberWithDetails | null>(null);

    // Edit state
    const [showEditDialog, setShowEditDialog] = useState(false);

    // Sign Off state
    const [signOffDialogOpen, setSignOffDialogOpen] = useState(false);
    const [selectedCrewForSignOff, setSelectedCrewForSignOff] = useState<CrewMemberWithDetails | null>(null);
    const [signOffReason, setSignOffReason] = useState('');

    // Sign On state
    const [signOnDialogOpen, setSignOnDialogOpen] = useState(false);
    const [selectedCrewForSignOn, setSelectedCrewForSignOn] = useState<CrewMemberWithDetails | null>(null);

    // Delete Crew state
    const [deleteCrewDialogOpen, setDeleteCrewDialogOpen] = useState(false);
    const [selectedCrewForDelete, setSelectedCrewForDelete] = useState<CrewMemberWithDetails | null>(null);

    // Incremental rendering state
    const [displayCount, setDisplayCount] = useState(10);
    const BATCH_SIZE = 10;

    useEffect(() => {
        setDisplayCount(BATCH_SIZE);
    }, [deferredSearch]);

    // ── Data fetching ──────────────────────────────────────────────────────────
    const { data: crewMembers = [], isLoading: crewLoading } = useQuery<CrewMemberWithDetails[]>({
        queryKey: ['/api/crew'],
        queryFn: async () => {
            const res = await fetch('/api/crew', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch crew');
            return res.json();
        },
        enabled: isOpen,
    });

    const { data: vessels = [], isLoading: vesselsLoading } = useQuery<Vessel[]>({
        queryKey: ['/api/vessels'],
        queryFn: async () => {
            const res = await fetch('/api/vessels', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch vessels');
            return res.json();
        },
        enabled: isOpen,
    });

    const { data: documents = [] } = useQuery<Document[]>({
        queryKey: ['/api/documents'],
        queryFn: async () => {
            const res = await fetch('/api/documents', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch documents');
            return res.json();
        },
        enabled: isOpen,
    });

    // ── Mutations ──────────────────────────────────────────────────────────────
    const sendCrewEmailMutation = useMutation({
        mutationFn: async (member: CrewMemberWithDetails) => {
            const res = await fetch('/api/email/send-crew-details', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ crewMemberId: member.id }),
            });
            if (!res.ok) throw new Error('Failed to send email');
            return res.json();
        },
        onSuccess: () => toast({ title: 'Email Sent', description: 'Crew update email sent successfully.' }),
        onError: (err: any) => toast({ title: 'Email Failed', description: err.message, variant: 'destructive' }),
    });

    const signOffMutation = useMutation({
        mutationFn: async ({ crewId, reason }: { crewId: string; reason: string }) => {
            const member = crewMembers.find((m) => m.id === crewId);
            const res = await fetch(`/api/crew/${crewId}`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentVesselId: null,
                    lastVesselId: member?.currentVesselId || null,
                    status: 'onShore',
                    signOffDate: new Date().toISOString(),
                    statusChangeReason: reason,
                }),
            });
            if (!res.ok) throw new Error('Failed to sign off crew member');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            setSignOffDialogOpen(false);
            setSelectedCrewForSignOff(null);
            toast({ title: 'Success', description: 'Crew member signed off successfully' });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    const signOnMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!selectedCrewForSignOn) throw new Error('No crew member selected');
            // Update crew status to onBoard
            const crewRes = await fetch(`/api/crew/${selectedCrewForSignOn.id}`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentVesselId: data.vesselId,
                    status: 'onBoard',
                    statusChangeReason: data.reason,
                    ...(data.profileUpdates || {}),
                }),
            });
            if (!crewRes.ok) throw new Error('Failed to update crew status');

            // Create new contract
            const durationDays = Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24));
            const contractRes = await fetch('/api/contracts', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crewMemberId: selectedCrewForSignOn.id,
                    vesselId: data.vesselId,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    durationDays: durationDays,
                    status: 'active',
                    reason: data.reason,
                }),
            });
            if (!contractRes.ok) throw new Error('Failed to create contract');
            return contractRes.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
            queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            setSignOnDialogOpen(false);
            setSelectedCrewForSignOn(null);
            toast({ title: 'Success', description: 'Crew member signed on successfully' });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });


    const deleteDocumentMutation = useMutation({
        mutationFn: async (documentId: string) => {
            const res = await fetch(`/api/documents/${documentId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to delete document');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            toast({ title: 'Success', description: 'Document deleted successfully' });
        },
        onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    const deleteCrewMutation = useMutation({
        mutationFn: async (crewId: string) => {
            const res = await fetch(`/api/crew/${crewId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Failed to delete crew member');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
            setDeleteCrewDialogOpen(false);
            setSelectedCrewForDelete(null);
            toast({ title: 'Crew Member Deleted', description: 'The crew member has been permanently removed.' });
        },
        onError: (err: any) => toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' }),
    });

    const handleDeleteCrewClick = (member: CrewMemberWithDetails) => {
        setSelectedCrewForDelete(member);
        setDeleteCrewDialogOpen(true);
    };

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleUpload = (member: CrewMemberWithDetails, type: string) => {
        setSelectedCrewForUpload(member);
        setSelectedUploadType(type);
        setIsUploadModalOpen(true);
    };

    const handleDownload = async (crewId: string, crewName: string) => {
        try {
            const res = await fetch(`/api/crew/${crewId}/documents/download`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = `Documents_${crewName.replace(/\s+/g, '_')}.zip`;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            toast({ title: 'Download Failed', description: 'Could not download documents zip.', variant: 'destructive' });
        }
    };

    const handleViewAOA = async (m: CrewMemberWithDetails) => {
        if (m.activeContract?.filePath) {
            try {
                const res = await fetch(`/api/contracts/${m.activeContract.id}/view`, { headers: getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to fetch document');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => window.URL.revokeObjectURL(url), 100);
            } catch {
                toast({ title: 'Error', description: 'Failed to open AOA document', variant: 'destructive' });
            }
        } else {
            toast({ title: 'Not Available', description: 'No AOA document file found for this contract.' });
        }
    };

    const handleDeleteDocument = (docId: string, type: string) => {
        if (window.confirm(`Are you sure you want to delete this ${type.toUpperCase()} document?`)) {
            deleteDocumentMutation.mutate(docId);
        }
    };

    const { data: rotations = [] } = useQuery({
        queryKey: ['/api/rotations'],
        queryFn: async () => {
            const res = await fetch('/api/rotations', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch rotations');
            return res.json();
        },
        enabled: isOpen,
    });

    const getVesselHistory = (crewMemberId: string) => {
        return rotations
            .filter((r: any) => r.crewMemberId === crewMemberId && r.status === 'completed')
            .sort((a: any, b: any) => new Date(b.leaveDate).getTime() - new Date(a.leaveDate).getTime());
    };

    // ── Vessel groups (crew expiring within 45 days) ───────────────────────────
    const vesselGroups: VesselGroup[] = useMemo(() => {
        if (!crewMembers.length || !vessels.length) return [];

        const now = new Date();
        const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const expiring = crewMembers.filter((m) => {
            if (!m.activeContract) return false;
            const end = new Date(m.activeContract.endDate);
            return end > now && end <= cutoff;
        });

        const map = new Map<string, CrewMemberWithDetails[]>();
        expiring.forEach((m) => {
            const vid = m.currentVesselId;
            if (!vid) return;
            if (!map.has(vid)) map.set(vid, []);
            map.get(vid)!.push(m);
        });

        const groups: VesselGroup[] = [];
        vessels.forEach((vessel) => {
            const members = map.get(vessel.id);
            if (members?.length) {
                members.sort((a, b) =>
                    new Date(a.activeContract!.endDate).getTime() - new Date(b.activeContract!.endDate).getTime()
                );
                groups.push({ vessel, members });
            }
        });

        return groups.sort((a, b) => b.members.length - a.members.length);
    }, [crewMembers, vessels]);

    // ── Search filter ──────────────────────────────────────────────────────────
    const filteredGroups = useMemo(() => {
        if (!deferredSearch.trim()) return vesselGroups;
        const s = deferredSearch.toLowerCase();
        return vesselGroups
            .map((g) => {
                const vesselMatch = g.vessel.name.toLowerCase().includes(s);
                return {
                    ...g,
                    members: g.members.filter((m) => {
                        const full = `${m.firstName} ${m.lastName}`.toLowerCase();
                        return (
                            vesselMatch ||
                            m.firstName.toLowerCase().includes(s) ||
                            m.lastName.toLowerCase().includes(s) ||
                            m.rank.toLowerCase().includes(s) ||
                            full.includes(s)
                        );
                    }),
                };
            })
            .filter((g) => g.members.length > 0);
    }, [vesselGroups, deferredSearch]);

    const totalContracts = vesselGroups.reduce((sum, g) => sum + g.members.length, 0);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    className="max-w-5xl w-full max-h-[90vh] border-slate-200 p-0 overflow-y-auto bg-white shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-[2rem] custom-scrollbar"
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
                            const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.members.length, 0);
                            if (displayCount < totalFiltered) {
                                setDisplayCount(prev => prev + BATCH_SIZE);
                            }
                        }
                    }}
                >
                    <div className="p-3 space-y-2">
                        {/* ── Header ── */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:pr-8 mb-6">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 bg-blue-50 rounded-lg">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <h2 className="text-xl font-bold tracking-tight text-[#1E293B]">Sign Off Due Contracts</h2>
                                        <span className="text-slate-300">|</span>
                                        <p className="text-slate-400 text-xs font-semibold">
                                            {totalContracts} {totalContracts === 1 ? 'contract' : 'contracts'} expiring within 30 days
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="relative w-full md:w-[240px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search crew members / vessels..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-8 bg-[#F1F5F9] border-0 focus:ring-1 focus:ring-blue-500/20 h-8 rounded-lg text-sm placeholder:text-slate-400 border-transparent shadow-none"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Content ── */}
                        <div className="space-y-2">
                            {crewLoading || vesselsLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 opacity-60" />
                                </div>
                            ) : vesselGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-slate-500 font-bold text-xs">No critical data found.</p>
                                </div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-slate-500 font-bold text-xs">No matches found.</p>
                                </div>
                            ) : (
                                filteredGroups.map(({ vessel, members }) => (
                                    <div key={vessel.id} className="space-y-1.5">
                                        {/* Vessel header */}
                                        <div className="flex items-center gap-2">
                                            <Ship className="h-3.5 w-3.5 text-blue-500" />
                                            <span className="text-slate-700 font-extrabold text-sm uppercase tracking-wide">{vessel.name}</span>
                                            <Badge className="bg-blue-50 text-blue-600 text-[9px] border-blue-100 font-bold rounded px-1.5 py-0">
                                                {members.length} {members.length === 1 ? 'Contract' : 'Contracts'}
                                            </Badge>
                                            <div className="flex-1 h-px bg-slate-100" />
                                        </div>

                                        {/* Crew Detail Cards */}
                                        <div className="space-y-2">
                                            <AnimatePresence mode="popLayout">
                                                {members.slice(0, displayCount).map((member) => (
                                                    <motion.div
                                                        key={member.id}
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.98 }}
                                                        transition={{ duration: 0.15 }}
                                                    >
                                                        <CrewDetailCard
                                                            member={member}
                                                            documents={documents}
                                                            onView={(m) => { setSelectedCrewMember(m); setShowViewDialog(true); }}
                                                            onEdit={(m) => { setSelectedCrewMember(m); setShowEditDialog(true); }}
                                                            onVesselHistory={(m) => { setSelectedCrewForHistory(m); setShowVesselHistoryDialog(true); }}
                                                            onSendMail={(m) => sendCrewEmailMutation.mutate(m)}
                                                            onDownload={handleDownload}
                                                            onViewAOA={handleViewAOA}
                                                            onSignOff={(m) => { setSelectedCrewForSignOff(m); setSignOffReason(''); setSignOffDialogOpen(true); }}
                                                            onSignOn={(m) => { setSelectedCrewForSignOn(m); setSignOnDialogOpen(true); }}
                                                            onUpload={handleUpload}
                                                            onDeleteDocument={handleDeleteDocument}
                                                            onDelete={handleDeleteCrewClick}
                                                            isMailPending={sendCrewEmailMutation.isPending}
                                                        />
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                ))
                            )}
                            {displayCount < filteredGroups.reduce((sum, g) => sum + g.members.length, 0) && (
                                <div className="flex justify-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500/30" />
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── View Crew Dialog ── */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2 text-2xl font-bold">
                            <Eye className="h-6 w-6 text-blue-600" />
                            <span>Seafarer Details</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCrewMember && (
                        <div className="space-y-4 py-3">
                            <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <CrewAvatar
                                    memberId={selectedCrewMember.id}
                                    documents={selectedCrewMember.documents}
                                    firstName={selectedCrewMember.firstName}
                                    lastName={selectedCrewMember.lastName}
                                    className="h-16 w-16 border border-white shadow-sm"
                                />
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {selectedCrewMember.firstName} {selectedCrewMember.lastName}
                                    </h2>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 font-bold px-2 py-0.5 text-[10px]">
                                            {selectedCrewMember.rank}
                                        </Badge>
                                        <span className="text-slate-400 text-xs font-medium">{selectedCrewMember.nationality}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <h4 className="font-bold text-slate-900 flex items-center mb-4 text-sm uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2.5"></div>
                                        Personal Info
                                    </h4>
                                    <div className="space-y-3 text-sm">
                                        <p className="flex justify-between"><span className="text-slate-500">Nationality:</span> <span className="font-bold">{selectedCrewMember.nationality}</span></p>
                                        <p className="flex justify-between"><span className="text-slate-500">Date of Birth:</span> <span className="font-bold">{formatDate(selectedCrewMember.dateOfBirth)}</span></p>
                                        <p className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="font-bold text-blue-600">{(selectedCrewMember as any).email || 'N/A'}</span></p>
                                        <p className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="font-bold">{selectedCrewMember.phoneNumber || 'N/A'}</span></p>
                                    </div>
                                </div>

                                <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <h4 className="font-bold text-slate-900 flex items-center mb-4 text-sm uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-2.5"></div>
                                        Active Assignment
                                    </h4>
                                    <div className="space-y-3 text-sm">
                                        <p className="flex justify-between items-center"><span className="text-slate-500">Vessel:</span> <span className="font-extrabold text-base text-blue-700">{vessels.find(v => v.id === selectedCrewMember.currentVesselId)?.name || 'Unassigned'}</span></p>
                                        <p className="flex justify-between"><span className="text-slate-500">Status:</span> <Badge variant="outline" className="font-bold capitalize">{selectedCrewMember.status}</Badge></p>
                                        {selectedCrewMember.activeContract && (
                                            <>
                                                <p className="flex justify-between"><span className="text-slate-500">Signed On:</span> <span className="font-bold">{formatDate(selectedCrewMember.activeContract.startDate)}</span></p>
                                                <p className="flex justify-between"><span className="text-slate-500">Ending:</span> <span className="font-bold text-orange-600">{formatDate(selectedCrewMember.activeContract.endDate)}</span></p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <Button className="rounded-xl px-8 font-bold" onClick={() => setShowViewDialog(false)}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Vessel History Dialog ── */}
            <Dialog open={showVesselHistoryDialog} onOpenChange={setShowVesselHistoryDialog}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2 text-2xl font-bold">
                            <Ship className="h-6 w-6 text-blue-600" />
                            <span>Vessel History</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCrewForHistory && (
                        <div className="space-y-4 pt-3">
                            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <CrewAvatar
                                    memberId={selectedCrewForHistory.id}
                                    documents={selectedCrewForHistory.documents}
                                    firstName={selectedCrewForHistory.firstName}
                                    lastName={selectedCrewForHistory.lastName}
                                    className="h-12 w-12"
                                />
                                <div>
                                    <h3 className="font-bold text-slate-900">{selectedCrewForHistory.firstName} {selectedCrewForHistory.lastName}</h3>
                                    <p className="text-slate-500 text-sm font-medium">{selectedCrewForHistory.rank}</p>
                                </div>
                            </div>

                            {(() => {
                                const history = getVesselHistory(selectedCrewForHistory.id);
                                return history.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <Ship className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                                        <p className="text-slate-500 font-bold">No completed vessel history found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{history.length} completed {history.length === 1 ? 'rotation' : 'rotations'}</p>
                                        <div className="space-y-3">
                                            {history.map((record: any, idx: number) => (
                                                <div key={idx} className="p-5 border border-slate-100 rounded-2xl hover:border-blue-100 hover:bg-blue-50/10 transition-all group">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <h4 className="font-bold text-slate-900 flex items-center">
                                                                <Ship className="h-4 w-4 mr-2 text-blue-500 opacity-50" />
                                                                {record.vessel.name}
                                                            </h4>
                                                            <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                                                                <span>{record.joinDate ? formatDate(record.joinDate) : 'N/A'}</span>
                                                                <span className="text-slate-300">→</span>
                                                                <span>{record.leaveDate ? formatDate(record.leaveDate) : 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 font-bold text-[10px] uppercase">{record.vessel.type}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                <Button variant="outline" className="rounded-xl px-8 font-bold" onClick={() => { setShowVesselHistoryDialog(false); setSelectedCrewForHistory(null); }}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Edit Crew Dialog ── */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
                    {selectedCrewMember && (
                        <EditCrewForm
                            crewMember={selectedCrewMember}
                            onSuccess={() => {
                                setShowEditDialog(false);
                                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Sign Off Confirmation ── */}
            <Dialog open={signOffDialogOpen} onOpenChange={setSignOffDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <div className="p-6 space-y-4">
                        <h3 className="text-xl font-bold text-slate-900">Confirm Sign Off</h3>
                        <p className="text-slate-500 text-sm">
                            Sign off{' '}
                            <span className="font-bold text-slate-700">
                                {selectedCrewForSignOff?.firstName} {selectedCrewForSignOff?.lastName}
                            </span>
                            ?
                        </p>
                        <textarea
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            rows={3}
                            placeholder="Reason for sign off (required)..."
                            value={signOffReason}
                            onChange={(e) => setSignOffReason(e.target.value)}
                        />
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => setSignOffDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-500 hover:bg-red-600 text-white"
                                disabled={!signOffReason.trim() || signOffMutation.isPending}
                                onClick={() => {
                                    if (selectedCrewForSignOff && signOffReason.trim()) {
                                        signOffMutation.mutate({ crewId: selectedCrewForSignOff.id, reason: signOffReason.trim() });
                                    }
                                }}
                            >
                                {signOffMutation.isPending ? 'Signing Off...' : 'Confirm Sign Off'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Sign On Wizard ── */}
            {
                selectedCrewForSignOn && (
                    <SignOnWizardDialog
                        open={signOnDialogOpen}
                        onOpenChange={(open) => {
                            setSignOnDialogOpen(open);
                            if (!open) setSelectedCrewForSignOn(null);
                        }}
                        crewMember={selectedCrewForSignOn}
                        vessels={vessels}
                        onSubmit={(data) => signOnMutation.mutate(data)}
                        isSubmitting={signOnMutation.isPending}
                    />
                )
            }

            {/* ── Document Upload ── */}
            <Dialog open={isUploadModalOpen} onOpenChange={(open) => {
                if (!open) { setIsUploadModalOpen(false); setSelectedCrewForUpload(null); setSelectedUploadType(undefined); }
            }}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
                    {selectedCrewForUpload && (
                        <DocumentUpload
                            crewMemberId={selectedCrewForUpload.id}
                            preselectedType={selectedUploadType}
                            onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                                setIsUploadModalOpen(false);
                                setSelectedCrewForUpload(null);
                                setSelectedUploadType(undefined);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Delete Crew Member Confirmation ── */}
            <Dialog open={deleteCrewDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteCrewDialogOpen(false); setSelectedCrewForDelete(null); } }}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" />
                            Delete Crew Member
                        </DialogTitle>
                        <DialogDescription>
                            {selectedCrewForDelete && (
                                <>
                                    You are about to permanently delete{' '}
                                    <span className="font-semibold text-slate-900">
                                        {selectedCrewForDelete.firstName} {selectedCrewForDelete.lastName}
                                    </span>.
                                    This will remove all their contracts, documents, and history. This action cannot be undone.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => { setDeleteCrewDialogOpen(false); setSelectedCrewForDelete(null); }}
                            disabled={deleteCrewMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => selectedCrewForDelete && deleteCrewMutation.mutate(selectedCrewForDelete.id)}
                            disabled={deleteCrewMutation.isPending}
                        >
                            {deleteCrewMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

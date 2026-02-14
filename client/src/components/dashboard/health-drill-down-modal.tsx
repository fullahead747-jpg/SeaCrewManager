
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query"; // Added useQueryClient
import { getAuthHeaders } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2, AlertCircle, Anchor, Calendar, User, Ship, Clock, FileText, Eye, Search, X } from "lucide-react";
import { CrewMemberWithDetails, Vessel, Document } from "@shared/schema";


import { CrewDetailCard } from "@/components/crew/crew-detail-card";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import DocumentUpload from "@/components/documents/document-upload";
import EditCrewForm from "@/components/crew/edit-crew-form";
import SignOnWizardDialog from "@/components/crew/sign-on-wizard-dialog";
import { CrewAvatar } from "@/components/crew/crew-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, LogIn, Trash2, Mail, Archive, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface HealthDrillDownModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryKey: string;
    categoryName: string;
    type: 'contract' | 'document';
    vesselId?: string;
}

export default function HealthDrillDownModal({
    isOpen,
    onClose,
    categoryKey,
    categoryName,
    type,
    vesselId
}: HealthDrillDownModalProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedCrewForUpload, setSelectedCrewForUpload] = useState<any>(null);
    const [selectedUploadType, setSelectedUploadType] = useState<string | undefined>(undefined);

    // Additional state for crew actions (cloned from CrewTable)
    const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMemberWithDetails | null>(null);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showVesselHistoryDialog, setShowVesselHistoryDialog] = useState(false);
    const [selectedCrewForHistory, setSelectedCrewForHistory] = useState<CrewMemberWithDetails | null>(null);
    const [contractDialogOpen, setContractDialogOpen] = useState(false);
    const [selectedCrewForContract, setSelectedCrewForContract] = useState<CrewMemberWithDetails | null>(null);
    const [selectedVesselForAssignment, setSelectedVesselForAssignment] = useState<any>(null);
    const [contractStartDate, setContractStartDate] = useState("");
    const [contractDuration, setContractDuration] = useState("90");
    const [contractEndDate, setContractEndDate] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedHistoryForDeletion, setSelectedHistoryForDeletion] = useState<any>(null);
    const [deletionReason, setDeletionReason] = useState("");
    const [signOffDialogOpen, setSignOffDialogOpen] = useState(false);
    const [selectedCrewForSignOff, setSelectedCrewForSignOff] = useState<CrewMemberWithDetails | null>(null);
    const [signOffReason, setSignOffReason] = useState("");
    const [signOnDialogOpen, setSignOnDialogOpen] = useState(false);
    const [selectedCrewForSignOn, setSelectedCrewForSignOn] = useState<CrewMemberWithDetails | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch documents for the cards
    const { data: documents = [] } = useQuery<Document[]>({
        queryKey: ['/api/documents'],
        queryFn: async () => {
            const response = await fetch('/api/documents', { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch documents');
            return response.json();
        },
        enabled: isOpen,
    });

    const { data: vessels = [] } = useQuery<Vessel[]>({
        queryKey: ['/api/vessels'],
        queryFn: async () => {
            const response = await fetch('/api/vessels', { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch vessels');
            return response.json();
        },
        enabled: isOpen,
    });

    const { data: rotations = [] } = useQuery({
        queryKey: ['/api/rotations'],
        queryFn: async () => {
            const response = await fetch('/api/rotations', { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch rotations');
            return response.json();
        },
        enabled: isOpen,
    });

    // Handlers for the cards (mostly copied/adapted from CrewTable)
    const handleDownloadCrewDocuments = async (crewId: string, crewName: string) => {
        try {
            const response = await fetch(`/api/crew/${crewId}/documents/download`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = `Documents_${crewName.replace(/\s+/g, '_')}.zip`;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ title: 'Download Failed', description: 'Could not download documents zip.', variant: 'destructive' });
        }
    };

    const sendCrewEmailMutation = useMutation({
        mutationFn: async (member: CrewMemberWithDetails) => {
            const response = await fetch('/api/email/send-crew-details', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ crewMemberId: member.id }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to send email' }));
                throw new Error(errorData.message || 'Failed to send email');
            }
            return response.json();
        },
        onSuccess: () => toast({ title: 'Email Sent', description: 'Crew update email has been sent successfully.' }),
        onError: (error: any) => toast({ title: 'Email Failed', description: error.message, variant: 'destructive' }),
    });

    // Mutations copied from CrewTable
    const assignCrewMutation = useMutation({
        mutationFn: async ({ crewId, vesselId }: { crewId: string; vesselId: string }) => {
            const response = await fetch(`/api/crew/${crewId}`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentVesselId: vesselId, status: 'onBoard', signOffDate: null }),
            });
            if (!response.ok) throw new Error('Failed to assign crew member');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            toast({ title: 'Success', description: 'Crew member assigned successfully' });
        },
    });

    const createContractMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await fetch('/api/contracts', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, status: 'active' }),
            });
            if (!response.ok) throw new Error('Failed to create contract');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
            toast({ title: 'Success', description: 'Contract created successfully' });
            setContractDialogOpen(false);
        },
    });

    const signOffCrewMutation = useMutation({
        mutationFn: async ({ crewId, reason }: { crewId: string; reason: string }) => {
            const crewMember = detailData?.find((m: any) => m.id === crewId);
            const response = await fetch(`/api/crew/${crewId}`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentVesselId: null,
                    lastVesselId: crewMember?.currentVesselId || null,
                    status: 'onShore',
                    signOffDate: new Date().toISOString(),
                    statusChangeReason: reason,
                }),
            });
            if (!response.ok) throw new Error('Failed to sign off crew member');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
            setSignOffDialogOpen(false);
            toast({ title: 'Success', description: 'Crew member signed off successfully' });
        },
    });

    const deleteRotationMutation = useMutation({
        mutationFn: async ({ rotationId, reason, deletedBy }: { rotationId: string; reason: string; deletedBy: string }) => {
            const response = await fetch(`/api/rotations/${rotationId}`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, deletedBy }),
            });
            if (!response.ok) throw new Error('Failed to delete rotation history');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/rotations'] });
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            setDeleteDialogOpen(false);
            toast({ title: 'Success', description: 'History record deleted successfully' });
        },
    });

    const deleteDocumentMutation = useMutation({
        mutationFn: async (documentId: string) => {
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to delete document');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
            toast({ title: 'Success', description: 'Document deleted successfully' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message || 'Failed to delete document', variant: 'destructive' });
        },
    });

    const { data: detailData, isLoading, error } = useQuery({
        queryKey: ['/api/dashboard/drilldown', type, categoryKey, vesselId],
        queryFn: async () => {
            if (!categoryKey) return null;
            const params = new URLSearchParams({ type, key: categoryKey });
            if (vesselId) params.append('vesselId', vesselId);

            const response = await fetch(`/api/dashboard/drilldown?${params.toString()}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch detail data');
            return response.json();
        },
        enabled: isOpen && !!categoryKey,
    });

    const filteredData = detailData?.filter((item: any) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const fullName = `${item.firstName || ""} ${item.lastName || ""}`.toLowerCase();
        return (
            item.firstName?.toLowerCase().includes(search) ||
            item.lastName?.toLowerCase().includes(search) ||
            item.rank?.toLowerCase().includes(search) ||
            item.nationality?.toLowerCase().includes(search) ||
            fullName.includes(search)
        );
    }) || [];

    const handleUpload = (member: any, type: string) => {
        setSelectedCrewForUpload(member);
        setSelectedUploadType(type);
        setIsUploadModalOpen(true);
    };

    // Helper functions cloned from CrewTable
    const getInitials = (firstName?: string | null, lastName?: string | null) => {
        const first = firstName?.charAt(0) || '';
        const last = lastName?.charAt(0) || '';
        return (first + last).toUpperCase() || '?';
    };

    const getVesselHistory = (crewMemberId: string) => {
        const crewRotations = rotations.filter((r: any) => r.crewMemberId === crewMemberId && r.status === 'completed');
        const vesselMap = new Map();
        crewRotations.forEach((rotation: any) => {
            const vessel = vessels?.find((v: any) => v.id === rotation.vesselId);
            if (vessel && !vesselMap.has(vessel.id)) {
                vesselMap.set(vessel.id, { vessel, joinDate: rotation.joinDate, leaveDate: rotation.leaveDate });
            }
        });
        return Array.from(vesselMap.values());
    };

    const calculateEndDate = (startDate: string, durationDays: string) => {
        if (!startDate || !durationDays) return "";
        const start = new Date(startDate);
        const duration = parseInt(durationDays);
        if (isNaN(duration)) return "";
        const end = new Date(start);
        end.setDate(end.getDate() + duration);
        return end.toISOString().split("T")[0];
    };

    const handleContractStartDateChange = (value: string) => {
        setContractStartDate(value);
        setContractEndDate(calculateEndDate(value, contractDuration));
    };

    const handleContractDurationChange = (value: string) => {
        setContractDuration(value);
        setContractEndDate(calculateEndDate(contractStartDate, value));
    };

    const handleAssignToVessel = (crewMember: CrewMemberWithDetails, vessel: any) => {
        setSelectedCrewForContract(crewMember);
        setSelectedVesselForAssignment(vessel);
        setContractDialogOpen(true);
        const today = new Date().toISOString().split("T")[0];
        setContractStartDate(today);
        setContractEndDate(calculateEndDate(today, contractDuration));
    };

    const handleConfirmContract = () => {
        if (!selectedCrewForContract || !selectedVesselForAssignment) return;
        const durationDays = parseInt(contractDuration);
        assignCrewMutation.mutate(
            { crewId: selectedCrewForContract.id, vesselId: selectedVesselForAssignment.id },
            {
                onSuccess: () => {
                    createContractMutation.mutate({
                        crewId: selectedCrewForContract.id,
                        vesselId: selectedVesselForAssignment.id,
                        startDate: contractStartDate,
                        durationDays: durationDays,
                        endDate: contractEndDate,
                    });
                }
            }
        );
    };

    const handleDeleteHistory = (history: any, crewMember: CrewMemberWithDetails) => {
        setSelectedHistoryForDeletion({ ...history, crewMember });
        setDeleteDialogOpen(true);
        setDeletionReason("");
    };

    const handleConfirmDeletion = () => {
        if (!selectedHistoryForDeletion || !deletionReason.trim()) return;
        const rotationToDelete = rotations.find((r: any) =>
            r.crewMemberId === selectedHistoryForDeletion.crewMember.id &&
            r.vesselId === selectedHistoryForDeletion.vessel.id &&
            r.status === 'completed'
        );
        if (!rotationToDelete) return;
        deleteRotationMutation.mutate({
            rotationId: rotationToDelete.id,
            reason: deletionReason,
            deletedBy: user?.username || 'Unknown User',
        });
    };

    const handleSignOffClick = (member: CrewMemberWithDetails) => {
        setSelectedCrewForSignOff(member);
        setSignOffReason("");
        setSignOffDialogOpen(true);
    };

    const handleSignOffConfirm = () => {
        if (!selectedCrewForSignOff || !signOffReason.trim()) return;
        signOffCrewMutation.mutate({ crewId: selectedCrewForSignOff.id, reason: signOffReason.trim() });
    };

    const handleSignOnClick = (member: CrewMemberWithDetails) => {
        setSelectedCrewForSignOn(member);
        setSignOnDialogOpen(true);
    };

    const handleDeleteDocument = (docId: string, type: string) => {
        if (window.confirm(`Are you sure you want to delete this ${type.toUpperCase()} document?`)) {
            deleteDocumentMutation.mutate(docId);
        }
    };

    const handleViewAOAClick = async (m: CrewMemberWithDetails) => {
        if (m.activeContract?.filePath) {
            try {
                const response = await fetch(`/api/contracts/${m.activeContract.id}/view`, {
                    headers: getAuthHeaders(),
                });
                if (!response.ok) throw new Error('Failed to fetch document');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => window.URL.revokeObjectURL(url), 100);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to open AOA document', variant: 'destructive' });
            }
        } else {
            toast({ title: 'Not Available', description: 'No AOA document file found for this contract.' });
        }
    };

    const getStatusColor = (status: string | undefined, contractStatus?: string) => {
        if (status === 'onBoard') return 'bg-compliance-green text-white';
        if (status === 'onShore') return 'bg-ocean-blue text-white';
        return 'bg-gray-500 text-white';
    };
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 shadow-2xl">
                    <DialogHeader className="p-6 pb-2 border-b border-border/10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                    {categoryKey === 'global-search' ? 'Global Crew Search' : (type === 'contract' ? 'Contract Details' : 'Document Details')}
                                    {categoryKey !== 'global-search' && (
                                        <Badge className="ml-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-bold">
                                            {categoryName}
                                        </Badge>
                                    )}
                                </DialogTitle>
                                <DialogDescription className="text-slate-600 dark:text-slate-400 font-medium mt-1">
                                    {categoryKey === 'global-search'
                                        ? 'Search across all crew members in the system by name, rank, or nationality.'
                                        : (type === 'contract'
                                            ? `List of crew members whose contracts are currently in the "${categoryName}" category.`
                                            : `List of documents currently in the "${categoryName}" category.`)}
                                </DialogDescription>
                            </div>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search crew members..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={cn(
                                        "pl-9 pr-9 bg-slate-50 border-slate-200 focus:bg-white transition-all h-9",
                                        categoryKey === 'global-search' && "border-blue-400 ring-1 ring-blue-400/20"
                                    )}
                                    autoFocus={categoryKey === 'global-search'}
                                    data-testid="drilldown-search-input"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors"
                                    >
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                )}
                            </div>
                        </div>
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
                            <div className="space-y-4">
                                {filteredData && filteredData.length > 0 ? (
                                    filteredData.map((item: any) => (
                                        <CrewDetailCard
                                            key={item.id}
                                            member={item}
                                            documents={documents}
                                            onView={(m) => { setSelectedCrewMember(m); setShowViewDialog(true); }}
                                            onEdit={(m) => { setSelectedCrewMember(m); setShowEditDialog(true); }}
                                            onVesselHistory={(m) => { setSelectedCrewForHistory(m); setShowVesselHistoryDialog(true); }}
                                            onSendMail={(m) => sendCrewEmailMutation.mutate(m)}
                                            onDownload={(id, name) => handleDownloadCrewDocuments(id, name)}
                                            onUpload={handleUpload}
                                            onViewAOA={handleViewAOAClick}
                                            onSignOff={handleSignOffClick}
                                            onSignOn={handleSignOnClick}
                                            isMailPending={sendCrewEmailMutation.isPending}
                                        />
                                    ))
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

            {/* View Crew Member Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                            <Eye className="h-5 w-5 text-maritime-navy" />
                            <span>Seafarer Details</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCrewMember && (
                        <div className="space-y-6">
                            {/* Profile Header */}
                            <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
                                <CrewAvatar
                                    memberId={selectedCrewMember.id}
                                    documents={(selectedCrewMember as any).documents}
                                    firstName={selectedCrewMember.firstName}
                                    lastName={selectedCrewMember.lastName}
                                    className="h-20 w-20 border-2 border-white shadow-sm"
                                />
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground">
                                        {selectedCrewMember.firstName} {selectedCrewMember.lastName}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="bg-ocean-blue/10 text-ocean-blue border-ocean-blue/20">
                                            {selectedCrewMember.rank}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Personal Information */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center mb-3">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                                        Personal Information
                                    </h4>
                                    <div className="text-sm space-y-2">
                                        <p><span className="font-medium">Nationality:</span> {selectedCrewMember.nationality}</p>
                                        <p><span className="font-medium">Date of Birth:</span> {formatDate(selectedCrewMember.dateOfBirth)}</p>
                                        {selectedCrewMember.phoneNumber && (
                                            <p><span className="font-medium">Phone:</span>{' '}
                                                <a
                                                    href={`tel:${selectedCrewMember.phoneNumber}`}
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                                >
                                                    {selectedCrewMember.phoneNumber}
                                                </a>
                                            </p>
                                        )}
                                        {(selectedCrewMember as any).email && (
                                            <p><span className="font-medium">Email:</span>{' '}
                                                <a
                                                    href={`mailto:${(selectedCrewMember as any).email}`}
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                                >
                                                    {(selectedCrewMember as any).email}
                                                </a>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Professional Information */}
                                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center mb-3">
                                        <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                                        Professional Information
                                    </h4>
                                    <div className="text-sm space-y-2">
                                        <p><span className="font-medium">Current Vessel:</span> {(selectedCrewMember.currentVessel?.name as string) || 'Not assigned'}</p>
                                        <p><span className="font-medium">Status:</span> {selectedCrewMember.status as string}</p>
                                    </div>
                                </div>

                                {/* Emergency Contact / Next of Kin */}
                                {!!selectedCrewMember.emergencyContact && (
                                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                        <h4 className="font-medium text-orange-900 dark:text-orange-100 flex items-center mb-3">
                                            <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
                                            Next of Kin (NOK)
                                        </h4>
                                        <div className="text-sm space-y-2">
                                            <p><span className="font-medium">Name:</span> {(selectedCrewMember.emergencyContact as any).name}</p>
                                            <p><span className="font-medium">Relationship:</span> {(selectedCrewMember.emergencyContact as any).relationship}</p>
                                            <p><span className="font-medium">Phone:</span>{' '}
                                                {(selectedCrewMember.emergencyContact as any).phone ? (
                                                    <a
                                                        href={`tel:${(selectedCrewMember.emergencyContact as any).phone}`}
                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                                    >
                                                        {(selectedCrewMember.emergencyContact as any).phone}
                                                    </a>
                                                ) : (
                                                    'Not provided'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Passport Details */}
                                {(() => {
                                    const passport = selectedCrewMember.documents?.find(d => d.type === 'passport');
                                    return passport ? (
                                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                                            <h4 className="font-medium text-indigo-900 dark:text-indigo-100 flex items-center mb-3">
                                                <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
                                                Passport Details
                                            </h4>
                                            <div className="text-sm space-y-2">
                                                <p><span className="font-medium">Passport Number:</span> {passport.documentNumber}</p>
                                                <p><span className="font-medium">Expiry Date:</span> {formatDate(passport.expiryDate)}</p>
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                                    Close
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShowViewDialog(false);
                                        setShowEditDialog(true);
                                    }}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    Edit
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
                    {selectedCrewMember && (
                        <EditCrewForm
                            crewMember={selectedCrewMember}
                            onSuccess={() => {
                                setShowEditDialog(false);
                                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
                            }}
                            onCancel={() => setShowEditDialog(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Vessel History Dialog */}
            <Dialog open={showVesselHistoryDialog} onOpenChange={setShowVesselHistoryDialog}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                            <Ship className="h-5 w-5 text-ocean-blue" />
                            <span>Previous Vessels Joined</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCrewForHistory && (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                                <CrewAvatar
                                    memberId={selectedCrewForHistory.id}
                                    documents={(selectedCrewForHistory as any).documents}
                                    firstName={selectedCrewForHistory.firstName}
                                    lastName={selectedCrewForHistory.lastName}
                                    className="h-12 w-12 bg-maritime-navy"
                                />
                                <div>
                                    <h3 className="font-medium text-foreground">
                                        {selectedCrewForHistory.firstName} {selectedCrewForHistory.lastName}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{selectedCrewForHistory.rank}</p>
                                </div>
                            </div>

                            {(() => {
                                const vesselHistory = getVesselHistory(selectedCrewForHistory.id);

                                return vesselHistory.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Ship className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No previous vessel history found</p>
                                        <p className="text-sm mt-1">This crew member has no completed rotations</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {vesselHistory.length} {vesselHistory.length === 1 ? 'vessel' : 'vessels'} served
                                        </p>
                                        {vesselHistory.map((history: any, index: number) => (
                                            <div
                                                key={index}
                                                className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-2 flex-1">
                                                        <h4 className="font-medium text-foreground flex items-center">
                                                            <Ship className="h-4 w-4 mr-2 text-ocean-blue" />
                                                            {history.vessel.name}
                                                        </h4>
                                                        <div className="text-sm space-y-1 text-muted-foreground">
                                                            <p>
                                                                <span className="font-medium">Type:</span> {history.vessel.type}
                                                            </p>
                                                            <p>
                                                                <span className="font-medium">Sign On:</span>{' '}
                                                                {history.joinDate ? formatDate(history.joinDate) : 'N/A'}
                                                            </p>
                                                            <p>
                                                                <span className="font-medium">Sign Off:</span>{' '}
                                                                {history.leaveDate ? formatDate(history.leaveDate) : 'N/A'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="bg-ocean-blue text-white hover:bg-ocean-blue/90 hover:text-white"
                                                            onClick={() => handleAssignToVessel(selectedCrewForHistory, history.vessel)}
                                                        >
                                                            Assign
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="bg-red-600 text-white hover:bg-red-700 hover:text-white"
                                                            onClick={() => handleDeleteHistory(history, selectedCrewForHistory)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-1" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            <div className="flex justify-end pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowVesselHistoryDialog(false);
                                        setSelectedCrewForHistory(null);
                                    }}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={signOffDialogOpen} onOpenChange={setSignOffDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Sign Off Crew Member</DialogTitle>
                        <DialogDescription>
                            {selectedCrewForSignOff && (
                                <>
                                    You are signing off {selectedCrewForSignOff.firstName} {selectedCrewForSignOff.lastName} from {selectedCrewForSignOff.currentVessel?.name || 'their current vessel'}.
                                    Please provide a reason for this status change.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="signoff-reason">Reason for Status Change <span className="text-red-500">*</span></Label>
                            <textarea
                                id="signoff-reason"
                                className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ocean-blue"
                                placeholder="Enter the reason for signing off this crew member (required)"
                                value={signOffReason}
                                onChange={(e) => setSignOffReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSignOffDialogOpen(false);
                                setSelectedCrewForSignOff(null);
                                setSignOffReason('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSignOffConfirm}
                            disabled={signOffCrewMutation.isPending || !signOffReason.trim()}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {signOffCrewMutation.isPending ? 'Signing Off...' : 'Confirm Sign Off'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={signOnDialogOpen} onOpenChange={setSignOnDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[98vh] p-0 border-0 bg-transparent shadow-none">
                    {selectedCrewForSignOn && (
                        <SignOnWizardDialog
                            member={selectedCrewForSignOn}
                            onClose={() => setSignOnDialogOpen(false)}
                            onSuccess={() => {
                                setSignOnDialogOpen(false);
                                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
                    <DocumentUpload
                        crewMemberId={selectedCrewForUpload?.id}
                        preselectedType={selectedUploadType}
                        onSuccess={() => {
                            setIsUploadModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-maritime-navy">Contract Information</DialogTitle>
                        <DialogDescription>
                            Enter contract details for {selectedCrewForContract?.firstName} {selectedCrewForContract?.lastName} to join {selectedVesselForAssignment?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contract-start-date">Contract Start Date</Label>
                                <Input
                                    id="contract-start-date"
                                    type="date"
                                    value={contractStartDate}
                                    onChange={(e) => handleContractStartDateChange(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="contract-duration">Duration (Days)</Label>
                                <Input
                                    id="contract-duration"
                                    type="number"
                                    value={contractDuration}
                                    onChange={(e) => handleContractDurationChange(e.target.value)}
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contract-end-date">Contract End Date (Auto-calculated)</Label>
                            <Input
                                id="contract-end-date"
                                type="date"
                                value={contractEndDate}
                                readOnly
                                disabled
                                className="bg-muted"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setContractDialogOpen(false);
                                setSelectedCrewForContract(null);
                                setSelectedVesselForAssignment(null);
                                setContractStartDate('');
                                setContractDuration('90');
                                setContractEndDate('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmContract}
                            disabled={assignCrewMutation.isPending || createContractMutation.isPending}
                            className="bg-ocean-blue hover:bg-ocean-blue/90 text-white"
                        >
                            {assignCrewMutation.isPending || createContractMutation.isPending ? 'Processing...' : 'Confirm & Assign'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Confirm Removal
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this historical record for {selectedHistoryForDeletion?.crewMember?.firstName} {selectedHistoryForDeletion?.crewMember?.lastName}?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-600">
                            <strong>Warning:</strong> This action cannot be undone. This will permanently remove the record from the seafarer's vessel history.
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deletion-reason">Reason for delection <span className="text-red-500">*</span></Label>
                            <Input
                                id="deletion-reason"
                                placeholder="Enter reason for history removal"
                                value={deletionReason}
                                onChange={(e) => setDeletionReason(e.target.value)}
                                className="border-red-200 focus:ring-red-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteDialogOpen(false);
                                setDeletionReason('');
                                setSelectedHistoryForDeletion(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDeletion}
                            disabled={deleteRotationMutation.isPending || !deletionReason.trim()}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteRotationMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

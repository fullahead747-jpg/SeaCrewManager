import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { CrewListPanel } from '@/components/crew/crew-list-panel';
import { CrewDetailPanel } from '@/components/crew/crew-detail-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, User, Trash2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import DocumentUpload from '@/components/documents/document-upload';
import type { CrewMemberWithDetails, Document } from '@shared/schema';

export default function CrewDocumentsSplitView() {
    const [location, setLocation] = useLocation();
    const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
    const [initialTypeHandled, setInitialTypeHandled] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadDocumentType, setUploadDocumentType] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const { toast } = useToast();

    const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
        queryKey: ['/api/documents'],
        queryFn: async () => {
            const response = await fetch('/api/documents', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch documents');
            return response.json();
        },
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });

    const { data: crewMembers, isLoading: crewLoading } = useQuery<CrewMemberWithDetails[]>({
        queryKey: ['/api/crew'],
        queryFn: async () => {
            const response = await fetch('/api/crew', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch crew');
            return response.json();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (docId: string) => {
            const response = await apiRequest('DELETE', `/api/documents/${docId}`);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
            toast({
                title: 'Success',
                description: 'Document deleted successfully',
            });
            setIsDeleteDialogOpen(false);
            setDocumentToDelete(null);
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete document',
                variant: 'destructive',
            });
        },
    });

    // Auto-select crew member from URL or first list item
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const crewIdFromUrl = params.get('crew');
        const typeFromUrl = params.get('type');

        if (crewIdFromUrl && crewMembers?.some(c => c.id === crewIdFromUrl)) {
            setSelectedCrewId(crewIdFromUrl);

            // Handle auto-opening upload for a specific type once
            if (typeFromUrl && !initialTypeHandled) {
                setUploadDocumentType(typeFromUrl);
                setIsUploadModalOpen(true);
                setInitialTypeHandled(true);
            }
        } else if (crewMembers && crewMembers.length > 0 && !selectedCrewId) {
            setSelectedCrewId(crewMembers[0].id);
        }
    }, [crewMembers, selectedCrewId, initialTypeHandled, location]);

    if (documentsLoading || crewLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maritime-navy"></div>
            </div>
        );
    }

    const selectedCrew = selectedCrewId
        ? crewMembers?.find(c => c.id === selectedCrewId) || null
        : null;

    const selectedCrewDocuments = selectedCrewId
        ? documents?.filter(d => d.crewMemberId === selectedCrewId) || []
        : [];

    const handleViewDocument = (doc: Document) => {
        // Open document in new tab
        if (doc.filePath) {
            window.open(doc.filePath, '_blank');
        }
    };

    const handleCrewClick = (crewId: string) => {
        window.location.href = `/documents?crew=${crewId}`;
    };

    const handleUploadDocument = (type: string) => {
        setUploadDocumentType(type);
        setSelectedDocument(null); // Clear any previously selected document
        setIsUploadModalOpen(true);
    };

    const handleEditDocument = (doc: Document) => {
        setSelectedDocument(doc);
        setUploadDocumentType(doc.type);
        setIsUploadModalOpen(true);
    };

    const handleDeleteDocument = (doc: Document) => {
        setDocumentToDelete(doc);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (documentToDelete) {
            deleteMutation.mutate(documentToDelete.id);
        }
    };

    const handleDownloadAll = () => {
        if (!selectedCrewDocuments || selectedCrewDocuments.length === 0) {
            return;
        }

        // Download each document
        selectedCrewDocuments.forEach((doc) => {
            if (doc.filePath) {
                // Create a temporary link and trigger download
                const link = document.createElement('a');
                link.href = doc.filePath;
                link.download = `${doc.type}_${doc.documentNumber}.pdf`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    };

    return (
        <div className="h-full flex overflow-hidden">
            {/* Left Panel - 30% */}
            <div className="w-[30%] h-full flex-shrink-0">
                <CrewListPanel
                    crewMembers={crewMembers || []}
                    documents={documents || []}
                    selectedCrewId={selectedCrewId}
                    onSelectCrew={(id) => setLocation(`/documents?crew=${id}`)}
                />
            </div>

            {/* Right Panel - 70% */}
            <div className="w-[70%] h-full flex-shrink-0 flex flex-col">
                {/* Context Banner */}
                {selectedCrew && (
                    <Alert className="m-4 mb-2 border-blue-200 bg-gradient-to-r from-blue-50 to-white">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">
                                    Viewing documents for:
                                </span>
                                <span className="text-sm font-semibold text-blue-600">
                                    {selectedCrew.firstName} {selectedCrew.lastName}
                                </span>
                                <span className="text-xs text-gray-500">
                                    ({selectedCrew.rank || 'No rank'})
                                </span>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex-1 overflow-auto">
                    <CrewDetailPanel
                        crew={selectedCrew}
                        documents={selectedCrewDocuments}
                        onDownloadAll={handleDownloadAll}
                        onViewDocument={handleViewDocument}
                        onUploadDocument={handleUploadDocument}
                        onEditDocument={handleEditDocument}
                        onDeleteDocument={handleDeleteDocument}
                    />
                </div>
            </div>

            {/* Upload Modal */}
            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
                    <DocumentUpload
                        onSuccess={() => {
                            setIsUploadModalOpen(false);
                            setUploadDocumentType(null);
                            // Refresh relevant caches
                            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
                        }}
                        crewMemberId={selectedCrewId || undefined}
                        preselectedType={uploadDocumentType || undefined}
                        document={selectedDocument || undefined}
                    />
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="bg-white border rounded-xl shadow-lg">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-2 text-rose-600 mb-2">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertDialogTitle className="text-xl font-bold">Delete Document?</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-gray-600">
                            Are you sure you want to delete <span className="font-bold text-gray-900">{documentToDelete?.type?.toUpperCase()}</span> ({documentToDelete?.documentNumber})?
                            <br /><br />
                            This action cannot be undone and the file will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="font-medium">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete Document'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import DocumentUpload from '@/components/documents/document-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FileText, Plus, Search, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { Document, CrewMemberWithDetails } from '@shared/schema';
import { format } from 'date-fns';
import { formatDate } from '@/lib/utils';

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  const { data: crewMembers } = useQuery<CrewMemberWithDetails[]>({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
  });

  // For crew members, filter to their documents only
  const filteredDocuments = documents?.filter(doc => {
    if (user?.role === 'crew') {
      const currentMember = crewMembers?.find(member => member.user?.id === user.id);
      return doc.crewMemberId === currentMember?.id;
    }

    // Get crew member name for search matching
    const crewMember = crewMembers?.find(member => member.id === doc.crewMemberId);
    const crewMemberName = crewMember ? `${crewMember.firstName} ${crewMember.lastName}`.toLowerCase() : '';

    const matchesSearch = doc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.issuingAuthority.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crewMemberName.includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-compliance-green text-white';
      case 'expiring': return 'bg-warning-amber text-white';
      case 'expired': return 'bg-alert-red text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getCrewMemberName = (crewMemberId: string) => {
    const member = crewMembers?.find(m => m.id === crewMemberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  const getCrewMemberInitials = (crewMemberId: string) => {
    const member = crewMembers?.find(m => m.id === crewMemberId);
    return member ? `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase() : 'UK';
  };

  // Delete document mutation
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
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      setIsDeleteModalOpen(false);
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsViewModalOpen(true);
  };

  const handleEditDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsEditModalOpen(true);
  };

  const handleDeleteDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedDocument) {
      deleteDocumentMutation.mutate(selectedDocument.id);
    }
  };

  const documentTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'passport', label: 'Passport' },
    { value: 'cdc', label: 'CDC' },
    { value: 'stcw', label: 'STCW' },
    { value: 'medical', label: 'Medical Certificate' },
    { value: 'visa', label: 'Visa' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold maritime-navy mb-2" data-testid="documents-title">
            Document Center
          </h2>
          <p className="text-gray-600">
            {user?.role === 'crew'
              ? 'Manage your personal documents and certificates'
              : 'Manage crew documents, certificates, and compliance tracking'
            }
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-maritime-navy hover:bg-blue-800" data-testid="upload-document-button">
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
              <DocumentUpload onSuccess={() => setIsUploadModalOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Document Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 ocean-blue" />
              <span className="text-2xl font-bold maritime-navy" data-testid="total-documents-count">
                {documents?.length || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-compliance-green rounded-full"></div>
              <span className="text-2xl font-bold maritime-navy" data-testid="valid-documents-count">
                {documents?.filter(doc => doc.status === 'valid').length || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-warning-amber rounded-full"></div>
              <span className="text-2xl font-bold maritime-navy" data-testid="expiring-documents-count">
                {documents?.filter(doc => doc.status === 'expiring').length || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-alert-red rounded-full"></div>
              <span className="text-2xl font-bold maritime-navy" data-testid="expired-documents-count">
                {documents?.filter(doc => doc.status === 'expired').length || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Views */}
      {(
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="maritime-navy">Documents</CardTitle>
              <Button variant="outline" size="sm" data-testid="export-documents-button">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filters */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="documents-search-input"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="document-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="document-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Documents Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {user?.role !== 'crew' && <TableHead>Crew Member</TableHead>}
                    <TableHead>Document Type</TableHead>
                    <TableHead>Document Number</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={user?.role !== 'crew' ? 6 : 5}
                        className="text-center py-8 text-gray-500"
                      >
                        No documents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDocuments.map((document) => (
                      <TableRow key={document.id} className="hover:bg-gray-50" data-testid={`document-row-${document.id}`}>
                        {user?.role !== 'crew' && (
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="bg-maritime-navy">
                                <AvatarFallback className="text-white font-medium">
                                  {getCrewMemberInitials(document.crewMemberId)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium" data-testid="document-crew-name">
                                {getCrewMemberName(document.crewMemberId)}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="font-medium" data-testid="document-type">
                          {document.type.toUpperCase()}
                        </TableCell>
                        <TableCell data-testid="document-number">{document.documentNumber}</TableCell>
                        <TableCell data-testid="document-expiry">
                          {formatDate(document.expiryDate)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(document.status)} data-testid="document-status">
                            {document.status === 'valid' ? 'Valid' :
                              document.status === 'expiring' ? 'Expiring' : 'Expired'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="maritime-navy hover:bg-blue-50"
                              onClick={() => handleViewDocument(document)}
                              data-testid={`view-document-${document.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {document.filePath && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:bg-green-50"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/documents/${document.id}/download`, {
                                      headers: getAuthHeaders(),
                                    });
                                    if (!response.ok) throw new Error('Failed to download document');
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${document.type}_${document.documentNumber}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(url);
                                  } catch (error) {
                                    toast({ title: 'Error', description: 'Failed to download document', variant: 'destructive' });
                                  }
                                }}
                                data-testid={`download-document-${document.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-600 hover:bg-gray-50"
                              onClick={() => handleEditDocument(document)}
                              data-testid={`edit-document-${document.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteDocument(document)}
                              data-testid={`delete-document-${document.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Document Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-primary" />
              <span>Document Details</span>
            </DialogTitle>
          </DialogHeader>

          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Document Type</label>
                  <p className="text-sm font-semibold">{selectedDocument.type.toUpperCase()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedDocument.status)}>
                      {selectedDocument.status === 'valid' ? 'Valid' :
                        selectedDocument.status === 'expiring' ? 'Expiring' : 'Expired'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Document Number</label>
                <p className="text-sm font-semibold">{selectedDocument.documentNumber}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Issuing Authority</label>
                <p className="text-sm">{selectedDocument.issuingAuthority}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Issue Date</label>
                  <p className="text-sm">{formatDate(selectedDocument.issueDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Expiry Date</label>
                  <p className="text-sm">{formatDate(selectedDocument.expiryDate)}</p>
                </div>
              </div>

              {user?.role !== 'crew' && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Crew Member</label>
                  <p className="text-sm">{getCrewMemberName(selectedDocument.crewMemberId)}</p>
                </div>
              )}

              {/* Document Preview and Download */}
              {selectedDocument.filePath && (
                <div className="border-t pt-4 mt-4">
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Attached Document</label>
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-maritime-navy" />
                        <div>
                          <p className="text-sm font-medium">{selectedDocument.documentNumber || 'Document'}</p>
                          <p className="text-xs text-gray-500">Click to download or view</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/documents/${selectedDocument.id}/download`, {
                              headers: getAuthHeaders(),
                            });
                            if (!response.ok) throw new Error('Failed to download document');
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${selectedDocument.type}_${selectedDocument.documentNumber}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            toast({ title: 'Error', description: 'Failed to download document', variant: 'destructive' });
                          }
                        }}
                        data-testid="download-document-modal"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Document Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
          {selectedDocument && (
            <DocumentUpload
              crewMemberId={selectedDocument.crewMemberId}
              document={selectedDocument}
              onSuccess={() => {
                setIsEditModalOpen(false);
                setSelectedDocument(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
              {selectedDocument && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <strong>{selectedDocument.type.toUpperCase()}</strong> - {selectedDocument.documentNumber}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

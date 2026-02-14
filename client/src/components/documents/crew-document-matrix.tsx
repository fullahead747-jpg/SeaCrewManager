import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Plus, Search, Download, Eye, Trash2 } from 'lucide-react';
import { Document, CrewMemberWithDetails } from '@shared/schema';
import DocumentUpload from './document-upload';

type DocumentType = 'passport' | 'cdc' | 'stcw' | 'medical' | 'visa' | 'coc';

interface DocumentCell {
  crewMemberId: string;
  documentType: DocumentType;
  document?: Document;
  status: 'missing' | 'valid' | 'expiring' | 'expired';
}

const DOCUMENT_TYPES: { type: DocumentType; label: string; shortLabel: string }[] = [
  { type: 'passport', label: 'Passport', shortLabel: 'Pass' },
  { type: 'cdc', label: 'CDC', shortLabel: 'CDC' },
  { type: 'coc', label: 'COC', shortLabel: 'COC' },
  { type: 'medical', label: 'Medical Certificate', shortLabel: 'Med' },
  { type: 'visa', label: 'Visa', shortLabel: 'Visa' },
];

export default function CrewDocumentMatrix() {
  const { toast } = useToast();
  const [selectedCell, setSelectedCell] = useState<DocumentCell | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: crewMembers = [], isLoading: crewLoading } = useQuery<CrewMemberWithDetails[]>({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  // Filter crew members based on search term
  const filteredCrewMembers = crewMembers.filter(crewMember => {
    const fullName = `${crewMember.firstName} ${crewMember.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  // Create matrix data structure with performance optimization
  const createDocumentMatrix = useCallback(() => {
    // Pre-index documents for O(1) lookup performance
    const documentIndex = new Map<string, Document>();
    documents.forEach(doc => {
      const key = `${doc.crewMemberId}-${doc.type}`;
      documentIndex.set(key, doc);
    });

    const matrix: DocumentCell[][] = [];

    filteredCrewMembers.forEach((crewMember) => {
      const row: DocumentCell[] = [];

      DOCUMENT_TYPES.forEach(({ type }) => {
        const key = `${crewMember.id}-${type}`;
        const document = documentIndex.get(key);

        let status: DocumentCell['status'] = 'missing';
        if (document) {
          const now = new Date();
          const expiryDate = new Date(document.expiryDate);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 0) {
            status = 'expired';
          } else if (daysUntilExpiry <= 30) {
            status = 'expiring';
          } else {
            status = 'valid';
          }
        }

        row.push({
          crewMemberId: crewMember.id,
          documentType: type,
          document,
          status,
        });
      });

      matrix.push(row);
    });

    return matrix;
  }, [filteredCrewMembers, documents]);

  const documentMatrix = createDocumentMatrix();

  // Calculate progress for each crew member (fixed to count distinct document types)
  const getCrewProgress = (crewMemberId: string) => {
    const crewDocuments = documents.filter(doc => doc.crewMemberId === crewMemberId);
    const totalDocumentTypes = DOCUMENT_TYPES.length;

    // Count unique document types (not total documents) for accurate progress
    const uploadedDocumentTypes = new Set(crewDocuments.map(doc => doc.type)).size;
    const pendingDocumentTypes = totalDocumentTypes - uploadedDocumentTypes;
    const percentage = totalDocumentTypes > 0 ? (uploadedDocumentTypes / totalDocumentTypes) * 100 : 0;

    return {
      uploaded: uploadedDocumentTypes,
      pending: pendingDocumentTypes,
      percentage: Math.round(percentage),
    };
  };

  const getStatusIcon = (status: DocumentCell['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expiring':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Plus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: DocumentCell['status']) => {
    switch (status) {
      case 'valid':
        return 'bg-green-100 border-green-200 hover:bg-green-200';
      case 'expiring':
        return 'bg-yellow-100 border-yellow-200 hover:bg-yellow-200';
      case 'expired':
        return 'bg-red-100 border-red-200 hover:bg-red-200';
      default:
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    }
  };

  const handleCellClick = (cell: DocumentCell) => {
    setSelectedCell(cell);
    setIsUploadModalOpen(true);
  };

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    setSelectedCell(null);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    toast({
      title: 'Success',
      description: 'Document uploaded successfully',
    });
  };

  const handleViewDocument = async (document: Document) => {
    if (document.id) {
      try {
        // Fetch the document with proper authentication headers
        const response = await fetch(`/api/documents/${document.id}/download`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }

        // Create a blob from the response
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Open the blob URL in a new tab
        window.open(blobUrl, '_blank');

        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (error) {
        console.error('Error viewing document:', error);
        toast({
          title: 'Error',
          description: 'Failed to open document',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    if (doc.id) {
      try {
        // Fetch the document with proper authentication headers
        const response = await fetch(`/api/documents/${doc.id}/download`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }

        // Create a blob from the response
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Create download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${doc.type}_${doc.documentNumber}.pdf`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Error downloading document:', error);
        toast({
          title: 'Error',
          description: 'Failed to download document',
          variant: 'destructive',
        });
      }
    }
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
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteDocument = (doc: Document) => {
    if (confirm(`Are you sure you want to delete this ${doc.type.toUpperCase()} document?`)) {
      deleteDocumentMutation.mutate(doc.id);
    }
  };

  const getCrewMemberName = (crewMemberId: string) => {
    const member = crewMembers.find(m => m.id === crewMemberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  const getCrewMemberInitials = (crewMemberId: string) => {
    const member = crewMembers.find(m => m.id === crewMemberId);
    return member ? `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase() : 'UK';
  };

  if (crewLoading || documentsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold maritime-navy mb-2">
          Crew Document Matrix
        </h3>
        <p className="text-gray-600">
          Upload and track documents for all crew members. Click on any cell to upload or view documents.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Crew Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 ocean-blue" />
              <span className="text-2xl font-bold maritime-navy">
                {filteredCrewMembers.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Document Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Upload className="h-5 w-5 ocean-blue" />
              <span className="text-2xl font-bold maritime-navy">
                {DOCUMENT_TYPES.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold maritime-navy">
                {documents.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Matrix Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="maritime-navy">Document Upload Matrix</CardTitle>
            <div className="flex-1 max-w-sm ml-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search crew members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="crew-search-input"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="min-w-[200px]">Crew Member</TableHead>
                  <TableHead className="min-w-[120px]">Progress</TableHead>
                  {DOCUMENT_TYPES.map(({ type, shortLabel }) => (
                    <TableHead key={type} className="text-center min-w-[100px]">
                      <div className="flex flex-col items-center">
                        <span className="font-medium">{shortLabel}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentMatrix.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={DOCUMENT_TYPES.length + 2} className="text-center py-8 text-gray-500">
                      {searchTerm ? `No crew members found matching "${searchTerm}"` : 'No crew members found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  documentMatrix.map((row, rowIndex) => {
                    const crewMemberId = row[0]?.crewMemberId;
                    const progress = getCrewProgress(crewMemberId);

                    return (
                      <TableRow key={crewMemberId} className="hover:bg-gray-50">
                        {/* Crew Member Column */}
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="bg-maritime-navy">
                              {(() => {
                                const member = crewMembers.find(m => m.id === crewMemberId);
                                const photoDoc = member?.documents?.find(d => d.type === 'photo' && d.filePath);
                                return photoDoc ? (
                                  <AvatarImage
                                    src={`/${photoDoc.filePath}`}
                                    alt={getCrewMemberName(crewMemberId)}
                                    className="object-cover"
                                  />
                                ) : null;
                              })()}
                              <AvatarFallback className="text-white font-medium">
                                {getCrewMemberInitials(crewMemberId)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium" data-testid={`crew-name-${crewMemberId}`}>
                                {getCrewMemberName(crewMemberId)}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Progress Column */}
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {progress.uploaded}/{progress.uploaded + progress.pending}
                              </span>
                              <span className="text-gray-600">{progress.percentage}%</span>
                            </div>
                            <Progress value={progress.percentage} className="h-2" />
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>{progress.uploaded} uploaded</span>
                              <span>{progress.pending} pending</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Document Columns */}
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="text-center">
                            {cell.document ? (
                              <div className="space-y-2">
                                <div className={`p-3 border-2 rounded-lg ${getStatusColor(cell.status)}`}>
                                  <div className="flex flex-col items-center space-y-2">
                                    {getStatusIcon(cell.status)}
                                    <span className="text-xs font-medium">
                                      {cell.status === 'valid' ? 'Valid' :
                                        cell.status === 'expiring' ? 'Expiring' :
                                          cell.status === 'expired' ? 'Expired' : ''}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col space-y-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200"
                                    onClick={() => handleViewDocument(cell.document!)}
                                    data-testid={`view-document-${crewMemberId}-${cell.documentType}`}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View Certificate
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-200"
                                    onClick={() => handleDownloadDocument(cell.document!)}
                                    data-testid={`download-document-${crewMemberId}-${cell.documentType}`}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-200 text-red-700 hover:text-red-800"
                                    onClick={() => handleDeleteDocument(cell.document!)}
                                    disabled={deleteDocumentMutation.isPending}
                                    data-testid={`delete-document-${crewMemberId}-${cell.documentType}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    {deleteDocumentMutation.isPending ? 'Deleting...' : 'Delete'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`w-16 h-16 p-2 border-2 rounded-lg transition-colors ${getStatusColor(cell.status)}`}
                                onClick={() => handleCellClick(cell)}
                                data-testid={`document-cell-${crewMemberId}-${cell.documentType}`}
                              >
                                <div className="flex flex-col items-center space-y-1">
                                  {getStatusIcon(cell.status)}
                                  <span className="text-xs text-gray-500">Upload</span>
                                </div>
                              </Button>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-primary" />
              <span>
                {selectedCell?.document ? 'Update' : 'Upload'} {' '}
                {DOCUMENT_TYPES.find(dt => dt.type === selectedCell?.documentType)?.label}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedCell && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Crew Member</div>
                <div className="font-medium">{getCrewMemberName(selectedCell.crewMemberId)}</div>
              </div>

              <DocumentUpload
                crewMemberId={selectedCell.crewMemberId}
                document={selectedCell.document}
                preselectedType={selectedCell.documentType}
                onSuccess={handleUploadSuccess}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

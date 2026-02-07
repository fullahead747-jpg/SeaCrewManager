import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Trash2, 
  Calendar, 
  User, 
  Globe, 
  Lock,
  AlertTriangle,
  Archive
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { VesselDocumentUploadModal } from './vessel-document-upload-modal';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VesselDocument {
  id: string;
  vesselId: string;
  name: string;
  type: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string;
  uploadedAt: string;
  expiryDate?: string;
  isPublic: boolean;
}

interface VesselDocumentsListProps {
  vesselId: string;
  vesselName: string;
}

export function VesselDocumentsList({ vesselId, vesselName }: VesselDocumentsListProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch vessel documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: [`/api/vessels/${vesselId}/documents`],
    queryFn: async () => {
      const response = await fetch(`/api/vessels/${vesselId}/documents`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/vessel-documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete document');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Document deleted',
        description: 'The document has been deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/documents`] });
      setDeleteDocumentId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk download mutation
  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/vessels/${vesselId}/documents/download-all`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to prepare bulk download');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Bulk download prepared',
        description: `${data.count} documents ready for download.`,
      });
      // In a real implementation, this would trigger an actual ZIP download
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk download failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDownload = (documentId: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/vessel-documents/${documentId}/download`;
    link.download = fileName;
    link.click();
  };

  const getDocumentTypeColor = (type: string) => {
    const colors = {
      certificate: 'bg-green-100 text-green-800',
      insurance: 'bg-blue-100 text-blue-800',
      inspection: 'bg-yellow-100 text-yellow-800',
      safety: 'bg-red-100 text-red-800',
      customs: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type as keyof typeof colors] || colors.other;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Documents</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Documents ({documents.length})</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              {documents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkDownloadMutation.mutate()}
                  disabled={bulkDownloadMutation.isPending}
                  data-testid="button-bulk-download"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Bulk Download
                </Button>
              )}
              <Button
                onClick={() => setShowUploadModal(true)}
                size="sm"
                data-testid="button-upload-document"
              >
                <FileText className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No documents uploaded
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Upload documents for {vesselName} to get started.
              </p>
              <Button
                onClick={() => setShowUploadModal(true)}
                data-testid="button-upload-first-document"
              >
                <FileText className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document: VesselDocument) => (
                <div
                  key={document.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {document.name}
                        </h4>
                        <Badge className={getDocumentTypeColor(document.type)}>
                          {document.type}
                        </Badge>
                        {document.isPublic ? (
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <Globe className="h-3 w-3" />
                            <span>Public</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <Lock className="h-3 w-3" />
                            <span>Private</span>
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <div>
                          <span className="font-medium">File: </span>
                          {document.fileName}
                        </div>
                        {document.fileSize && (
                          <div>
                            <span className="font-medium">Size: </span>
                            {formatFileSize(document.fileSize)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Uploaded: </span>
                          {formatDate(document.uploadedAt)}
                        </div>
                        {document.expiryDate && (
                          <div className={`flex items-center space-x-1 ${
                            isExpired(document.expiryDate) ? 'text-red-600' :
                            isExpiringSoon(document.expiryDate) ? 'text-yellow-600' : ''
                          }`}>
                            {(isExpired(document.expiryDate) || isExpiringSoon(document.expiryDate)) && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            <span className="font-medium">Expires: </span>
                            {formatDate(document.expiryDate)}
                          </div>
                        )}
                      </div>

                      {document.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                          {document.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(document.id, document.fileName)}
                        data-testid={`button-download-${document.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteDocumentId(document.id)}
                        data-testid={`button-delete-${document.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <VesselDocumentUploadModal
        vesselId={vesselId}
        vesselName={vesselName}
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDocumentId} onOpenChange={() => setDeleteDocumentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocumentId && deleteDocumentMutation.mutate(deleteDocumentId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
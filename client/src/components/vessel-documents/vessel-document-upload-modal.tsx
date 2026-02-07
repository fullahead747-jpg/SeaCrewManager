import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';

interface VesselDocumentUploadModalProps {
  vesselId: string;
  vesselName: string;
  open: boolean;
  onClose: () => void;
}

const DOCUMENT_TYPES = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'safety', label: 'Safety' },
  { value: 'customs', label: 'Customs' },
  { value: 'other', label: 'Other' }
];

export function VesselDocumentUploadModal({ vesselId, vesselName, open, onClose }: VesselDocumentUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [description, setDescription] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: any) => {
      setIsUploading(true);
      
      try {
        // Step 1: Get upload URL
        const uploadUrlResponse = await fetch(`/api/vessels/${vesselId}/documents/upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ fileName: selectedFile!.name }),
        });

        if (!uploadUrlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadURL } = await uploadUrlResponse.json();

        // Step 2: Upload file to object storage
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile!.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        // Step 3: Create document record
        const documentData = {
          name: documentName,
          type: documentType,
          description: description || null,
          fileName: selectedFile!.name,
          filePath: uploadURL.split('?')[0], // Remove query parameters
          fileSize: selectedFile!.size,
          mimeType: selectedFile!.type,
          expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
          isPublic: isPublic,
        };

        const response = await fetch(`/api/vessels/${vesselId}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(documentData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create document record');
        }

        return response.json();
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Document uploaded',
        description: 'The vessel document has been uploaded successfully.',
      });
      
      // Reset form
      setSelectedFile(null);
      setDocumentName('');
      setDocumentType('');
      setDescription('');
      setExpiryDate('');
      setIsPublic(false);
      
      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/documents`] });
      
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        // Auto-fill document name from file name
        const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        setDocumentName(nameWithoutExtension);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !documentName || !documentType) {
      toast({
        title: 'Missing information',
        description: 'Please select a file, enter a document name, and choose a document type.',
        variant: 'destructive',
      });
      return;
    }

    uploadMutation.mutate({});
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col" aria-describedby="upload-document-description">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Upload Document</span>
          </DialogTitle>
          <p id="upload-document-description" className="text-sm text-muted-foreground">
            Upload a new document for {vesselName}
          </p>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
             style={{ maxHeight: 'calc(90vh - 160px)' }}>
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-300 transition-colors">
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      className="ml-2"
                      data-testid="remove-file-button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Click to select a file or drag and drop</p>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                    data-testid="file-input"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    data-testid="select-file-button"
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Document Details */}
          <div className="space-y-2">
            <Label htmlFor="document-name">Document Name *</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
              data-testid="input-document-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-type">Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger data-testid="select-document-type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              data-testid="textarea-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry-date">Expiry Date</Label>
            <Input
              id="expiry-date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              data-testid="input-expiry-date"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-public"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(checked === true)}
              data-testid="checkbox-public"
            />
            <Label htmlFor="is-public" className="text-sm">
              Make document publicly accessible
            </Label>
          </div>

        </div>

        {/* Footer - Always visible */}
        <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t border-border bg-background mt-4">
          <Button variant="outline" onClick={onClose} disabled={isUploading} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || !documentName || !documentType || isUploading}
            data-testid="button-upload"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
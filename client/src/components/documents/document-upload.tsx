import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { insertDocumentSchema } from '@shared/schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, FileText, X, Calendar as CalendarIcon, Eye, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatDate, formatDateForInput } from '@/lib/utils';
import { z } from 'zod';

const documentFormSchema = insertDocumentSchema.extend({
  issueDate: z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  documentNumber: z.string().optional().or(z.literal('')),
  issuingAuthority: z.string().optional().or(z.literal('')),
  file: z.any().optional(),
});

type DocumentFormData = z.infer<typeof documentFormSchema>;

interface DocumentUploadProps {
  crewMemberId?: string;
  document?: any; // For editing existing documents
  preselectedType?: string; // Preselected document type
  onSuccess?: () => void;
}

const documentTypes = [
  { value: 'passport', label: 'Passport' },
  { value: 'cdc', label: 'CDC (Continuous Discharge Certificate)' },
  { value: 'coc', label: 'COC (Certificate of Competency)' },
  { value: 'medical', label: 'Medical Certificate' },
  { value: 'yellow_fever', label: 'Yellow Fever Vaccination' },
  { value: 'visa', label: 'Visa' },
  { value: 'aoa', label: 'AOA (Articles of Agreement)' },
  { value: 'photo', label: 'Photo' },
  { value: 'nok', label: 'NOK' },
  { value: 'coe', label: 'COE' },
  { value: 'coe-extension', label: 'COE-Extension' },
];

export default function DocumentUpload({ crewMemberId, document, preselectedType, onSuccess }: DocumentUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<DocumentFormData | null>(null);
  const [showReplaceUpload, setShowReplaceUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<any>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      type: document?.type || preselectedType || '',
      documentNumber: document?.documentNumber || '',
      issueDate: document?.issueDate ? formatDateForInput(document.issueDate) : '',
      expiryDate: document?.expiryDate ? formatDateForInput(document.expiryDate) : '',
      issuingAuthority: document?.issuingAuthority || '',
      status: document?.status || 'valid',
      crewMemberId: crewMemberId || '',
    },
  });

  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
    enabled: !crewMemberId && user?.role !== 'crew',
  });

  const watchCrewId = form.watch('crewMemberId');
  const targetId = crewMemberId || watchCrewId;

  const { data: currentTargetMember } = useQuery({
    queryKey: ['/api/crew', targetId],
    queryFn: async () => {
      const response = await fetch(`/api/crew/${targetId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew member');
      return response.json();
    },
    enabled: !!targetId,
  });

  const seafarerDisplayName = currentTargetMember
    ? `${currentTargetMember.firstName} ${currentTargetMember.lastName}`
    : '---';

  const { data: existingDocuments } = useQuery({
    queryKey: ['/api/documents', targetId],
    queryFn: async () => {
      const response = await fetch(`/api/documents?crewMemberId=${targetId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!targetId && !document,
  });

  const watchedType = form.watch('type');
  const isAoaDocument = watchedType === 'aoa';
  const isDateLocked = isAoaDocument && !!document && !selectedFile;

  // Auto-fill existing document data if available and not in edit mode
  useEffect(() => {
    if (watchedType && existingDocuments && !document) {
      const existingDoc = existingDocuments.find((doc: any) => doc.type === watchedType);
      if (existingDoc) {
        form.setValue('documentNumber', existingDoc.documentNumber || '');
        form.setValue('issueDate', existingDoc.issueDate ? formatDateForInput(existingDoc.issueDate) : '');
        form.setValue('expiryDate', existingDoc.expiryDate ? formatDateForInput(existingDoc.expiryDate) : '');
        form.setValue('issuingAuthority', existingDoc.issuingAuthority || '');
      }
    }
  }, [watchedType, existingDocuments, document, form]);

  const getCurrentCrewMemberId = () => {
    if (crewMemberId) return crewMemberId;
    if (user?.role === 'crew') {
      const currentMember = crewMembers?.find((member: any) => member.user?.id === user.id);
      return currentMember?.id;
    }
    const formValue = form.getValues('crewMemberId');
    return formValue || '';
  };

  const uploadMutation = useMutation({
    mutationFn: async ({ data, forceSave = false }: { data: DocumentFormData, forceSave?: boolean }) => {
      let filePath = document?.filePath || null;
      if (selectedFile) {
        setUploadProgress(25);
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });
        if (!uploadResponse.ok) throw new Error('Failed to upload file');
        setUploadProgress(75);
        const uploadData = await uploadResponse.json();
        filePath = uploadData.filePath;
      }
      setUploadProgress(85);
      const selectedCrewId = getCurrentCrewMemberId();
      if (!selectedCrewId) throw new Error('No crew member selected.');
      setUploadProgress(95);
      const payload = {
        ...data,
        crewMemberId: selectedCrewId,
        documentNumber: data.documentNumber || 'N/A',
        issueDate: data.issueDate ? new Date(data.issueDate + 'T00:00:00.000Z') : new Date(),
        expiryDate: data.expiryDate ? new Date(data.expiryDate + 'T00:00:00.000Z') : new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
        issuingAuthority: data.issuingAuthority || 'N/A',
        filePath,
        forceSave,
      };
      const isEditing = !!document;
      const response = isEditing
        ? await apiRequest('PUT', `/api/documents/${document.id}`, payload)
        : await apiRequest('POST', '/api/documents', payload);
      setUploadProgress(100);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/expiring-documents'] });
      toast({
        title: 'Success',
        description: document ? 'Document updated successfully' : 'Document uploaded successfully',
      });
      form.reset();
      setSelectedFile(null);
      setUploadProgress(0);
      onSuccess?.();
    },
    onError: (error: any) => {
      setUploadProgress(0);
      console.error("Upload error:", error);

      // Check if this is a validation error that can be overridden
      if (error.isValidationError) {
        setValidationError(error.details);
        setShowValidationDialog(true);
        return;
      }

      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DocumentFormData) => {
    if (document?.filePath && selectedFile) {
      setPendingData(data);
      setShowConfirmDialog(true);
      return;
    }
    setPendingData(data);
    uploadMutation.mutate({ data });
  };

  const confirmUpload = () => {
    if (pendingData) {
      uploadMutation.mutate({ data: pendingData });
      setShowConfirmDialog(false);
      setPendingData(null);
    }
  };

  const handleForceUpload = () => {
    if (pendingData) {
      uploadMutation.mutate({ data: pendingData, forceSave: true });
      setShowValidationDialog(false);
      setPendingData(null);
      setValidationError(null);
    }
  };

  const validateAndSetFile = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
      return false;
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Error', description: 'Only PDF, JPEG, and PNG files are allowed', variant: 'destructive' });
      return false;
    }
    setSelectedFile(file);
    return true;
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleViewDocument = async () => {
    if (!document?.id) return;
    try {
      const response = await fetch(`/api/documents/${document.id}/view`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to load document');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to open document.', variant: 'destructive' });
    }
  };

  // Handle global paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is in a text input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // If it's an input, only intercept if there's actually a file/image
        // being pasted (not just text)
        const hasFiles = e.clipboardData?.files && e.clipboardData.files.length > 0;
        const hasImageData = Array.from(e.clipboardData?.items || []).some(item => item.type.startsWith('image/'));

        if (!hasFiles && !hasImageData) return;
      }

      if (document?.filePath && !showReplaceUpload) return;

      // Try e.clipboardData.files first
      const pastedFiles = e.clipboardData?.files;
      if (pastedFiles && pastedFiles.length > 0) {
        e.preventDefault();
        validateAndSetFile(pastedFiles[0]);
        return;
      }

      // Fallback to e.clipboardData.items for screenshots/images
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              validateAndSetFile(file);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [document, showReplaceUpload, validateAndSetFile]);

  return (
    <div className="bg-background rounded-lg max-w-5xl mx-auto w-full max-h-[85vh] overflow-y-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Upload Document</h2>
            </div>
            {onSuccess && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onSuccess}
                className="h-8 w-8 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Left Column - Metadata Fields - Spans 5 columns */}
              <div className="lg:col-span-5 space-y-6">

                {/* Crew Member Selection (if applicable) */}
                {!crewMemberId && user?.role !== 'crew' && (
                  <FormField
                    control={form.control}
                    name="crewMemberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Crew Member *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!!document}>
                          <FormControl>
                            <SelectTrigger className="h-11 bg-background border-input">
                              <SelectValue placeholder="Select crew member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {crewMembers?.map((member: any) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.firstName} {member.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-muted-foreground">Document Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!document}>
                        <FormControl>
                          <SelectTrigger className="h-11 bg-background border-input">
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchedType !== 'photo' && watchedType !== 'nok' && (
                  <FormField
                    control={form.control}
                    name="documentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Document Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. MAH/MUM/327/2023"
                            className="h-11 bg-background border-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="space-y-2">
                  <FormLabel className="text-sm font-medium text-muted-foreground">Seafarer Name</FormLabel>
                  <div className="h-11 px-3 py-2 bg-muted/30 border border-input rounded-md flex items-center text-sm text-foreground">
                    {seafarerDisplayName}
                  </div>
                </div>

                {watchedType !== 'photo' && watchedType !== 'nok' && (
                  <FormField
                    control={form.control}
                    name="issuingAuthority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Issuing Authority</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              placeholder="e.g. DR. SUDHIR B. PATIL"
                              className="h-14 pb-4 bg-background border-input"
                            />
                            <span className="absolute bottom-1.5 left-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              (MANGALA DIAGNOSTIC CENTRE)
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Right Column - Dates & Upload - Spans 7 columns */}
              <div className="lg:col-span-7 space-y-8 pt-1">
                {/* Dynamic Title based on selection */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                  <h3 className="text-base font-medium text-foreground">
                    {watchedType ? documentTypes.find(t => t.value === watchedType)?.label : 'Document Details'}
                  </h3>
                </div>

                {/* Dates Row */}
                {watchedType !== 'photo' && watchedType !== 'nok' && (
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="issueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-sm font-medium text-muted-foreground mb-1.5">Issue Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "h-11 w-full pl-3 text-left font-normal border-input hover:bg-muted/50",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? formatDate(field.value) : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            {!isDateLocked && (
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => field.onChange(date ? formatDateForInput(date) : "")}
                                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            )}
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-sm font-medium text-muted-foreground mb-1.5">Expiry Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "h-11 w-full pl-3 text-left font-normal border-input hover:bg-muted/50",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? formatDate(field.value) : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            {!isDateLocked && (
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => field.onChange(date ? formatDateForInput(date) : "")}
                                  initialFocus
                                />
                              </PopoverContent>
                            )}
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <FormLabel className="text-sm font-medium text-muted-foreground">Document Number</FormLabel>
                  <div className="p-6 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/5 transition-colors hover:bg-muted/10 group relative">
                    {/* Upload Area */}
                    {(!document?.filePath || showReplaceUpload) ? (
                      <div
                        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) validateAndSetFile(file);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center text-center py-6 transition-all",
                          isDragging && "scale-[1.01]"
                        )}
                      >
                        <input
                          type="file"
                          onChange={handleFileChange}
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer flex flex-col items-center gap-4 w-full h-full"
                        >
                          <div className="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                          </div>

                          {selectedFile ? (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                              <p className="text-base font-semibold text-foreground">{selectedFile.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-7"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedFile(null);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-1">
                                <p className="text-lg font-medium text-foreground">
                                  Drag, Drop, Paste (Ctrl+V) or <span className="text-blue-600 dark:text-blue-400 hover:underline">Browse</span>
                                </p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                  PDF, JPG, PNG up to 5MB
                                </p>
                              </div>
                            </>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 bg-muted/10 rounded-lg">
                        <FileText className="h-10 w-10 text-blue-500 mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">Current Document</p>
                        <p className="text-xs text-muted-foreground mb-4 max-w-[200px] truncate">
                          {document.filePath.split('/').pop()?.replace(/^\d+-\d+-/, '')}
                        </p>
                        <div className="flex gap-3">
                          <Button variant="outline" size="sm" onClick={handleViewDocument} className="h-8">
                            <Eye className="h-3.5 w-3.5 mr-2" /> View
                          </Button>
                          <Button onClick={() => setShowReplaceUpload(true)} size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
                            Replace
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600 font-medium">Uploading...</span>
                      <span className="text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer - Actions */}
          <div className="mt-auto border-t border-border p-6 bg-muted/10">
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onSuccess}
                className="h-11 px-8 border-border hover:bg-muted font-medium"
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium"
                disabled={uploadMutation.isPending || (!selectedFile && !document)}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-amber-100 p-3 rounded-full w-fit mb-2">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Replace Document?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              You are about to override <span className="font-semibold text-foreground">{document?.type?.toUpperCase()}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3 pb-2">
            <AlertDialogCancel className="w-full sm:w-32 mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUpload}
              className="w-full sm:w-32 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Failure Dialog */}
      <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl text-red-600">Document Validation Failed</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-4">
              <p>
                The system detected a mismatch between your entries and the uploaded document.
              </p>

              {validationError?.isDoctorApprovalNumber && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-amber-800 dark:text-amber-300 text-xs text-left">
                  <p className="font-semibold mb-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Note on Doctor Approval Numbers
                  </p>
                  <p>
                    Document number <strong>{pendingData?.documentNumber}</strong> looks like a Doctor's Approval Number.
                    These are shared by many seafarers who visit the same doctor.
                  </p>
                </div>
              )}

              {validationError?.criticalErrors && validationError.criticalErrors.length > 0 && (
                <div className="text-left bg-muted/50 p-3 rounded-md border border-border text-xs">
                  <p className="font-semibold mb-2">Detected Discrepancies:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {validationError.criticalErrors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm font-medium">Are you sure the details you entered are correct according to the physical document?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center flex-col sm:flex-row gap-3 pt-2">
            <AlertDialogCancel className="w-full sm:w-1/2 mt-0">I'll Double Check</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceUpload}
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white"
            >
              Force Upload anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

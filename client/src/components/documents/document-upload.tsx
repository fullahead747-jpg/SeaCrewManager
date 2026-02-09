import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { insertDocumentSchema } from '@shared/schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, FileText, AlertCircle, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatDate, formatDateForInput } from '@/lib/utils';
import { z } from 'zod';
import { format } from 'date-fns';


// Helper to format dates for user-friendly display
function formatDateForDisplay(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  return formatDate(date);
}

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
];

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function DocumentUpload({ crewMemberId, document, preselectedType, onSuccess }: DocumentUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<DocumentFormData | null>(null);
  const [showReplaceUpload, setShowReplaceUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    mutationFn: async (data: DocumentFormData) => {
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
        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
        issuingAuthority: data.issuingAuthority || 'N/A',
        filePath,
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

      // Try to parse the error message if it looks like JSON
      let title = 'Error';
      let description: React.ReactNode = error.message || 'Failed to upload document';

      try {
        // The API client often wraps the error response. The actual 400 response body might be in error.message
        if (typeof error.message === 'string' && error.message.includes('{')) {
          // Extract the JSON part if there's a prefix like "400: "
          const jsonStart = error.message.indexOf('{');
          const jsonString = error.message.substring(jsonStart);
          const parsedError = JSON.parse(jsonString);

          if (parsedError.message) {
            title = 'Validation Failed';
            description = parsedError.message;

            if (parsedError.details?.criticalErrors?.length > 0) {
              description = (
                <div className="space-y-2">
                  <p>{parsedError.message}</p>
                  <ul className="list-disc pl-4 text-sm space-y-1 mt-2">
                    {parsedError.details.criticalErrors.map((err: string, idx: number) => (
                      <li key={idx} className="text-red-200">{err}</li>
                    ))}
                  </ul>
                </div>
              );
            }
          }
        }
      } catch (e) {
        // Fallback to simple message if parsing fails
        console.error("Failed to parse error message:", e);
      }

      toast({
        title: title,
        description: description,
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
    uploadMutation.mutate(data);
  };

  const confirmUpload = () => {
    if (pendingData) {
      uploadMutation.mutate(pendingData);
      setShowConfirmDialog(false);
      setPendingData(null);
    }
  };

  const validateAndSetFile = (file: File) => {
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
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-morphism p-1 rounded-[2rem] neon-border-blue cyber-scan relative"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-600/20 rounded-full border border-blue-400/50 shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                <Upload className="h-6 w-6 text-blue-400 neon-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white neon-text-blue tracking-tight">Upload Document</h2>
            </div>
            {onSuccess && (
              <button
                type="button"
                onClick={onSuccess}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {/* Left Column */}
            <div className="space-y-6">
              {!crewMemberId && user?.role !== 'crew' && (
                <FormField
                  control={form.control}
                  name="crewMemberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="neon-text-pink text-pink-400 font-bold mb-2 block uppercase text-xs tracking-widest">Crew Member *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!document}>
                        <FormControl>
                          <SelectTrigger className="h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-pink-500/50 focus:border-pink-500 shadow-inner">
                            <SelectValue placeholder="Select crew member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                          {crewMembers?.map((member: any) => (
                            <SelectItem key={member.id} value={member.id} className="hover:bg-blue-500/20">
                              {member.firstName} {member.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="neon-text-pink text-pink-400 font-bold mb-2 block uppercase text-xs tracking-widest">Document Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!document}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-pink-500/50 focus:border-pink-500 shadow-inner">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="hover:bg-blue-500/20">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {watchedType !== 'photo' && watchedType !== 'nok' && (
                <FormField
                  control={form.control}
                  name="documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-bold mb-2 block uppercase text-xs tracking-widest">Document Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter document number"
                          className="h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-blue-500/50 focus:border-blue-400 shadow-inner placeholder:text-white/50"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <div className="space-y-2">
                <FormLabel className="text-white font-bold mb-2 block uppercase text-xs tracking-widest">Seafarer Name</FormLabel>
                <Input
                  value={seafarerDisplayName}
                  readOnly
                  className="h-12 bg-white/5 border-white/5 text-white/80 rounded-xl cursor-not-allowed uppercase font-mono tracking-wider shadow-inner"
                />
              </div>

              {watchedType !== 'photo' && watchedType !== 'nok' && (
                <FormField
                  control={form.control}
                  name="issuingAuthority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-bold mb-2 block uppercase text-xs tracking-widest">Issuing Authority</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Maritime Authority"
                          className="h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-blue-500/50 focus:border-blue-400 shadow-inner placeholder:text-white/50"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {watchedType !== 'photo' && watchedType !== 'nok' && (
                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="issueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="neon-text-pink text-pink-400 font-bold mb-2 block uppercase text-xs tracking-widest">Issue Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-blue-500/50 focus:border-blue-500 shadow-inner color-scheme-dark hover:bg-slate-900/70 hover:text-white pl-10 text-left font-normal relative",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  formatDate(field.value)
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 transition-opacity pointer-events-none" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          {!isDateLocked && (
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? formatDateForInput(date) : "")}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                captionLayout="dropdown-buttons"
                                fromYear={1900}
                                toYear={new Date().getFullYear()}
                                initialFocus
                              />
                            </PopoverContent>
                          )}
                        </Popover>
                        {isDateLocked && (
                          <p className="text-[10px] text-pink-400 mt-1 font-bold animate-pulse">
                            Replace AOA document to change date
                          </p>
                        )}
                      </FormItem>
                    )}
                  />


                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="neon-text-pink text-pink-400 font-bold mb-2 block uppercase text-xs tracking-widest">Expiry Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "h-12 bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-blue-500/50 focus:border-blue-500 shadow-inner color-scheme-dark hover:bg-slate-900/70 hover:text-white pl-10 text-left font-normal relative",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  formatDate(field.value)
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 transition-opacity pointer-events-none" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          {!isDateLocked && (
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => field.onChange(date ? formatDateForInput(date) : "")}
                                captionLayout="dropdown-buttons"
                                fromYear={new Date().getFullYear()}
                                toYear={new Date().getFullYear() + 20}
                                initialFocus
                              />
                            </PopoverContent>
                          )}
                        </Popover>
                        {isDateLocked && (
                          <p className="text-[10px] text-pink-400 mt-1 font-bold animate-pulse">
                            Replace AOA document to change date
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* File Upload Area */}
              {(!document?.filePath || showReplaceUpload) && (
                <div className="space-y-4">
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
                    className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-500 relative overflow-hidden group ${isDragging ? 'border-pink-500 bg-pink-500/10' : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50'
                      }`}
                  >
                    <input type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-6">
                      <div className="p-6 bg-blue-500/20 rounded-full border border-blue-400/30 shadow-[0_0_20px_rgba(0,242,255,0.2)] group-hover:scale-110 transition-transform duration-500">
                        <Upload className="h-12 w-12 text-blue-400 neon-pulse" />
                      </div>
                      <div>
                        {selectedFile ? (
                          <div className="flex items-center space-x-3 bg-blue-500/20 px-6 py-3 rounded-full text-blue-200 border border-blue-400/50">
                            <FileText className="h-5 w-5" />
                            <span className="font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xl font-bold text-white tracking-wide">Drag files here <span className="text-blue-400">or Browse</span></p>
                            <p className="text-xs text-white/80 uppercase tracking-[0.2em]">PDF, JPG, PNG up to 5MB</p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {document?.filePath && !showReplaceUpload && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-3xl p-6 flex flex-col gap-6 shadow-[0_0_20px_rgba(0,100,255,0.1)]">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-600/30 p-4 rounded-2xl border border-blue-400/40">
                      <FileText className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-white truncate">
                        {document.filePath.split('/').pop()?.replace(/^\d+-\d+-/, '')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleViewDocument}
                      className="h-12 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold"
                    >
                      <Eye className="h-5 w-5 mr-2" /> View
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setShowReplaceUpload(true)}
                      className="h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 border-0"
                    >
                      <Upload className="h-5 w-5 mr-2" /> Replace
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-400 animate-pulse uppercase tracking-[0.2em]">Processing...</span>
                    <span className="font-bold text-white">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5 bg-white/5 [&>div]:bg-blue-500 shadow-[0_0_10px_rgba(0,242,255,0.3)]" />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-6 pt-10 border-t border-white/5">
            <Button
              type="button"
              variant="ghost"
              onClick={onSuccess}
              className="flex-1 h-16 rounded-2xl font-black uppercase tracking-widest border-2 border-pink-500/30 text-pink-400 hover:bg-pink-500 hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(255,0,127,0.1)] hover:shadow-[0_0_25px_rgba(255,0,127,0.3)]"
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="flex-[2] h-16 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all duration-300 shadow-[0_0_20px_rgba(0,100,255,0.3)] hover:shadow-[0_0_40px_rgba(0,100,255,0.5)] active:scale-95 border-0"
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-white/20 border-t-white" />
              ) : (
                <div className="flex items-center justify-center">
                  <Upload className="h-6 w-6 mr-4" />
                  {document ? 'SAVE CHANGES' : 'UPLOAD DOCUMENT'}
                </div>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-slate-950 border border-blue-500/30 rounded-[2rem] shadow-[0_0_50px_rgba(0,100,255,0.2)]">
          <AlertDialogHeader className="space-y-4">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 mx-auto border border-blue-400/30 shadow-[0_0_20px_rgba(0,242,255,0.2)]">
              <AlertCircle className="w-8 h-8 text-blue-400 neon-pulse" />
            </div>
            <AlertDialogTitle className="text-3xl font-black text-center text-white neon-text-blue uppercase tracking-tight">
              Replace Document?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white text-center text-lg leading-relaxed">
              You are about to override <span className="font-bold text-white">{document?.type?.toUpperCase()}</span>.
              <p className="mt-4 text-sm font-mono tracking-wider bg-white/5 p-4 rounded-xl border border-white/5">
                THIS WILL CREATE A SECURE NEW RECORD.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-4 mt-10">
            <AlertDialogCancel className="w-1/2 h-14 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl font-bold uppercase tracking-widest">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUpload}
              className="w-1/2 h-14 bg-blue-600 text-white hover:bg-blue-500 rounded-xl font-bold uppercase tracking-widest border-0 shadow-lg shadow-blue-500/20"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}


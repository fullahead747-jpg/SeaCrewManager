import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CrewMemberWithDetails } from '@shared/schema';
import { getAuthHeaders } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface BulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    crewMember: CrewMemberWithDetails | null;
    onSuccess?: () => void;
}

interface UploadFile {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
}

export const BulkUploadDialog: React.FC<BulkUploadDialogProps> = ({
    open,
    onOpenChange,
    crewMember,
    onSuccess
}) => {
    const { toast } = useToast();
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                status: 'pending' as const,
                progress: 0
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (!crewMember || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('crewMemberId', crewMember.id);

        files.forEach(f => {
            formData.append('files', f.file);
        });

        // Update all files to uploading status
        setFiles(prev => prev.map(f => ({ ...f, status: 'uploading', progress: 10 })));

        try {
            const response = await fetch('/api/documents/bulk', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            const data = await response.json();

            setFiles(prev => prev.map(f => ({ ...f, status: 'success', progress: 100 })));

            toast({
                title: 'Success',
                description: `Successfully uploaded ${files.length} documents for ${crewMember.firstName}.`,
            });

            setTimeout(() => {
                onOpenChange(false);
                setFiles([]);
                onSuccess?.();
            }, 1500);

        } catch (error: any) {
            console.error('Bulk upload error:', error);
            setFiles(prev => prev.map(f => ({
                ...f,
                status: 'error',
                error: error.message || 'Upload failed'
            })));

            toast({
                title: 'Upload Failed',
                description: error.message || 'There was an error uploading the documents.',
                variant: 'destructive'
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files).map(file => ({
                file,
                status: 'pending' as const,
                progress: 0
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !isUploading && onOpenChange(val)}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0 flex-none">
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-blue-600" />
                        Bulk Upload Documents
                    </DialogTitle>
                    <DialogDescription>
                        Upload multiple documents for {crewMember?.firstName} {crewMember?.lastName}.
                        Name your files (e.g., passport.pdf, medical.jpg) for auto-mapping.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Dropzone */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className={cn(
                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer",
                            "hover:bg-blue-50/50 hover:border-blue-300 border-slate-200",
                            isUploading && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => !isUploading && document.getElementById('bulk-file-input')?.click()}
                    >
                        <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                            <Upload className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">Click or drag files to upload</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 5MB each</p>
                        <input
                            id="bulk-file-input"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={onFileChange}
                            disabled={isUploading}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-2 pr-1">
                            {files.map((f, i) => (
                                <div key={i} className="flex flex-col p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-medium text-slate-700 truncate">{f.file.name}</span>
                                        </div>
                                        {!isUploading && f.status === 'pending' && (
                                            <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {f.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                        {f.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                    </div>
                                    {(f.status === 'uploading' || f.status === 'success') && (
                                        <Progress value={f.progress} className="h-1" />
                                    )}
                                    {f.error && <p className="text-[10px] text-red-500 mt-1">{f.error}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 flex-none border-t border-slate-100">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isUploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading || files.length === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            `Upload ${files.length} Files`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

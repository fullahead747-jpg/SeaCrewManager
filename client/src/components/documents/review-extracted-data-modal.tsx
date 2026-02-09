import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface ReviewExtractedDataModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    extractedData: {
        documentType: string;
        documentNumber?: string;
        issueDate?: string | Date;
        expiryDate?: string | Date;
        issuingAuthority?: string;
        holderName?: string;
    };
    ocrConfidence?: number;
    isExpiring?: boolean;
    daysRemaining?: number;
}

export function ReviewExtractedDataModal({
    open,
    onClose,
    onSave,
    extractedData,
    ocrConfidence = 0,
    isExpiring = false,
    daysRemaining,
}: ReviewExtractedDataModalProps) {
    const [editableData, setEditableData] = useState(extractedData);

    const handleSave = () => {
        onSave(editableData);
    };

    const formatDate = (date: string | Date | undefined) => {
        if (!date) return '';
        try {
            // If it's already a string in YYYY-MM-DD format, return it directly
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return date;
            }
            // Use UTC methods to avoid timezone shifts
            const d = typeof date === 'string' ? new Date(date) : date;
            if (isNaN(d.getTime())) return '';

            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return '';
        }
    };

    const formatDisplayDate = (date: string | Date | undefined) => {
        if (!date) return 'N/A';
        try {
            const d = typeof date === 'string' ? new Date(date) : date;
            return format(d, 'dd/MM/yyyy');
        } catch {
            return 'N/A';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="bg-green-100 p-3 rounded-full">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-gray-900">
                            Review Extracted Data
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-gray-600">
                        Data has been automatically extracted from the uploaded document.
                        Please review and edit if needed before saving.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* OCR Confidence Badge */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                                📄 Data extracted from uploaded document
                            </span>
                        </div>
                        {ocrConfidence > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                                {ocrConfidence}% confidence
                            </span>
                        )}
                    </div>

                    {/* Expiring Warning */}
                    {isExpiring && daysRemaining !== undefined && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm text-amber-800 font-medium">
                                ⚠️ This document expires in {daysRemaining} days. A renewal alert will be created.
                            </p>
                        </div>
                    )}

                    {/* Extracted Fields */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="documentType" className="text-gray-700 font-semibold">
                                    Document Type
                                </Label>
                                <Input
                                    id="documentType"
                                    value={editableData.documentType}
                                    disabled
                                    className="mt-1 bg-gray-50"
                                />
                            </div>

                            <div className="col-span-2">
                                <Label htmlFor="documentNumber" className="text-gray-700 font-semibold">
                                    Document Number *
                                </Label>
                                <Input
                                    id="documentNumber"
                                    value={editableData.documentNumber || ''}
                                    onChange={(e) => setEditableData({ ...editableData, documentNumber: e.target.value })}
                                    className="mt-1"
                                    placeholder="Enter document number"
                                />
                            </div>

                            <div>
                                <Label htmlFor="issueDate" className="text-gray-700 font-semibold">
                                    Issue Date *
                                </Label>
                                <Input
                                    id="issueDate"
                                    type="date"
                                    value={formatDate(editableData.issueDate)}
                                    onChange={(e) => setEditableData({ ...editableData, issueDate: e.target.value })}
                                    className="mt-1"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Extracted: {formatDisplayDate(extractedData.issueDate)}
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="expiryDate" className="text-gray-700 font-semibold">
                                    Expiry Date *
                                </Label>
                                <Input
                                    id="expiryDate"
                                    type="date"
                                    value={formatDate(editableData.expiryDate)}
                                    onChange={(e) => setEditableData({ ...editableData, expiryDate: e.target.value })}
                                    className="mt-1"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Extracted: {formatDisplayDate(extractedData.expiryDate)}
                                </p>
                            </div>

                            <div className="col-span-2">
                                <Label htmlFor="issuingAuthority" className="text-gray-700 font-semibold">
                                    Issuing Authority *
                                </Label>
                                <Input
                                    id="issuingAuthority"
                                    value={editableData.issuingAuthority || ''}
                                    onChange={(e) => setEditableData({ ...editableData, issuingAuthority: e.target.value })}
                                    className="mt-1"
                                    placeholder="Enter issuing authority"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm text-green-800">
                            ✓ Document is valid and ready to be saved
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >
                        Save Document
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

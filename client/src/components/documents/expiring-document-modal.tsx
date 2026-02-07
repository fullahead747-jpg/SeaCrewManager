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
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ExpiringDocumentModalProps {
    open: boolean;
    onClose: () => void;
    onProceed: () => void;
    documentType: string;
    documentNumber?: string;
    expiryDate: Date | string;
    daysRemaining: number;
}

export function ExpiringDocumentModal({
    open,
    onClose,
    onProceed,
    documentType,
    documentNumber,
    expiryDate,
    daysRemaining,
}: ExpiringDocumentModalProps) {
    const formattedDate = typeof expiryDate === 'string'
        ? format(new Date(expiryDate), 'dd/MM/yyyy')
        : format(expiryDate, 'dd/MM/yyyy');

    return (
        <AlertDialog open={open} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="bg-amber-100 p-3 rounded-full">
                            <AlertTriangle className="h-6 w-6 text-amber-600" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold text-amber-600">
                            Document Expiring Soon
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="space-y-4 pt-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="font-semibold text-gray-700">Document Type:</div>
                                <div className="text-gray-900 capitalize">{documentType}</div>

                                {documentNumber && (
                                    <>
                                        <div className="font-semibold text-gray-700">Document Number:</div>
                                        <div className="text-gray-900">{documentNumber}</div>
                                    </>
                                )}

                                <div className="font-semibold text-gray-700">Expiry Date:</div>
                                <div className="text-gray-900">{formattedDate}</div>

                                <div className="font-semibold text-gray-700">Status:</div>
                                <div className="text-amber-600 font-bold">
                                    Expires in {daysRemaining} days
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700 leading-relaxed">
                                This document will expire soon. Consider renewing it before upload
                                to avoid compliance issues.
                            </p>
                            <p className="mt-2 text-sm text-gray-600">
                                You can still upload it, but a renewal alert will be created.
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800 font-medium">
                                ⚠️ Do you want to proceed with upload?
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel
                        onClick={onClose}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onProceed}
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    >
                        Proceed Anyway
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

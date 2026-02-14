import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ExpiredDocumentModalProps {
    open: boolean;
    onClose: () => void;
    documentType: string;
    documentNumber?: string;
    expiryDate: Date | string;
    daysExpired: number;
}

export function ExpiredDocumentModal({
    open,
    onClose,
    documentType,
    documentNumber,
    expiryDate,
    daysExpired,
}: ExpiredDocumentModalProps) {
    const formattedDate = !expiryDate || (typeof expiryDate === 'string' && expiryDate.startsWith('1899'))
        ? "TBD"
        : typeof expiryDate === 'string'
            ? format(new Date(expiryDate), 'dd/MM/yyyy')
            : format(expiryDate, 'dd/MM/yyyy');

    const isTbd = formattedDate === "TBD" || daysExpired > 20000;

    return (
        <AlertDialog open={open} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="bg-red-100 p-3 rounded-full">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold text-red-600">
                            {isTbd ? "Document Expiry TBD" : "Cannot Upload Expired Document"}
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="space-y-4 pt-4">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
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
                                <div className={isTbd ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                                    {isTbd ? "To Be Decided" : `Expired`}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {isTbd
                                    ? "This document has a TBD expiry date. Please update it with a valid date when available."
                                    : "This document has expired and cannot be uploaded to the system. Expired documents could lead to:"}
                            </p>
                            <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                                <li>Non-compliant crew assignments</li>
                                <li>Legal/regulatory violations</li>
                                <li>Failed audits</li>
                            </ul>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800 font-medium">
                                📄 Please upload a valid, current document to proceed.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Button
                        onClick={onClose}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                        Close
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Heart, Ship, Award, Eye, Upload, Edit, Trash2, Download, Mail, Camera, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Document } from '@shared/schema';

interface DocumentCardDetailedProps {
    document: Document | null;
    documentType: 'passport' | 'medical' | 'cdc' | 'coc' | 'photo' | 'nok';
    allDocuments: Document[];
    onView?: () => void;
    onUpload?: () => void;
    onViewDocument?: (doc: Document) => void;
    onUploadDocument?: (type: string) => void;
    onEditDocument?: (doc: Document) => void;
    onDeleteDocument?: (doc: Document) => void;
}

const documentIcons = {
    passport: FileText,
    medical: Heart,
    cdc: Ship,
    coc: Award,
    photo: Camera,
    nok: Users,
};

const documentLabels = {
    passport: 'Passport',
    medical: 'Medical Certificate',
    cdc: 'CDC',
    coc: "Certificate of Competency",
    photo: 'Upload Photo',
    nok: 'NOK',
};

export function DocumentCardDetailed({ document, documentType, allDocuments, onView, onUpload, onViewDocument, onUploadDocument, onEditDocument, onDeleteDocument }: DocumentCardDetailedProps) {
    const Icon = documentIcons[documentType];
    const label = documentLabels[documentType];

    // Calculate progress percentage
    const getProgressPercentage = () => {
        if (!document?.expiryDate) return 0;

        const now = new Date();
        const expiry = new Date(document.expiryDate);
        const issue = document.issueDate ? new Date(document.issueDate) : new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());

        const totalDuration = expiry.getTime() - issue.getTime();
        const remaining = expiry.getTime() - now.getTime();

        return Math.max(0, Math.min(100, (remaining / totalDuration) * 100));
    };

    const getStatusInfo = () => {
        if (!document || !document.filePath) {
            return { label: 'Missing', color: 'bg-gray-400', textColor: 'text-gray-700' };
        }

        if (!document.expiryDate) {
            return { label: 'Valid', color: 'bg-green-500', textColor: 'text-green-700' };
        }

        const now = new Date();
        const expiry = new Date(document.expiryDate);
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
            return { label: 'Expired', color: 'bg-red-500', textColor: 'text-red-700' };
        } else if (daysUntilExpiry <= 30) {
            return { label: 'Expiring Soon', color: 'bg-orange-500', textColor: 'text-orange-700' };
        } else {
            return { label: 'Valid', color: 'bg-green-500', textColor: 'text-green-700' };
        }
    };

    const formatDate = (date: Date | string | null) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';

        // Use UTC methods to avoid timezone shifts
        const day = d.getUTCDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
        const year = d.getUTCFullYear();

        return `${day} ${month} ${year}`;
    };

    const progress = getProgressPercentage();
    const status = getStatusInfo();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
        >
            <Card className="p-6 h-full hover:shadow-xl transition-shadow border-gray-100 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${documentType === 'photo' ? 'bg-yellow-100' : 'bg-blue-100'
                            }`}>
                            <Icon className={`w-6 h-6 ${documentType === 'photo' ? 'text-yellow-600' : 'text-blue-600'
                                }`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">{label}</h3>
                        </div>
                    </div>
                    <Badge className={`${status.color} text-white`}>
                        {status.label}
                    </Badge>
                </div>

                {/* Document Details */}
                {document && document.filePath ? (
                    <>
                        {documentType !== 'photo' && documentType !== 'nok' && (
                            <>
                                <div className="space-y-2 mb-4">
                                    <div className="text-sm">
                                        <span className="text-gray-500 font-medium">Document:</span>
                                        <span className="ml-2 font-semibold text-gray-900">{document.documentNumber || 'N/A'}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-500 font-medium">Issued:</span>
                                        <span className="ml-2 text-gray-700">{formatDate(document.issueDate)}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-500 font-medium">Expires:</span>
                                        <span className="ml-2 text-gray-700 font-medium">{formatDate(document.expiryDate)}</span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {document.expiryDate && (
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wider">
                                            <span>Time remaining</span>
                                            <span>Until {formatDate(document.expiryDate)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                                className={`h-full rounded-full transition-all ${progress > 50 ? 'bg-blue-500' : progress > 20 ? 'bg-amber-500' : 'bg-rose-500'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-1 justify-center mt-auto border-t border-gray-50 pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 transition-colors"
                                onClick={() => document && onViewDocument?.(document)}
                                title="View"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-50 transition-colors"
                                onClick={() => document ? onEditDocument?.(document) : onUpload?.()}
                                title="Edit"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 transition-colors"
                                onClick={() => {
                                    // Email functionality - to be implemented
                                    console.log('Email document');
                                }}
                                title="Email"
                            >
                                <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-purple-600 hover:bg-purple-50 transition-colors"
                                onClick={() => {
                                    if (document?.filePath) {
                                        window.open(`/api/documents/${document.id}/download`, '_blank');
                                    }
                                }}
                                title="Download"
                                disabled={!document?.filePath}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 transition-colors"
                                onClick={() => {
                                    if (document) onDeleteDocument?.(document);
                                }}
                                title="Delete"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-6">
                        <p className="text-sm text-gray-400 italic mb-6">No document uploaded</p>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={onUpload}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                        </Button>
                    </div>
                )}
            </Card>
        </motion.div>
    );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { DocumentCardDetailed } from './document-card-detailed';
import type { CrewMember, Document } from '@shared/schema';

interface CrewDetailPanelProps {
    crew: CrewMember | null;
    documents: Document[];
    onDownloadAll?: () => void;
    onViewDocument?: (doc: Document) => void;
    onUploadDocument?: (type: string) => void;
    onEditDocument?: (doc: Document) => void;
    onDeleteDocument?: (doc: Document) => void;
}

export function CrewDetailPanel({ crew, documents, onDownloadAll, onViewDocument, onUploadDocument, onEditDocument, onDeleteDocument }: CrewDetailPanelProps) {
    if (!crew) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                    <p className="text-lg font-medium">Select a crew member</p>
                    <p className="text-sm">Choose from the list to view their documents</p>
                </div>
            </div>
        );
    }

    const getInitials = () => {
        return `${crew.firstName?.[0] || ''}${crew.lastName?.[0] || ''}`.toUpperCase();
    };

    const getDocument = (type: string) => {
        const docsOfType = documents.filter(d => d.type === type);
        if (docsOfType.length === 0) return null;

        // Prioritize documents with file paths
        const docsWithFiles = docsOfType.filter(d => d.filePath);
        if (docsWithFiles.length > 0) {
            // Return the most recently updated document with a file
            return docsWithFiles.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return dateB - dateA;
            })[0];
        }

        // If no documents have files, return the most recent one
        return docsOfType.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return dateB - dateA;
        })[0];
    };

    const formatDate = (date: Date | string | null) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        // Use UTC methods to avoid timezone shifts
        const day = d.getUTCDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
        const year = d.getUTCFullYear();

        return `${day} ${month} ${year}`;
    };

    return (
        <div className="h-full overflow-y-auto bg-gray-50">
            {/* Profile Header */}
            <div className="bg-white border-b border-gray-200 p-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-6">
                        {/* Large Avatar */}
                        <Avatar className="w-24 h-24 rounded-full bg-blue-500 flex-shrink-0">
                            {documents.find(d => d.crewMemberId === crew.id && d.type === 'photo' && d.filePath) && (
                                <AvatarImage
                                    src={`/${documents.find(d => d.crewMemberId === crew.id && d.type === 'photo' && d.filePath)?.filePath}`}
                                    alt={`${crew.firstName} ${crew.lastName}`}
                                    className="object-cover"
                                />
                            )}
                            <AvatarFallback className="text-white text-3xl font-semibold flex items-center justify-center">
                                {getInitials()}
                            </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                {crew.firstName} {crew.lastName}
                            </h1>
                            <p className="text-base text-gray-600 mb-3">{crew.rank}</p>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500">
                                    Vessel: <span className="font-medium text-gray-900">{(crew as any).currentVessel?.name || 'Unassigned'}</span>
                                </span>
                                <Badge
                                    variant="outline"
                                    className={`${crew.status === 'onBoard'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'
                                        }`}
                                >
                                    {crew.status === 'onBoard' ? 'On Board' : 'On Shore'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Download All Button */}
                    <Button variant="outline" onClick={onDownloadAll}>
                        <Download className="w-4 h-4 mr-2" />
                        Download All
                    </Button>
                </div>
            </div>

            {/* Document Cards */}
            <div className="p-8">
                <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: {
                            opacity: 1,
                            transition: {
                                staggerChildren: 0.1
                            }
                        }
                    }}
                    className="grid grid-cols-2 gap-6 mb-8"
                >
                    <DocumentCardDetailed
                        document={getDocument('passport')}
                        documentType="passport"
                        allDocuments={documents}
                        onView={() => {
                            const doc = getDocument('passport');
                            if (doc) onViewDocument?.(doc);
                        }}
                        onUpload={() => onUploadDocument?.('passport')}
                        onViewDocument={onViewDocument}
                        onUploadDocument={onUploadDocument}
                        onEditDocument={onEditDocument}
                        onDeleteDocument={onDeleteDocument}
                    />
                    <DocumentCardDetailed
                        document={getDocument('medical')}
                        documentType="medical"
                        allDocuments={documents}
                        onView={() => {
                            const doc = getDocument('medical');
                            if (doc) onViewDocument?.(doc);
                        }}
                        onUpload={() => onUploadDocument?.('medical')}
                        onViewDocument={onViewDocument}
                        onUploadDocument={onUploadDocument}
                    />
                    <DocumentCardDetailed
                        document={getDocument('cdc')}
                        documentType="cdc"
                        allDocuments={documents}
                        onView={() => {
                            const doc = getDocument('cdc');
                            if (doc) onViewDocument?.(doc);
                        }}
                        onUpload={() => onUploadDocument?.('cdc')}
                        onViewDocument={onViewDocument}
                        onUploadDocument={onUploadDocument}
                    />
                    <DocumentCardDetailed
                        document={getDocument('coc')}
                        documentType="coc"
                        allDocuments={documents}
                        onView={() => {
                            const doc = getDocument('coc');
                            if (doc) onViewDocument?.(doc);
                        }}
                        onUpload={() => onUploadDocument?.('coc')}
                        onViewDocument={onViewDocument}
                        onUploadDocument={onUploadDocument}
                    />
                    <DocumentCardDetailed
                        document={getDocument('photo')}
                        documentType="photo"
                        allDocuments={documents}
                        onView={() => {
                            const doc = getDocument('photo');
                            if (doc) onViewDocument?.(doc);
                        }}
                        onUpload={() => onUploadDocument?.('photo')}
                        onViewDocument={onViewDocument}
                        onUploadDocument={onUploadDocument}
                        onEditDocument={onEditDocument}
                        onDeleteDocument={onDeleteDocument}
                    />
                    <DocumentCardDetailed
                        document={getDocument('nok')}
                        documentType="nok"
                        allDocuments={documents}
                        onView={() => {
                            const doc = getDocument('nok');
                            if (doc) onViewDocument?.(doc);
                        }}
                        onUpload={() => onUploadDocument?.('nok')}
                        onViewDocument={onViewDocument}
                        onUploadDocument={onUploadDocument}
                        onEditDocument={onEditDocument}
                        onDeleteDocument={onDeleteDocument}
                    />
                </motion.div>

                {/* Document History */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Document History</h2>
                    <div className="space-y-4">
                        {documents
                            .filter(d => d.updatedAt)
                            .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
                            .slice(0, 5)
                            .map((doc, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-gray-400 mt-2" />
                                    <div>
                                        <p className="text-sm text-gray-900">
                                            {formatDate(doc.updatedAt)}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {doc.type.toUpperCase()} updated by Admin
                                        </p>
                                    </div>
                                </div>
                            ))}
                        {documents.filter(d => d.updatedAt).length === 0 && (
                            <p className="text-sm text-gray-400">No document history available</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

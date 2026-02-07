import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Upload, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import DocumentUpload from '@/components/documents/document-upload';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CrewMemberWithDetails, Document } from '@shared/schema';

// Required document types for all crew members
export const REQUIRED_DOCUMENTS = [
    { type: 'passport', label: 'Passport' },
    { type: 'cdc', label: 'CDC' },
    { type: 'coc', label: 'COC' },
    { type: 'medical', label: 'Medical Certificate' },
    { type: 'photo', label: 'Photo' },
    { type: 'nok', label: 'NOK' }
];

interface MissingDocumentsNotificationsProps {
    crewMembers: CrewMemberWithDetails[];
    documents: Document[];
    onUploadSuccess: () => void;
}

export default function MissingDocumentsNotifications({
    crewMembers,
    documents,
    onUploadSuccess
}: MissingDocumentsNotificationsProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
    const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [documentToUpdate, setDocumentToUpdate] = useState<any>(null); // Using any for Document type simplicity in this context

    // Calculate missing documents for each crew member
    const crewComplianceStatus = crewMembers.map(member => {
        const memberDocs = documents.filter(d => d.crewMemberId === member.id && d.status !== 'expired');

        // Check for each required document type
        const missingDocs = REQUIRED_DOCUMENTS.map(reqDoc => {
            // Prioritize documents with file paths to avoid placeholders showing as missing
            const existingDoc = memberDocs.find(d =>
                (d.type.toLowerCase() === reqDoc.type.toLowerCase() ||
                    (reqDoc.type === 'stcw' && d.type.toLowerCase().includes('coc'))) && d.filePath
            ) || memberDocs.find(d =>
                d.type.toLowerCase() === reqDoc.type.toLowerCase() ||
                (reqDoc.type === 'stcw' && d.type.toLowerCase().includes('coc'))
            );

            // Case 1: No document record at all
            if (!existingDoc) {
                return { ...reqDoc, status: 'missing', document: undefined };
            }

            // Case 2: Document record exists but no file uploaded
            if (!existingDoc.filePath) {
                return { ...reqDoc, status: 'pending_upload', document: existingDoc };
            }

            // Case 3: Compliant (Exists and has file)
            return null;
        }).filter((doc): doc is NonNullable<typeof doc> => doc !== null);

        return {
            member,
            missingDocs,
            isCompliant: missingDocs.length === 0
        };
    }).filter(status => !status.isCompliant); // Only show non-compliant crew

    // Sort by number of missing documents (descending)
    crewComplianceStatus.sort((a, b) => b.missingDocs.length - a.missingDocs.length);

    const handleUploadClick = (crewId: string, docType: string, document?: any) => {
        setSelectedCrewId(crewId);
        setSelectedDocType(docType);
        setDocumentToUpdate(document);
        setIsUploadModalOpen(true);
    };

    const handleUploadSuccess = () => {
        setIsUploadModalOpen(false);
        setDocumentToUpdate(null);
        onUploadSuccess();
    };

    if (crewMembers.length === 0) {
        return (
            <Card className="border-gray-200 bg-gray-50 mb-6 border-dashed">
                <CardContent className="pt-6 flex items-center justify-center text-gray-500">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span className="font-medium">No crew members found. Add crew to track documents.</span>
                </CardContent>
            </Card>
        );
    }

    if (crewComplianceStatus.length === 0) {
        return (
            <Card className="border-green-200 bg-green-50 mb-6">
                <CardContent className="pt-6 flex items-center justify-center text-green-700">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    <span className="font-medium">All crew members have required documents uploaded.</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-orange-200 bg-orange-50/50 mb-6 shadow-sm">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-4 px-6 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center space-x-2 text-orange-800">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle className="text-base font-semibold">
                            Pending Documents ({crewComplianceStatus.length} Crew)
                        </CardTitle>
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0 hover:bg-orange-100 text-orange-800">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="sr-only">Toggle notifications</span>
                        </Button>
                    </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="px-6 pb-6 pt-0">
                        <div className="space-y-4 mt-2">
                            {crewComplianceStatus.map(({ member, missingDocs }) => (
                                <div key={member.id} className="bg-white rounded-lg border border-orange-100 p-4 shadow-sm">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start justify-between w-full">
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
                                                <div className="flex items-center text-sm text-gray-500 mt-1 space-x-2">
                                                    <Badge variant="outline" className="text-xs bg-gray-50 px-1.5 py-0 h-5">{member.rank}</Badge>
                                                    <span className="text-xs truncate max-w-[120px]" title={member.currentVessel?.name || 'Unassigned'}>
                                                        {member.currentVessel?.name || 'Unassigned'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 w-full">
                                            {missingDocs.map(doc => (
                                                <Button
                                                    key={`${member.id}-${doc.type}`}
                                                    variant="outline"
                                                    size="sm"
                                                    className={`w-full justify-start h-8 ${doc.status === 'pending_upload' ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50 hover:bg-yellow-50' : 'border-orange-300 text-orange-700 bg-orange-50/30 hover:bg-orange-50'}`}
                                                    onClick={() => handleUploadClick(member.id, doc.type, doc.document)}
                                                >
                                                    <Upload className="h-3.5 w-3.5 mr-2 shrink-0" />
                                                    <span className="truncate">
                                                        {doc.status === 'pending_upload' ? `Upload File: ${doc.label}` : `Upload ${doc.label}`}
                                                    </span>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>

            <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
                    {selectedCrewId && selectedDocType && (
                        <DocumentUpload
                            crewMemberId={selectedCrewId}
                            preselectedType={selectedDocType}
                            document={documentToUpdate}
                            onSuccess={handleUploadSuccess}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}


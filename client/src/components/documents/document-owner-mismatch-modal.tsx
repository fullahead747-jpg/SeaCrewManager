import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface DocumentOwnerMismatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    extractedName: string | null;
    expectedName: string;
    similarity: number;
    documentType: string;
}

export function DocumentOwnerMismatchModal({
    isOpen,
    onClose,
    extractedName,
    expectedName,
    similarity,
    documentType,
}: DocumentOwnerMismatchModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Document Owner Mismatch</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                This document appears to belong to a different person
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-medium text-red-900 mb-2">
                            The uploaded {documentType} document does not match the crew member's name.
                        </p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-red-700 font-medium">Expected:</span>
                                <span className="text-red-900 font-semibold">{expectedName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-700 font-medium">Found:</span>
                                <span className="text-red-900 font-semibold">
                                    {extractedName || "Unable to extract"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-700 font-medium">Match:</span>
                                <span className="text-red-900 font-semibold">{similarity}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium">This could mean:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>The document belongs to a different crew member</li>
                            <li>The document was uploaded to the wrong profile</li>
                            <li>There is a significant error in the document</li>
                        </ul>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-amber-900">
                            <strong>Action Required:</strong> Please verify you have selected the correct document
                            for this crew member. Upload the correct document or contact your administrator if you
                            believe this is an error.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose} variant="default" className="w-full sm:w-auto">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

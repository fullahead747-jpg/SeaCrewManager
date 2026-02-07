import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DocumentOwnerWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    extractedName: string | null;
    expectedName: string;
    similarity: number;
    documentType: string;
}

export function DocumentOwnerWarningModal({
    isOpen,
    onClose,
    onConfirm,
    extractedName,
    expectedName,
    similarity,
    documentType,
}: DocumentOwnerWarningModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                            <AlertTriangle className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Verify Document Owner</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                Please confirm this document belongs to the correct person
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-medium text-amber-900 mb-2">
                            The name on the {documentType} document may not match the crew member's name.
                        </p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-amber-700 font-medium">Expected:</span>
                                <span className="text-amber-900 font-semibold">{expectedName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-amber-700 font-medium">Found:</span>
                                <span className="text-amber-900 font-semibold">
                                    {extractedName || "Unable to extract"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-amber-700 font-medium">Match:</span>
                                <span className="text-amber-900 font-semibold">{similarity}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-medium">This could be due to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Minor spelling variations in the name</li>
                            <li>OCR reading errors from the document scan</li>
                            <li>Different name formats (e.g., middle name included/excluded)</li>
                            <li>The document may belong to a different person</li>
                        </ul>
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-sm text-blue-900">
                            <strong>Please verify:</strong> Check the physical document to confirm it belongs to{" "}
                            <strong>{expectedName}</strong>. If you're certain the document is correct, you can
                            proceed. Otherwise, upload the correct document.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button onClick={onClose} variant="outline">
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} variant="default">
                        Confirm Correct
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

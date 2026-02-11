
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Printer, X } from "lucide-react";
import { CrewMemberWithDetails, Vessel } from "@shared/schema";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";

interface AOAViewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    crewMember: CrewMemberWithDetails | null;
    vessels: Vessel[];
}

export function AOAViewDialog({
    open,
    onOpenChange,
    crewMember,
    vessels,
}: AOAViewDialogProps) {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `AOA-${crewMember?.lastName}-${crewMember?.firstName}`,
    });

    if (!crewMember) return null;

    // Find the vessel details if not populated in crewMember
    const vessel = crewMember.currentVessel || vessels.find(v => v.id === crewMember.currentVesselId);
    const contract = crewMember.activeContract;

    // Helper to safely format dates
    const safeDate = (date: any) => {
        if (!date) return "N/A";
        return formatDate(date);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white">
                {/* Header with Actions */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50 sticky top-0 z-10">
                    <div>
                        <DialogTitle className="text-xl font-bold text-gray-900">
                            Articles of Agreement
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500">
                            Standard Maritime Agreement for {crewMember.firstName} {crewMember.lastName}
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrint()}
                            className="gap-2"
                        >
                            <Printer className="h-4 w-4" />
                            Print / Save PDF
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="p-8 print:p-0" ref={componentRef}>
                    <div className="max-w-[210mm] mx-auto bg-white min-h-[297mm] relative p-8 md:p-12 print:shadow-none shadow-lg my-4 print:my-0 border print:border-0 border-gray-200">

                        {/* Document Header */}
                        <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
                            <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-900 mb-2">
                                ARTICLES OF AGREEMENT
                            </h1>
                            <p className="text-sm font-medium text-gray-600 uppercase tracking-widest">
                                Between the Master and Seamen in the Merchant Service
                            </p>
                        </div>

                        {/* Vessel Particulars */}
                        <div className="mb-8">
                            <h2 className="text-sm font-bold uppercase bg-gray-100 p-2 mb-4 border border-gray-300">
                                1. Vessel Particulars
                            </h2>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Name of Vessel:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{vessel?.name || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">IMO Number:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{vessel?.imoNumber || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Port of Registry:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{vessel?.flag || 'N/A'}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Type:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{vessel?.type || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Crew Particulars */}
                        <div className="mb-8">
                            <h2 className="text-sm font-bold uppercase bg-gray-100 p-2 mb-4 border border-gray-300">
                                2. Seafarer Particulars
                            </h2>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Full Name:</span>
                                    <span className="font-mono text-gray-900 col-span-2 uppercase">
                                        {crewMember.lastName}, {crewMember.firstName}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Rank / Rating:</span>
                                    <span className="font-mono text-gray-900 col-span-2 uppercase">{crewMember.rank}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Nationality:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{crewMember.nationality}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Date of Birth:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{safeDate(crewMember.dateOfBirth)}</span>
                                </div>

                                {/* Documents */}
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Passport No:</span>
                                    <span className="font-mono text-gray-900 col-span-2">
                                        {crewMember.documents?.find(d => d.type === 'passport')?.documentNumber || 'N/A'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">CDC No:</span>
                                    <span className="font-mono text-gray-900 col-span-2">
                                        {crewMember.documents?.find(d => d.type === 'cdc')?.documentNumber || 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Next of Kin */}
                        <div className="mb-8">
                            <h2 className="text-sm font-bold uppercase bg-gray-100 p-2 mb-4 border border-gray-300">
                                3. Next of Kin Details
                            </h2>
                            {crewMember.emergencyContact ? (
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                    <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                        <span className="font-semibold text-gray-600 col-span-1">Name:</span>
                                        <span className="font-mono text-gray-900 col-span-2">{(crewMember.emergencyContact as any).name}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                        <span className="font-semibold text-gray-600 col-span-1">Relationship:</span>
                                        <span className="font-mono text-gray-900 col-span-2">{(crewMember.emergencyContact as any).relationship}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2 col-span-2">
                                        <span className="font-semibold text-gray-600 col-span-1">Address:</span>
                                        <span className="font-mono text-gray-900 col-span-2">{(crewMember.emergencyContact as any).postalAddress || 'N/A'}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No Next of Kin details available.</p>
                            )}
                        </div>

                        {/* Employment Terms */}
                        <div className="mb-8">
                            <h2 className="text-sm font-bold uppercase bg-gray-100 p-2 mb-4 border border-gray-300">
                                4. Terms of Employment
                            </h2>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Commencement:</span>
                                    <span className="font-mono text-gray-900 col-span-2">{safeDate(contract?.startDate)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Duration:</span>
                                    <span className="font-mono text-gray-900 col-span-2">
                                        {contract?.durationDays ? `${contract.durationDays} Days (+/- 30 Days)` : 'N/A'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Basic Wages:</span>
                                    <span className="font-mono text-gray-900 col-span-2">
                                        {contract?.salary ? `${contract.currency || 'USD'} ${contract.salary}` : 'As per CBA'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                                    <span className="font-semibold text-gray-600 col-span-1">Place of Engagement:</span>
                                    <span className="font-mono text-gray-900 col-span-2">
                                        {vessel?.name ? `On Board ${vessel.name}` : 'Company Office'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="mt-16">
                            <div className="grid grid-cols-2 gap-16 text-sm">
                                <div className="text-center">
                                    <div className="border-b border-gray-900 mb-2 h-16 flex items-end justify-center pb-2">
                                        <span className="font-script text-2xl text-gray-600 opacity-50">Signed Digitally</span>
                                    </div>
                                    <p className="font-bold uppercase text-gray-800">Signature of Seafarer</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        I confirm having received a copy of this agreement.
                                    </p>
                                </div>

                                <div className="text-center">
                                    <div className="border-b border-gray-900 mb-2 h-16 flex items-end justify-center pb-2">
                                        <span className="font-script text-2xl text-gray-600 opacity-50">Authorized Signatory</span>
                                    </div>
                                    <p className="font-bold uppercase text-gray-800">For and on behalf of Owner/Master</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Date: {safeDate(contract?.startDate || new Date())}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-gray-400">
                            <p>Generated by SeaCrew Manager • Page 1 of 1</p>
                            <p>This document is electronically generated and holds validity as per company policy.</p>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

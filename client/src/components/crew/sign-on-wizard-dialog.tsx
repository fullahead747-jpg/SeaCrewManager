import { useState, useEffect } from 'react';
import { differenceInDays, addDays, format as formatDate } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChevronRight,
    ChevronLeft,
    FileText,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Ship,
    Calendar,
    User,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignOnWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    crewMember: any;
    vessels: any[];
    onSubmit: (data: SignOnData) => void;
    isSubmitting: boolean;
}

interface SignOnData {
    vesselId: string;
    startDate: string;
    duration: string;
    endDate: string;
    reason: string;
    profileUpdates?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
        rank?: string;
        nationality?: string;
        emergencyContact?: {
            name?: string;
            relationship?: string;
            phone?: string;
            email?: string;
            postalAddress?: string;
        };
    };
}

type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'missing' | 'runway_alert' | 'contract_block';

export default function SignOnWizardDialog({
    open,
    onOpenChange,
    crewMember,
    vessels,
    onSubmit,
    isSubmitting
}: SignOnWizardDialogProps) {
    // Wizard state
    const [currentStep, setCurrentStep] = useState(1);
    const [direction, setDirection] = useState(0);

    // Contract state
    const [useTemplate, setUseTemplate] = useState(false);
    const [vesselId, setVesselId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [duration, setDuration] = useState('90');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    // Document state
    const [documentsVerified, setDocumentsVerified] = useState(false);
    const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

    // Profile & NOK Update state
    const [profileUpdates, setProfileUpdates] = useState<any>({});
    const [nokUpdates, setNokUpdates] = useState<any>({});
    const [editingSection, setEditingSection] = useState<'profile' | 'nok' | null>(null);

    // Initialize state from crew member
    useEffect(() => {
        if (crewMember) {
            setProfileUpdates({
                firstName: crewMember.firstName,
                lastName: crewMember.lastName,
                email: crewMember.email || '',
                phoneNumber: crewMember.phoneNumber || '',
                rank: crewMember.rank,
                nationality: crewMember.nationality
            });
            setNokUpdates({
                name: crewMember.emergencyContact?.name || '',
                relationship: crewMember.emergencyContact?.relationship || '',
                phone: crewMember.emergencyContact?.phone || '',
                email: crewMember.emergencyContact?.email || '',
                postalAddress: crewMember.emergencyContact?.postalAddress || ''
            });
        }
    }, [crewMember]);

    // Get previous contract
    const previousContract = crewMember?.contracts
        ?.filter((c: any) => c.status === 'completed')
        ?.sort((a: any, b: any) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

    // Get documents
    const documents = crewMember?.documents || [];
    const passport = documents.find((d: any) => d.type === 'passport');
    const cdc = documents.find((d: any) => d.type === 'cdc');
    const coc = documents.find((d: any) => d.type === 'coc');
    const medical = documents.find((d: any) => d.type === 'medical');

    // Document status helper
    const getDocumentStatus = (doc: any, contractEndDate?: string): DocumentStatus => {
        if (!doc || !doc.filePath) return 'missing';

        const expiryDate = new Date(doc.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysUntilExpiry = differenceInDays(expiryDate, today);

        if (daysUntilExpiry < 0) return 'expired';
        if (daysUntilExpiry <= 30) return 'expiring';

        // Check against contract end date if provided
        if (contractEndDate) {
            const end = new Date(contractEndDate);
            const bufferDate = addDays(end, 30);

            if (expiryDate < end) return 'contract_block';
            if (expiryDate < bufferDate) return 'runway_alert';
        }

        // General runway alert (industry best practice)
        if (daysUntilExpiry <= 180) return 'runway_alert';

        return 'valid';
    };

    const statusConfig = {
        valid: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', text: 'Valid' },
        runway_alert: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', text: 'Low Runway' },
        expiring: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', text: 'Expiring Soon' },
        expired: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', text: 'Expired' },
        contract_block: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', text: 'Contract Conflict' },
        missing: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', text: 'Missing' }
    };

    // Check for expired or blocking documents
    const getBlockers = () => {
        const criticalTypes = ['passport', 'cdc', 'medical'];
        if (profileUpdates.rank && isOfficer(profileUpdates.rank)) {
            criticalTypes.push('coc');
        }

        return criticalTypes.filter(type => {
            const doc = documents.find((d: any) => d.type === type);
            const status = getDocumentStatus(doc, endDate);
            return status === 'expired' || status === 'expiring' || status === 'contract_block';
        });
    };

    const hasBlockedDocs = getBlockers().length > 0;

    const isOfficer = (rank: string | null | undefined): boolean => {
        if (!rank) return false;
        const officerRanks = ['captain', 'master', 'chief officer', 'second officer', 'third officer', 'chief engineer', 'second engineer', 'third engineer', 'fourth engineer', 'officer', 'mate'];
        return officerRanks.some(r => rank.toLowerCase().includes(r));
    };

    // Check for runway alerts on critical documents
    const hasRunwayAlertDocs = ['passport', 'cdc', 'medical'].some(type => {
        const doc = documents.find((d: any) => d.type === type);
        return getDocumentStatus(doc, endDate) === 'runway_alert';
    });

    // Calculate end date
    useEffect(() => {
        if (startDate && duration) {
            const start = new Date(startDate);
            const end = addDays(start, parseInt(duration));
            setEndDate(formatDate(end, 'yyyy-MM-dd'));
        }
    }, [startDate, duration]);

    // Handle template checkbox
    const handleUseTemplate = (checked: boolean) => {
        setUseTemplate(checked);
        if (checked && previousContract) {
            setVesselId(previousContract.vesselId);
            const durationDays = differenceInDays(
                new Date(previousContract.endDate),
                new Date(previousContract.startDate)
            );
            setDuration(durationDays.toString());
        } else {
            setVesselId('');
            setDuration('90');
        }
    };

    // Validation
    const step1Valid = vesselId && startDate && duration && reason.trim().length >= 10;
    const step2Valid = documentsVerified && !hasBlockedDocs;

    // Navigation
    const handleNext = () => {
        if (currentStep < 3) {
            setDirection(1);
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setDirection(-1);
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = () => {
        // Prepare profile updates if they differ from original
        const updates: any = {};
        const hasProfileChanges = Object.keys(profileUpdates).some(key => profileUpdates[key] !== crewMember[key]);

        const originalNok = crewMember.emergencyContact || {};
        const hasNokChanges = Object.keys(nokUpdates).some(key => nokUpdates[key] !== originalNok[key]);

        if (hasProfileChanges) {
            Object.assign(updates, profileUpdates);
        }

        if (hasNokChanges) {
            updates.emergencyContact = {
                ...(crewMember.emergencyContact || {}),
                ...nokUpdates
            };
        }

        onSubmit({
            vesselId,
            startDate,
            duration,
            endDate,
            reason,
            profileUpdates: Object.keys(updates).length > 0 ? updates : undefined
        });
    };

    // Reset on close
    const handleClose = () => {
        setCurrentStep(1);
        setUseTemplate(false);
        setVesselId('');
        setStartDate('');
        setDuration('90');
        setEndDate('');
        setReason('');
        setDocumentsVerified(false);
        setExpandedDocs(new Set());
        setProfileUpdates({});
        setNokUpdates({});
        setEditingSection(null);
        onOpenChange(false);
    };

    // Toggle document expansion
    const toggleDocExpansion = (docType: string) => {
        const newExpanded = new Set(expandedDocs);
        if (newExpanded.has(docType)) {
            newExpanded.delete(docType);
        } else {
            newExpanded.add(docType);
        }
        setExpandedDocs(newExpanded);
    };

    // View document
    const handleViewDocument = async (doc: any) => {
        if (doc?.filePath) {
            try {
                const response = await fetch(`/api/documents/${doc.id}/view`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch document');
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');

                // Clean up after a delay
                setTimeout(() => window.URL.revokeObjectURL(url), 100);
            } catch (error) {
                console.error('Error viewing document:', error);
                alert('Failed to open document. Please try again.');
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Sign On Crew Member
                    </DialogTitle>
                    <DialogDescription>
                        {crewMember && `${crewMember.firstName} ${crewMember.lastName} - ${crewMember.rank}`}
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center my-6">
                    <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            {currentStep > 1 ? '✓' : '1'}
                        </div>
                        <span className="text-sm font-medium">Contract</span>
                    </div>
                    <div className={`w-16 h-0.5 mx-2 ${currentStep > 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            {currentStep > 2 ? '✓' : '2'}
                        </div>
                        <span className="text-sm font-medium">Documents</span>
                    </div>
                    <div className={`w-16 h-0.5 mx-2 ${currentStep > 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                            3
                        </div>
                        <span className="text-sm font-medium">Confirm</span>
                    </div>
                </div>

                {/* Step Content */}
                <div className="relative overflow-hidden min-h-[400px]">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            variants={{
                                enter: (direction: number) => ({
                                    x: direction > 0 ? 50 : -50,
                                    opacity: 0
                                }),
                                center: {
                                    zIndex: 1,
                                    x: 0,
                                    opacity: 1
                                },
                                exit: (direction: number) => ({
                                    zIndex: 0,
                                    x: direction < 0 ? 50 : -50,
                                    opacity: 0
                                })
                            }}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="space-y-6"
                        >
                            {/* Step 1: Contract Details */}
                            {currentStep === 1 && (
                                <div className="space-y-6 pt-1">
                                    {/* Previous Contract Card */}
                                    {previousContract && (
                                        <Card className="bg-blue-50 border-blue-200">
                                            <CardHeader>
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Ship className="h-4 w-4" />
                                                    Previous Contract
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-1">
                                                <p><span className="font-medium">Vessel:</span> {vessels.find(v => v.id === previousContract.vesselId)?.name || 'Unknown'}</p>
                                                <p><span className="font-medium">Period:</span> {formatDate(new Date(previousContract.startDate), 'MMM dd, yyyy')} - {formatDate(new Date(previousContract.endDate), 'MMM dd, yyyy')}</p>
                                                <p><span className="font-medium">Duration:</span> {differenceInDays(new Date(previousContract.endDate), new Date(previousContract.startDate))} days</p>

                                                <div className="flex items-center space-x-2 pt-3 border-t border-blue-200 mt-3">
                                                    <Checkbox
                                                        id="use-template"
                                                        checked={useTemplate}
                                                        onCheckedChange={handleUseTemplate}
                                                    />
                                                    <Label htmlFor="use-template" className="text-sm cursor-pointer">
                                                        Use as template for new contract
                                                    </Label>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Vessel Selection */}
                                    <div className="space-y-2">
                                        <Label htmlFor="vessel">Assign to Vessel <span className="text-red-500">*</span></Label>
                                        <Select value={vesselId} onValueChange={setVesselId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a vessel" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vessels?.map((vessel: any) => {
                                                    const crewCount = vessel.crewMembers?.length || 0;
                                                    const capacity = vessel.maxCrew || 20;
                                                    return (
                                                        <SelectItem key={vessel.id} value={vessel.id}>
                                                            {vessel.name} ({vessel.type}) - {crewCount}/{capacity} crew
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Contract Dates */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="start-date">Contract Start Date <span className="text-red-500">*</span></Label>
                                            <Input
                                                id="start-date"
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                min={formatDate(new Date(), 'yyyy-MM-dd')}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="duration">Duration <span className="text-red-500">*</span></Label>
                                            <Select value={duration} onValueChange={setDuration}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="30">30 Days (~1 month)</SelectItem>
                                                    <SelectItem value="60">60 Days (~2 months)</SelectItem>
                                                    <SelectItem value="90">90 Days (~3 months)</SelectItem>
                                                    <SelectItem value="120">120 Days (~4 months)</SelectItem>
                                                    <SelectItem value="180">180 Days (~6 months)</SelectItem>
                                                    <SelectItem value="270">270 Days (~9 months)</SelectItem>
                                                    <SelectItem value="365">365 Days (1 year)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* End Date */}
                                    <div className="space-y-2">
                                        <Label htmlFor="end-date">Contract End Date</Label>
                                        <Input
                                            id="end-date"
                                            type="date"
                                            value={endDate}
                                            readOnly
                                            disabled
                                            className="bg-gray-50"
                                        />
                                        <p className="text-xs text-gray-500">Auto-calculated based on start date and duration</p>
                                    </div>

                                    {/* Reason */}
                                    <div className="space-y-2">
                                        <Label htmlFor="reason">Reason for Status Change <span className="text-red-500">*</span></Label>
                                        <textarea
                                            id="reason"
                                            className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            placeholder="Enter the reason for signing on this crew member (minimum 10 characters)"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500">{reason.length}/10 characters minimum</p>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Document Verification */}
                            {currentStep === 2 && (
                                <div className="space-y-4 pt-1">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h3 className="font-medium text-blue-900 mb-2">📄 Document Verification Required</h3>
                                        <p className="text-sm text-blue-700">
                                            Please review all seafarer details and documents before proceeding. Update any information that has changed.
                                        </p>
                                    </div>

                                    {/* Section 1: Seafarer Details */}
                                    <Card className={`border-2 ${editingSection === 'profile' ? 'border-blue-600 bg-white' : 'border-blue-200 bg-blue-50/30'}`}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                                                        <User className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base text-blue-900">Seafarer Information</CardTitle>
                                                        <CardDescription>Review and verify personal details</CardDescription>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={editingSection === 'profile' ? 'secondary' : 'outline'}
                                                    onClick={() => setEditingSection(editingSection === 'profile' ? null : 'profile')}
                                                    className={editingSection === 'profile' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
                                                >
                                                    {editingSection === 'profile' ? 'Done Updating' : 'Edit Details'}
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {editingSection === 'profile' ? (
                                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2">
                                                        <Label>First Name</Label>
                                                        <Input
                                                            value={profileUpdates.firstName}
                                                            onChange={e => setProfileUpdates({ ...profileUpdates, firstName: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Last Name</Label>
                                                        <Input
                                                            value={profileUpdates.lastName}
                                                            onChange={e => setProfileUpdates({ ...profileUpdates, lastName: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Email</Label>
                                                        <Input
                                                            type="email"
                                                            value={profileUpdates.email}
                                                            onChange={e => setProfileUpdates({ ...profileUpdates, email: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Phone Number</Label>
                                                        <Input
                                                            value={profileUpdates.phoneNumber}
                                                            onChange={e => setProfileUpdates({ ...profileUpdates, phoneNumber: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Rank</Label>
                                                        <Input
                                                            value={profileUpdates.rank}
                                                            onChange={e => setProfileUpdates({ ...profileUpdates, rank: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Nationality</Label>
                                                        <Input
                                                            value={profileUpdates.nationality}
                                                            onChange={e => setProfileUpdates({ ...profileUpdates, nationality: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-blue-600" />
                                                        <span className="font-medium text-gray-900">{profileUpdates.firstName} {profileUpdates.lastName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase className="h-4 w-4 text-blue-600" />
                                                        <span className="text-gray-700">{profileUpdates.rank}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4 text-blue-600" />
                                                        <span className="text-gray-700">{profileUpdates.email || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-4 w-4 text-blue-600" />
                                                        <span className="text-gray-700">{profileUpdates.phoneNumber || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Section 2: Next of Kin */}
                                    <Card className={`border-2 ${editingSection === 'nok' ? 'border-orange-600 bg-white' : 'border-orange-200 bg-orange-50/30'}`}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white">
                                                        <Heart className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base text-orange-900">Next of Kin (NOK)</CardTitle>
                                                        <CardDescription>Emergency contact information</CardDescription>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={editingSection === 'nok' ? 'secondary' : 'outline'}
                                                    onClick={() => setEditingSection(editingSection === 'nok' ? null : 'nok')}
                                                    className={editingSection === 'nok' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : ''}
                                                >
                                                    {editingSection === 'nok' ? 'Done Updating' : 'Edit NOK Details'}
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {editingSection === 'nok' ? (
                                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2">
                                                        <Label>Full Name</Label>
                                                        <Input
                                                            value={nokUpdates.name}
                                                            onChange={e => setNokUpdates({ ...nokUpdates, name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Relationship</Label>
                                                        <Input
                                                            value={nokUpdates.relationship}
                                                            onChange={e => setNokUpdates({ ...nokUpdates, relationship: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Phone</Label>
                                                        <Input
                                                            value={nokUpdates.phone}
                                                            onChange={e => setNokUpdates({ ...nokUpdates, phone: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Email</Label>
                                                        <Input
                                                            type="email"
                                                            value={nokUpdates.email}
                                                            onChange={e => setNokUpdates({ ...nokUpdates, email: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="col-span-2 space-y-2">
                                                        <Label>Postal Address</Label>
                                                        <Input
                                                            value={nokUpdates.postalAddress}
                                                            onChange={e => setNokUpdates({ ...nokUpdates, postalAddress: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-orange-600" />
                                                        <span className="font-medium text-gray-900">{nokUpdates.name || 'Not provided'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Heart className="h-4 w-4 text-orange-600" />
                                                        <span className="text-gray-700">{nokUpdates.relationship || 'Relationship N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-4 w-4 text-orange-600" />
                                                        <span className="text-gray-700">{nokUpdates.phone || 'Phone N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 text-orange-600" />
                                                        <span className="text-gray-700 truncate">{nokUpdates.postalAddress || 'Address N/A'}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Divider for Documents */}
                                    <div className="relative py-4">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-white px-2 text-muted-foreground font-medium">Documents Review</span>
                                        </div>
                                    </div>

                                    {/* Document Cards */}
                                    {[
                                        { type: 'passport', doc: passport, label: 'Passport', icon: '🛂' },
                                        { type: 'cdc', doc: cdc, label: 'CDC (Continuous Discharge Certificate)', icon: '📋' },
                                        { type: 'coc', doc: coc, label: 'COC (Certificate of Competency)', icon: '📜' },
                                        { type: 'medical', doc: medical, label: 'Medical Certificate', icon: '🏥' }
                                    ].map(({ type, doc, label, icon }) => {
                                        const status = getDocumentStatus(doc, endDate);
                                        const config = statusConfig[status];
                                        const Icon = config.icon;
                                        const isExpanded = expandedDocs.has(type);
                                        const daysUntilExpiry = doc?.expiryDate ? differenceInDays(new Date(doc.expiryDate), new Date()) : null;

                                        return (
                                            <Card key={type} className={`${config.bg} border-2 ${config.border}`}>
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-2xl">{icon}</span>
                                                            <div>
                                                                <CardTitle className="text-base">{label}</CardTitle>
                                                                {doc && daysUntilExpiry !== null && (
                                                                    <CardDescription className={config.color}>
                                                                        {status === 'expired' ? 'Expired' :
                                                                            status === 'contract_block' ? `Expires during contract (on ${formatDate(new Date(doc.expiryDate), 'MMM dd, yyyy')})` :
                                                                                status === 'runway_alert' ? `Low Runway (${daysUntilExpiry} days remaining)` :
                                                                                    status === 'expiring' ? `Expiring Soon (${daysUntilExpiry} days remaining)` :
                                                                                        `Valid for ${daysUntilExpiry} days`}
                                                                    </CardDescription>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={`${config.color} ${config.bg}`}>
                                                                <Icon className="h-3 w-3 mr-1" />
                                                                {config.text}
                                                            </Badge>
                                                            {doc?.filePath && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleViewDocument(doc)}
                                                                >
                                                                    <FileText className="h-4 w-4 mr-1" />
                                                                    View
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => toggleDocExpansion(type)}
                                                            >
                                                                {isExpanded ? '▲' : '▼'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>

                                                {isExpanded && doc && (
                                                    <CardContent className="pt-0">
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="font-medium text-gray-600">Document Number</p>
                                                                <p className="text-gray-900">{doc.documentNumber || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-600">Issuing Authority</p>
                                                                <p className="text-gray-900">{doc.issuingAuthority || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-600">Issue Date</p>
                                                                <p className="text-gray-900">{doc.issueDate ? formatDate(new Date(doc.issueDate), 'MMM dd, yyyy') : 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-600">Expiry Date</p>
                                                                <p className={`font-medium ${status === 'expired' ? 'text-red-600' : (status === 'expiring' || status === 'runway_alert') ? 'text-orange-600' : 'text-green-600'}`}>
                                                                    {doc.expiryDate ? formatDate(new Date(doc.expiryDate), 'MMM dd, yyyy') : 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        );
                                    })}

                                    {/* Blocked Documents Warning */}
                                    {hasBlockedDocs && (
                                        <Card className="bg-red-50 border-2 border-red-200">
                                            <CardContent className="pt-6">
                                                <div className="flex items-start gap-3">
                                                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-medium text-red-900">Sign-On Blocked - Document Compliance</h4>
                                                        <div className="text-sm text-red-700 mt-2 space-y-2">
                                                            <p>You cannot sign on this crew member due to the following document issues:</p>
                                                            <ul className="list-disc pl-5 space-y-1">
                                                                {getBlockers().map(type => {
                                                                    const doc = documents.find((d: any) => d.type === type);
                                                                    const status = getDocumentStatus(doc, endDate);
                                                                    const label = type.toUpperCase();
                                                                    const expiryStr = doc?.expiryDate ? formatDate(new Date(doc.expiryDate), 'MMM dd, yyyy') : 'N/A';

                                                                    if (status === 'expired') return <li key={type}><strong>{label}</strong> has expired (on {expiryStr})</li>;
                                                                    if (status === 'expiring') return <li key={type}><strong>{label}</strong> is expiring soon (within 30 days)</li>;
                                                                    if (status === 'contract_block') return <li key={type}><strong>{label}</strong> expires during the contract (on {expiryStr})</li>;
                                                                    return null;
                                                                })}
                                                            </ul>
                                                            <p className="font-medium mt-2 text-red-800 underline">Please update these documents before proceeding.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Runway Alert Warning */}
                                    {hasRunwayAlertDocs && !hasBlockedDocs && (
                                        <Card className="bg-orange-50 border-2 border-orange-200">
                                            <CardContent className="pt-6">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-medium text-orange-900">Notice: Tight Contract Runway</h4>
                                                        <p className="text-sm text-orange-700 mt-1">
                                                            Some documents are valid but expire within 30 days of the contract end. While technically eligible, renewal planning is strongly recommended.
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Verification Checkbox */}
                                    {!hasBlockedDocs && (
                                        <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <Checkbox
                                                id="verify-docs"
                                                checked={documentsVerified}
                                                onCheckedChange={(checked) => setDocumentsVerified(checked as boolean)}
                                            />
                                            <Label htmlFor="verify-docs" className="text-sm cursor-pointer leading-relaxed">
                                                I have reviewed all documents and confirm they are valid for this contract period
                                            </Label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Confirmation */}
                            {currentStep === 3 && (
                                <div className="space-y-4 pt-1">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                Review & Confirm
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Crew Info */}
                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-2">Crew Member Details</h4>
                                                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground uppercase">Basic Information</p>
                                                        <p className="text-base font-semibold">{profileUpdates.firstName} {profileUpdates.lastName}</p>
                                                        <p className="text-sm text-gray-600">{profileUpdates.rank}</p>
                                                    </div>
                                                    {Object.keys(nokUpdates).some(k => nokUpdates[k]) && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground uppercase">Next of Kin</p>
                                                            <p className="text-sm font-medium">{nokUpdates.name}</p>
                                                            <p className="text-xs text-gray-500">{nokUpdates.relationship}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Contract Info */}
                                            <div className="border-t pt-4">
                                                <h4 className="font-medium text-gray-700 mb-2">New Assignment</h4>
                                                <div className="space-y-2 text-sm">
                                                    <p><span className="font-medium">Vessel:</span> {vessels.find(v => v.id === vesselId)?.name}</p>
                                                    <p><span className="font-medium">Start Date:</span> {startDate ? formatDate(new Date(startDate), 'MMM dd, yyyy') : ''}</p>
                                                    <p><span className="font-medium">End Date:</span> {endDate ? formatDate(new Date(endDate), 'MMM dd, yyyy') : ''}</p>
                                                    <p><span className="font-medium">Duration:</span> {duration} days</p>
                                                </div>
                                            </div>

                                            {/* Documents Status */}
                                            <div className="border-t pt-4">
                                                <h4 className="font-medium text-gray-700 mb-2">Documents Status</h4>
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                    <span className="text-sm font-medium text-green-700">All documents verified</span>
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            <div className="border-t pt-4">
                                                <h4 className="font-medium text-gray-700 mb-2">Reason for Status Change</h4>
                                                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{reason}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-between pt-6 border-t">
                    <motion.div whileTap={{ scale: 0.98 }}>
                        <Button
                            variant="outline"
                            onClick={currentStep === 1 ? handleClose : handleBack}
                            disabled={isSubmitting}
                        >
                            {currentStep === 1 ? (
                                'Cancel'
                            ) : (
                                <>
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back
                                </>
                            )}
                        </Button>
                    </motion.div>

                    {currentStep < 3 ? (
                        <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                                onClick={handleNext}
                                disabled={currentStep === 1 ? !step1Valid : !step2Valid}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isSubmitting ? 'Signing On...' : 'Confirm Sign On'}
                            </Button>
                        </motion.div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

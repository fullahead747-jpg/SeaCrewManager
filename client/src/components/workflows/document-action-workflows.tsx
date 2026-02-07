import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Ship, User, FileText, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { CrewMember, Document } from "@shared/schema";

interface DocumentActionWorkflowsProps {
    isOpen: boolean;
    onClose: () => void;
    crewMember: CrewMember;
    document: Document;
    initialTab?: 'renewal' | 'replacement' | 'extension';
}

export function DocumentActionWorkflows({
    isOpen,
    onClose,
    crewMember,
    document,
    initialTab = 'renewal'
}: DocumentActionWorkflowsProps) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [step, setStep] = useState(1);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Form states
    const [renewalPort, setRenewalPort] = useState("");
    const [renewalDate, setRenewalDate] = useState<Date>();
    const [extensionDays, setExtensionDays] = useState("30");
    const [extensionReason, setExtensionReason] = useState("");

    const handleRenewal = async () => {
        // In a real app, this would call an API to create a task/workflow
        toast({
            title: "Renewal Workflow Started",
            description: `Scheduled renewal for ${document.type.toUpperCase()} at ${renewalPort} on ${format(renewalDate!, 'PP')}.`,
        });
        onClose();
    };

    const handleReplacement = async () => {
        toast({
            title: "Crew Change Initiated",
            description: `Replacement search started for ${crewMember.firstName} ${crewMember.lastName}.`,
        });
        onClose();
    };

    const handleExtension = async () => {
        toast({
            title: "Extension Request Submitted",
            description: `Requested ${extensionDays} day extension for ${document.type.toUpperCase()}. Awaiting approval.`,
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl sm:max-w-3xl">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-6 gap-1 px-2 font-medium">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            Compliance Workflow
                        </Badge>
                    </div>
                    <DialogTitle className="text-xl">
                        Compliance Action: {crewMember.firstName} {crewMember.lastName}
                    </DialogTitle>
                    <DialogDescription>
                        Document expiring: {document.type.toUpperCase()} ({document.documentNumber}) on {format(new Date(document.expiryDate!), 'PP')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-4">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                        <TabsTrigger value="renewal" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Port Renewal
                        </TabsTrigger>
                        <TabsTrigger value="replacement" className="gap-2">
                            <User className="h-4 w-4" />
                            Crew Change
                        </TabsTrigger>
                        <TabsTrigger value="extension" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Extension
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-6 min-h-[300px]">
                        <TabsContent value="renewal" className="m-0 space-y-4">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Target Port</Label>
                                        <Select value={renewalPort} onValueChange={setRenewalPort}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select upcoming port" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="singapore">Singapore (ETA 15-Feb)</SelectItem>
                                                <SelectItem value="rotterdam">Rotterdam (ETA 28-Feb)</SelectItem>
                                                <SelectItem value="dubai">Dubai (ETA 10-Mar)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Appointment Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !renewalDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {renewalDate ? format(renewalDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={renewalDate}
                                                    onSelect={setRenewalDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="rounded-lg bg-blue-50/50 p-4 border border-blue-100">
                                    <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-2">
                                        <Ship className="h-4 w-4" />
                                        Renewal Information
                                    </h4>
                                    <ul className="text-xs text-blue-800 space-y-2">
                                        <li>• Estimated port stay: 36 hours</li>
                                        <li>• Local agent: Wilhelmsen Ships Service</li>
                                        <li>• Document required: Original Passport, Photo</li>
                                        <li>• System will auto-clear alerts upon file upload</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <Button variant="outline" onClick={onClose}>Cancel</Button>
                                <Button onClick={handleRenewal} disabled={!renewalPort || !renewalDate}>
                                    Schedule Renewal
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="replacement" className="m-0 space-y-4">
                            <div className="space-y-4">
                                <div className="rounded-lg bg-amber-50/50 p-4 border border-amber-100 mb-4">
                                    <div className="flex gap-3">
                                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-amber-900">Sign-off Requirement</h4>
                                            <p className="text-sm text-amber-800">
                                                This document expires during the current contract. If renewal is not possible,
                                                the seafarer must sign off at the next suitable port (Singapore).
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Replacement Type</Label>
                                    <Select defaultValue="equal">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="equal">Standard Relief (Same Rank)</SelectItem>
                                            <SelectItem value="promotion">Relief with Promotion</SelectItem>
                                            <SelectItem value="emergency">Emergency Gapping</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                                        <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Automatic Search</p>
                                        <p className="text-xs text-slate-500">System will filter available pool for compliant candidates</p>
                                    </div>
                                    <Button variant="outline" size="sm">Search Pool</Button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <Button variant="outline" onClick={onClose}>Cancel</Button>
                                <Button onClick={handleReplacement}>Initiate Replacement</Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="extension" className="m-0 space-y-4">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Extension Requested (Days)</Label>
                                        <Select value={extensionDays} onValueChange={setExtensionDays}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="7">7 Days (At-sea Grace)</SelectItem>
                                                <SelectItem value="15">15 Days</SelectItem>
                                                <SelectItem value="30">30 Days (Maximum)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Reason for Extension</Label>
                                    <Input
                                        placeholder="e.g. Delayed port call, No access to authorities"
                                        value={extensionReason}
                                        onChange={(e) => setExtensionReason(e.target.value)}
                                    />
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                                    <h4 className="text-sm font-medium mb-3">Approval Workflow Required</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                            </div>
                                            <span className="text-xs text-slate-600">Document Validation (Passed)</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                                                <div className="h-2 w-2 rounded-full bg-slate-400" />
                                            </div>
                                            <span className="text-xs text-slate-600">Technical Superintendent Approval</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                                                <div className="h-2 w-2 rounded-full bg-slate-400" />
                                            </div>
                                            <span className="text-xs text-slate-600">Flag State Authorization</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <Button variant="outline" onClick={onClose}>Cancel</Button>
                                <Button onClick={handleExtension} disabled={!extensionReason}>
                                    Submit Extension Request
                                </Button>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

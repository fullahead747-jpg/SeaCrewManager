import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { Loader2, Upload, Check, AlertCircle, FileText, Trash2, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AttendanceUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function AttendanceUploadDialog({ open, onOpenChange }: AttendanceUploadDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedCrew, setExtractedCrew] = useState<any[]>([]);
    const [selectedVessel, setSelectedVessel] = useState<string>('');
    const [commonExpiryDate, setCommonExpiryDate] = useState<string>('');
    const [step, setStep] = useState<'upload' | 'review'>('upload');

    const { data: vessels } = useQuery({
        queryKey: ['/api/vessels'],
        queryFn: async () => {
            const response = await fetch('/api/vessels', { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch vessels');
            return response.json();
        },
    });

    const formatDateForInput = (dateStr: string) => {
        if (!dateStr || dateStr === 'NONE') return '';
        try {
            // Try DD-MM-YYYY
            const ddmmyyyy = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
            if (ddmmyyyy) {
                return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
            }
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            return d.toISOString().split('T')[0];
        } catch {
            return '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const processFile = async () => {
        if (!file) return;
        setIsProcessing(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Data = reader.result as string;
                const response = await fetch('/api/attendance/upload', {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        base64Data,
                        filename: file.name
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to extract data');
                }
                const data = await response.json();

                // Pre-format dates for input fields
                const formattedCrew = data.crew.map((row: any) => ({
                    ...row,
                    joinDate: formatDateForInput(row.joinDate),
                    expiryDate: ''
                }));

                setExtractedCrew(formattedCrew);
                setStep('review');
                setIsProcessing(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast({
                title: 'Extraction Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
            setIsProcessing(false);
        }
    };

    const bulkSaveMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/attendance/bulk-save', {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    crewItems: extractedCrew,
                    vesselId: selectedVessel,
                    commonExpiryDate
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save data');
            }
            return response.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

            toast({
                title: 'Success',
                description: `Bulk saved ${data.results.length} crew members. ${data.errors.length} errors.`,
            });
            onOpenChange(false);
            reset();
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to save',
                variant: 'destructive',
            });
        }
    });

    const reset = () => {
        setFile(null);
        setExtractedCrew([]);
        setStep('upload');
        setSelectedVessel('');
        setCommonExpiryDate('');
    };

    const handleUpdateRow = (index: number, field: string, value: string) => {
        const updated = [...extractedCrew];
        updated[index][field] = value;
        setExtractedCrew(updated);
    };

    const handleRemoveRow = (index: number) => {
        setExtractedCrew(extractedCrew.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            onOpenChange(val);
        }}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <div className="p-6 pb-0">
                    <DialogHeader>
                        <div className="flex items-center space-x-2">
                            <ShieldCheck className="h-6 w-6 text-blue-600" />
                            <DialogTitle className="text-xl">Smart Attendance Sync</DialogTitle>
                        </div>
                        <DialogDescription className="mt-1">
                            Upload monthly attendance sheets to automatically create crew profiles, update assignments, and generate contracts.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-4">
                    {step === 'upload' ? (
                        <div className="space-y-6">
                            <div className="group border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-16 text-center hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer relative">
                                <input
                                    type="file"
                                    id="attendance-file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                    accept=".pdf,image/*"
                                />
                                <div className="space-y-4">
                                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Upload className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-foreground">
                                            {file ? file.name : 'Drop your attendance sheet here'}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            PDF, JPG or PNG (Max 10MB)
                                        </p>
                                    </div>
                                    {file && (
                                        <Badge variant="secondary" className="px-3 py-1">
                                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {file && (
                                <div className="flex flex-col items-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <Button
                                        onClick={processFile}
                                        disabled={isProcessing}
                                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[240px] h-12 text-lg shadow-lg shadow-blue-200 dark:shadow-none"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                                Analyzing with AI...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="mr-2 h-5 w-5" />
                                                Start Intelligent Scan
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-muted-foreground flex items-center">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Existing crew members will be matched automatically by Name + Rank
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold flex items-center">
                                        <Check className="h-4 w-4 mr-2 text-blue-600" />
                                        Confirm Vessel
                                    </Label>
                                    <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                                        <SelectTrigger className="bg-white dark:bg-gray-950">
                                            <SelectValue placeholder="Which vessel is this sheet for?" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vessels?.map((v: any) => (
                                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold flex items-center">
                                        <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
                                        Default Expiry Date
                                    </Label>
                                    <Input
                                        type="date"
                                        value={commonExpiryDate}
                                        onChange={(e) => setCommonExpiryDate(e.target.value)}
                                        className="bg-white dark:bg-gray-950"
                                    />
                                    <p className="text-[10px] text-muted-foreground pl-1">Applied to new crew if not specified individually</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="font-semibold text-foreground flex items-center">
                                        <Users className="h-4 w-4 mr-2" />
                                        Detected Crew Members ({extractedCrew.length})
                                    </h3>
                                    <div className="flex space-x-4 text-xs">
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                                            <span>Existing in DB</span>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                            <span>New Member</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader className="bg-gray-50 dark:bg-gray-900">
                                            <TableRow>
                                                <TableHead className="w-[100px]">Match</TableHead>
                                                <TableHead>Full Name</TableHead>
                                                <TableHead>Rank</TableHead>
                                                <TableHead>Join Date</TableHead>
                                                <TableHead>COC N/A</TableHead>
                                                <TableHead>Expiry Date</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {extractedCrew.map((row, index) => (
                                                <TableRow key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                                    <TableCell>
                                                        {row.matchStatus === 'existing' ? (
                                                            <div className="flex items-center text-blue-600 font-medium text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full w-fit">
                                                                <Check className="h-3 w-3 mr-1" /> Match
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center text-green-600 font-medium text-xs bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full w-fit">
                                                                <FileText className="h-3 w-3 mr-1" /> New
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={row.name}
                                                            onChange={(e) => handleUpdateRow(index, 'name', e.target.value)}
                                                            className="h-9 border-transparent focus:border-blue-500 hover:border-gray-200 transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={row.rank}
                                                            onChange={(e) => handleUpdateRow(index, 'rank', e.target.value)}
                                                            className="h-9 border-transparent focus:border-blue-500 hover:border-gray-200 transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="date"
                                                            value={row.joinDate}
                                                            onChange={(e) => handleUpdateRow(index, 'joinDate', e.target.value)}
                                                            className="h-9 border-transparent focus:border-blue-500 hover:border-gray-200 transition-colors"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            checked={row.cocNotApplicable || false}
                                                            onChange={(e) => handleUpdateRow(index, 'cocNotApplicable', e.target.checked as any)}
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="date"
                                                            value={row.expiryDate || commonExpiryDate}
                                                            disabled={row.cocNotApplicable}
                                                            onChange={(e) => handleUpdateRow(index, 'expiryDate', e.target.value)}
                                                            className={`h-9 border-transparent focus:border-blue-500 hover:border-gray-200 transition-colors ${row.cocNotApplicable ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveRow(index)}
                                                            className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {extractedCrew.length === 0 && (
                                        <div className="text-center py-12 text-muted-foreground">
                                            No crew members detected. Please check the document quality.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
                    {step === 'review' ? (
                        <>
                            <Button variant="ghost" onClick={() => setStep('upload')} className="w-full sm:w-auto">
                                Back to Upload
                            </Button>
                            <div className="flex w-full sm:w-auto space-x-3">
                                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => bulkSaveMutation.mutate()}
                                    disabled={bulkSaveMutation.isPending || !selectedVessel}
                                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none"
                                >
                                    {bulkSaveMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Confirm & Sync All
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex w-full justify-end">
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                Close
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


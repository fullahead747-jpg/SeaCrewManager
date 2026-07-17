import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { format, subWeeks } from 'date-fns';
import { Loader2, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { downloadFileFromResponse } from '@/lib/file-utils';

interface WeeklyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WeeklyReportModal({ isOpen, onClose }: WeeklyReportModalProps) {
    const { toast } = useToast();
    const [reportType, setReportType] = useState<string>('sign-on');
    const [startDate, setStartDate] = useState<string>(subWeeks(new Date(), 1).toISOString());
    const [endDate, setEndDate] = useState<string>(new Date().toISOString());
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!startDate || !endDate) {
            toast({
                title: "Validation Error",
                description: "Please select both start and end dates.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsGenerating(true);
            const query = new URLSearchParams({
                type: reportType,
                startDate,
                endDate
            });

            const response = await fetch(`/api/export/weekly-report?${query.toString()}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to generate report');
            }

            const fileName = `Weekly_${reportType === 'sign-on' ? 'Sign_On' : 'Signed_Off'}_Report_${format(new Date(startDate), 'yyyy-MM-dd')}_to_${format(new Date(endDate), 'yyyy-MM-dd')}.pdf`;
            await downloadFileFromResponse(response, fileName);

            toast({
                title: 'Report Generated',
                description: 'The weekly report has been downloaded successfully.',
            });
            onClose();
        } catch (error: any) {
            console.error('Report generation error:', error);
            toast({
                title: 'Generation Failed',
                description: error.message || 'Unable to generate the report. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Generate Weekly Report
                    </DialogTitle>
                    <DialogDescription>
                        Select the report type and date range to generate a PDF report of crew movements.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="report-type">Report Type</Label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger id="report-type">
                                <SelectValue placeholder="Select report type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sign-on">Sign On Crew</SelectItem>
                                <SelectItem value="sign-off">Signed Off Crew</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Start Date</Label>
                        <DatePicker
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Select start date"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>End Date</Label>
                        <DatePicker
                            value={endDate}
                            onChange={setEndDate}
                            placeholder="Select end date"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isGenerating}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Generate PDF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

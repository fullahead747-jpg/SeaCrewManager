import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useFormContext, useWatch } from 'react-hook-form';
import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { downloadFileFromResponse, openSecureView } from '@/lib/file-utils';
import { DatePicker } from '@/components/ui/date-picker';

interface ContractSectionProps {
    crewMember?: any;
}

export function ContractSection({ crewMember }: ContractSectionProps) {
    const form = useFormContext();
    const { toast } = useToast();

    // Helper to calculate end date from start date and duration in days
    const calculateEndDateFromDuration = (startDateStr: string | undefined, durationVal: number | string | undefined) => {
        if (!startDateStr || !durationVal || Number(durationVal) <= 0) return '';
        const cleanDate = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const start = new Date(Date.UTC(year, month, day));
            if (isNaN(start.getTime())) return '';
            const end = new Date(start.getTime() + Number(durationVal) * 24 * 60 * 60 * 1000);
            return end.toISOString().split('T')[0];
        }
        const start = new Date(cleanDate + 'T00:00:00Z');
        if (isNaN(start.getTime())) return '';
        const end = new Date(start.getTime() + Number(durationVal) * 24 * 60 * 60 * 1000);
        return end.toISOString().split('T')[0];
    };

    // Reactively watch both inputs so end date recalculates whenever either changes
    const watchedStartDate = useWatch({ control: form.control, name: 'contractStartDate' });
    const watchedDuration = useWatch({ control: form.control, name: 'contractDurationDays' });
    // Watch end date directly so the DatePicker display always reflects the latest value
    const watchedEndDate = useWatch({ control: form.control, name: 'contractEndDate' });

    useEffect(() => {
        const newEndDate = calculateEndDateFromDuration(watchedStartDate, watchedDuration);
        if (newEndDate && newEndDate !== form.getValues('contractEndDate')) {
            form.setValue('contractEndDate', newEndDate, { shouldDirty: true, shouldValidate: true });
        }
    }, [watchedStartDate, watchedDuration]);

    const handleViewContract = async () => {
        if (!crewMember?.activeContract?.id) return;

        try {
            // First, try to get a secure view token
            const tokenResponse = await fetch(`/api/contracts/${crewMember.activeContract.id}/view-token`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (tokenResponse.ok) {
                const { viewUrl } = await tokenResponse.json();
                openSecureView(viewUrl);
                return;
            }

            // Fallback to traditional method if token fails
            const response = await fetch(`/api/contracts/${crewMember.activeContract.id}/view`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch document');
            }
            await downloadFileFromResponse(response, `AOA_${crewMember.firstName}_${crewMember.lastName}.pdf`);
        } catch (error) {
            console.error('Error viewing contract:', error);
            toast({
                title: 'Error',
                description: 'Failed to open contract document',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Contract Information
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="contractStartDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contract Start Date</FormLabel>
                            <FormControl>
                                <DatePicker
                                    {...field}
                                    onChange={(val) => {
                                        field.onChange(val);
                                        const currentDuration = form.getValues('contractDurationDays');
                                        const newEndDate = calculateEndDateFromDuration(val, currentDuration);
                                        if (newEndDate) {
                                            form.setValue('contractEndDate', newEndDate, { shouldDirty: true, shouldValidate: true });
                                        }
                                    }}
                                    className="bg-white dark:bg-gray-950"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="contractDurationDays"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Duration (Days)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="e.g., 90"
                                    {...field}
                                    value={field.value !== undefined && field.value !== null ? field.value : 90}
                                    className="bg-white dark:bg-gray-950"
                                    onChange={(e) => {
                                        const rawVal = e.target.value;
                                        const duration = parseInt(rawVal, 10);
                                        field.onChange(isNaN(duration) ? rawVal : duration);
                                        if (!isNaN(duration) && duration > 0) {
                                            const currentStart = form.getValues('contractStartDate');
                                            const newEndDate = calculateEndDateFromDuration(currentStart, duration);
                                            if (newEndDate) {
                                                form.setValue('contractEndDate', newEndDate, { shouldDirty: true, shouldValidate: true });
                                            }
                                        }
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="contractEndDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contract End Date (Auto-calculated)</FormLabel>
                        <FormControl>
                            <DatePicker
                                {...field}
                                value={watchedEndDate || field.value || ''}
                                disabled
                                className="bg-gray-50 dark:bg-gray-900 cursor-not-allowed"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {crewMember?.activeContract?.filePath && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleViewContract}
                        className="w-full sm:w-auto gap-2"
                    >
                        <FileText className="h-4 w-4 text-blue-500" />
                        View Signed Contract
                    </Button>
                </div>
            )}
        </div>
    );
}

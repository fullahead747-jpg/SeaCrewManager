import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useFormContext } from 'react-hook-form';
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
                                    className="bg-white dark:bg-gray-950"
                                    onChange={(val) => {
                                        field.onChange(val);
                                        // Calculate end date when start date changes
                                        const startDate = val;
                                        const duration = form.getValues('contractDurationDays');
                                        if (startDate && duration) {
                                            const start = new Date(startDate);
                                            const end = new Date(start);
                                            end.setDate(start.getDate() + parseInt(duration));
                                            form.setValue('contractEndDate', end.toISOString().split('T')[0]);
                                        }
                                    }}
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
                                    value={field.value || 90}
                                    className="bg-white dark:bg-gray-950"
                                    onChange={(e) => {
                                        const duration = parseInt(e.target.value) || 0;
                                        field.onChange(duration);
                                        // Calculate end date when duration changes
                                        const startDate = form.getValues('contractStartDate');
                                        if (startDate && duration > 0) {
                                            const start = new Date(startDate);
                                            const end = new Date(start);
                                            end.setDate(start.getDate() + duration);
                                            form.setValue('contractEndDate', end.toISOString().split('T')[0]);
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
                                disabled
                                className="bg-gray-50 dark:bg-gray-900 cursor-not-allowed"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* Contract Document Viewing */}
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

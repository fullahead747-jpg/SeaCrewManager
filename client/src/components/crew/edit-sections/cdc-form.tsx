import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { useFormContext } from 'react-hook-form';
import { DatePicker } from '@/components/ui/date-picker';

export function CDCSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    CDC Details
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="cdcNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>CDC Number</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('cdcNotApplicable')} placeholder="CDC No." className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="cdcPlaceOfIssue"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('cdcNotApplicable')} placeholder="City/Country" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="cdcIssueDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                                <DatePicker {...field} disabled={form.watch('cdcNotApplicable')} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="cdcExpiryDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                                <DatePicker
                                    {...field}
                                    disabled={form.watch('cdcNotApplicable')}
                                    className="bg-white dark:bg-gray-950"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <div className="pt-2 flex items-center justify-start">
                <FormField
                    control={form.control}
                    name="cdcNotApplicable"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox
                                    id="cdc-na"
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (checked) {
                                            form.setValue('cdcNumber', '');
                                            form.setValue('cdcPlaceOfIssue', '');
                                            form.setValue('cdcIssueDate', '');
                                            form.setValue('cdcExpiryDate', '');
                                        }
                                    }}
                                />
                            </FormControl>
                            <Label htmlFor="cdc-na" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                N/A (Not Applicable)
                            </Label>
                        </FormItem>
                    )}
                />
            </div>
            {form.watch('cdcNotApplicable') && (
                <p className="text-sm text-gray-500 italic">
                    * CDC is marked as not applicable for this crew member.
                </p>
            )}
        </div>
    );
}

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

export function STCWSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Course Details
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="stcwNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Certificate Number</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('stcwNotApplicable')} placeholder="Certificate No." className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="stcwIssuingAuthority"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Issuing Authority</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('stcwNotApplicable')} placeholder="Training Center / Authority" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />


            </div>
            <div className="pt-2 flex items-center justify-start">
                <FormField
                    control={form.control}
                    name="stcwNotApplicable"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox
                                    id="stcw-na"
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (checked) {
                                            form.setValue('stcwNumber', '');
                                            form.setValue('stcwIssuingAuthority', '');
                                        }
                                    }}
                                />
                            </FormControl>
                            <Label htmlFor="stcw-na" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                N/A (Not Applicable)
                            </Label>
                        </FormItem>
                    )}
                />
            </div>
            {form.watch('stcwNotApplicable') && (
                <p className="text-sm text-gray-500 italic">
                    * Course/STCW certificate is marked as not applicable for this crew member.
                </p>
            )}
        </div>
    );
}

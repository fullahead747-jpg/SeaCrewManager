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

export function PassportSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Passport Details
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="passportNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Passport Number</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('passportNotApplicable')} placeholder="Passport No." className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="passportPlaceOfIssue"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('passportNotApplicable')} placeholder="City/Country" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="passportIssueDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} disabled={form.watch('passportNotApplicable')} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="passportExpiryDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                                <Input
                                    type="date"
                                    {...field}
                                    disabled={form.watch('passportNotApplicable')}
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
                    name="passportNotApplicable"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox
                                    id="passport-na"
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (checked) {
                                            form.setValue('passportNumber', '');
                                            form.setValue('passportPlaceOfIssue', '');
                                            form.setValue('passportIssueDate', '');
                                            form.setValue('passportExpiryDate', '');
                                        }
                                    }}
                                />
                            </FormControl>
                            <Label htmlFor="passport-na" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                N/A (Not Applicable)
                            </Label>
                        </FormItem>
                    )}
                />
            </div>
            {form.watch('passportNotApplicable') && (
                <p className="text-sm text-gray-500 italic">
                    * Passport is marked as not applicable for this crew member.
                </p>
            )}
        </div>
    );
}

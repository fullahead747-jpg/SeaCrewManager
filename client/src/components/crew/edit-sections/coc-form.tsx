import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useFormContext } from 'react-hook-form';

export function COCSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    COC Details
                </h3>
                <FormField
                    control={form.control}
                    name="cocNotApplicable"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={field.value}
                                    onChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                N/A (Not Applicable)
                            </FormLabel>
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="cocGradeNo"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>COC Grade/Number</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('cocNotApplicable')} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="cocPlaceOfIssue"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                                <Input {...field} disabled={form.watch('cocNotApplicable')} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="cocIssueDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} disabled={form.watch('cocNotApplicable')} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="cocExpiryDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} disabled={form.watch('cocNotApplicable')} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            {form.watch('cocNotApplicable') && (
                <p className="text-sm text-gray-500 italic">
                    * COC requirement is marked as not applicable for this crew member.
                </p>
            )}
        </div>
    );
}

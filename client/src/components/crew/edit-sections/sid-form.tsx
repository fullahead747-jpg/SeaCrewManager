import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useFormContext } from 'react-hook-form';
import { DatePicker } from '@/components/ui/date-picker';

export function SIDSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    SID Details (Seafarer Identity Document)
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="sidNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Document Number</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="e.g. M33140261"
                                    className="bg-white dark:bg-gray-950"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="sidPlaceOfIssue"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="e.g. Mumbai"
                                    className="bg-white dark:bg-gray-950"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="sidIssueDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Issue</FormLabel>
                            <FormControl>
                                <DatePicker
                                    {...field}
                                    className="bg-white dark:bg-gray-950"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="sidExpiryDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Expiry</FormLabel>
                            <FormControl>
                                <DatePicker
                                    {...field}
                                    className="bg-white dark:bg-gray-950"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}

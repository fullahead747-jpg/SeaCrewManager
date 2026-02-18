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
                                <Input {...field} placeholder="CDC No." className="bg-white dark:bg-gray-950" />
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
                                <Input {...field} placeholder="City/Country" className="bg-white dark:bg-gray-950" />
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
                                <Input type="date" {...field} className="bg-white dark:bg-gray-950" />
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
                                <div className="space-y-2">
                                    <Input
                                        type="date"
                                        {...field}
                                        disabled={form.watch('cdcTbd')}
                                        className="bg-white dark:bg-gray-950"
                                    />
                                    <FormField
                                        control={form.control}
                                        name="cdcTbd"
                                        render={({ field: tbdField }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="edit-cdc-tbd"
                                                    checked={tbdField.value}
                                                    onCheckedChange={(checked) => {
                                                        tbdField.onChange(checked);
                                                        if (checked) form.setValue('cdcExpiryDate', '');
                                                    }}
                                                />
                                                <Label htmlFor="edit-cdc-tbd" className="text-sm font-medium leading-none cursor-pointer text-gray-500">
                                                    TBD (To Be Determined)
                                                </Label>
                                            </div>
                                        )}
                                    />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}

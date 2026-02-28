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

export function STCWSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    STCW Course Details
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
                                <Input {...field} placeholder="STCW Certificate No." className="bg-white dark:bg-gray-950" />
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
                                <Input {...field} placeholder="Training Center / Authority" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="stcwIssueDate"
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
                    name="stcwExpiryDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                                <div className="space-y-2">
                                    <Input
                                        type="date"
                                        {...field}
                                        disabled={form.watch('stcwTbd')}
                                        className="bg-white dark:bg-gray-950"
                                    />
                                    <FormField
                                        control={form.control}
                                        name="stcwTbd"
                                        render={({ field: tbdField }) => (
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="edit-stcw-tbd"
                                                    checked={tbdField.value}
                                                    onCheckedChange={(checked) => {
                                                        tbdField.onChange(checked);
                                                        if (checked) form.setValue('stcwExpiryDate', '');
                                                    }}
                                                />
                                                <Label htmlFor="edit-stcw-tbd" className="text-sm font-medium leading-none cursor-pointer text-gray-500">
                                                    TBD (To Be Determined) / Lifetime
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

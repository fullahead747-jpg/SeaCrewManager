import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useFormContext } from 'react-hook-form';

export function NextOfKinSection() {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Next of Kin (NOK)
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Full Name" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="emergencyContactRelationship"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Relationship</FormLabel>
                            <FormControl>
                                <>
                                    <Input
                                        {...field}
                                        list="relationship-options"
                                        placeholder="Select relationship"
                                        className="bg-white dark:bg-gray-950"
                                    />
                                    <datalist id="relationship-options">
                                        <option value="Spouse" />
                                        <option value="Parent" />
                                        <option value="Child" />
                                        <option value="Sibling" />
                                        <option value="Friend" />
                                        <option value="Other" />
                                    </datalist>
                                </>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="+1 234 567 890" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="emergencyContactEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" {...field} placeholder="email@example.com" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="emergencyContactPostalAddress"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Postal Address</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="123 Street Name, City, Country" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}

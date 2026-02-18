import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useFormContext } from 'react-hook-form';
import { Vessel } from '@shared/schema';

interface ProfessionalInfoSectionProps {
    vessels: Vessel[];
}

export function ProfessionalInfoSection({ vessels }: ProfessionalInfoSectionProps) {
    const form = useFormContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Professional Information
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="currentVesselId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Current Vessel</FormLabel>
                            <FormControl>
                                <Select
                                    value={field.value?.toString() || "none"}
                                    onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                                >
                                    <SelectTrigger className="bg-white dark:bg-gray-950">
                                        <SelectValue placeholder="Select vessel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No vessel assigned</SelectItem>
                                        {vessels.map((vessel) => (
                                            <SelectItem key={vessel.id} value={vessel.id.toString()}>
                                                {vessel.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Add more professional fields here if needed, e.g., Department, Employee ID, etc. */}
            </div>
        </div>
    );
}

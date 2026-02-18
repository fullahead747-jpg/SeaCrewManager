import { Input } from '@/components/ui/input';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useFormContext } from 'react-hook-form';

interface PersonalInfoSectionProps {
    crewMember?: any;
}

export function PersonalInfoSection({ crewMember }: PersonalInfoSectionProps) {
    const form = useFormContext();
    const currentStatus = form.watch('status');
    const originalStatus = crewMember?.status;
    const isStatusChanged = originalStatus ? currentStatus !== originalStatus : false;

    // Calculate profile completion (simplified logic based on filled required fields)
    const calculateCompletion = () => {
        const values = form.getValues();
        const requiredFields = ['firstName', 'lastName', 'nationality', 'dateOfBirth', 'rank', 'status'];
        const filledFields = requiredFields.filter(field => values[field]);
        return Math.round((filledFields.length / requiredFields.length) * 100);
    };

    const completionPercentage = calculateCompletion();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Personal Information
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Profile Completion: {completionPercentage}%</span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Enter first name" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="Enter last name" className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <FormControl>
                                <Input {...field} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="rank"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rank</FormLabel>
                            <FormControl>
                                <>
                                    <Input
                                        {...field}
                                        list="rank-options"
                                        placeholder="Select rank"
                                        className="bg-white dark:bg-gray-950"
                                    />
                                    <datalist id="rank-options">
                                        <option value="Captain" />
                                        <option value="Master (NCV)" />
                                        <option value="Chief Officer" />
                                        <option value="Chief Officer (NCV)" />
                                        <option value="Second Officer" />
                                        <option value="Third Officer" />
                                        <option value="IV Master" />
                                        <option value="Second Master (IV)" />
                                        <option value="Chief Engineer" />
                                        <option value="Chief Engineer (NCV)" />
                                        <option value="Second Engineer" />
                                        <option value="Third Engineer" />
                                        <option value="Fourth Engineer" />
                                        <option value="Bosun" />
                                        <option value="Able Seaman" />
                                        <option value="Deck Watchkeeping Rating (AB)" />
                                        <option value="Ordinary Seaman" />
                                        <option value="Engine Rating" />
                                        <option value="Cook" />
                                        <option value="2nd Cook" />
                                        <option value="Steward" />
                                        <option value="Saloon Rating" />
                                        <option value="Fitter" />
                                        <option value="Handler" />
                                        <option value="Tube Operator" />
                                        <option value="Lathe Operator" />
                                        <option value="Radio Officer" />
                                        <option value="ETO" />
                                        <option value="ASST ETO" />
                                        <option value="GMDSS OPERATOR" />
                                    </datalist>
                                </>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                                <Input {...field} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input type="email" {...field} className="bg-white dark:bg-gray-950" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Status</FormLabel>
                            <FormControl>
                                <div className="flex gap-4">
                                    <div
                                        className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${field.value === 'onBoard'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${field.value === 'onBoard' ? 'border-blue-500' : 'border-gray-400'
                                                }`}>
                                                {field.value === 'onBoard' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <span className="font-medium">On Board</span>
                                        </div>
                                    </div>

                                    <div
                                        className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${field.value === 'onShore'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${field.value === 'onShore' ? 'border-blue-500' : 'border-gray-400'
                                                }`}>
                                                {field.value === 'onShore' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <span className="font-medium">On Shore</span>
                                        </div>
                                    </div>
                                </div>
                            </FormControl>
                            <p className="text-xs text-gray-500 mt-1">
                                ℹ️ Status is automatically managed, but can be overridden here.
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {isStatusChanged && (
                    <FormField
                        control={form.control}
                        name="statusChangeReason"
                        render={({ field }) => (
                            <FormItem className="md:col-span-2 animate-in fade-in slide-in-from-top-2">
                                <FormLabel>Reason for Status Change <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="Please provide a reason for changing the status..." className="bg-white dark:bg-gray-950" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
        </div>
    );
}

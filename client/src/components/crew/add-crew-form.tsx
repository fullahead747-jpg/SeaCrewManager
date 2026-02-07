import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';

const addCrewSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  rank: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  status: z.enum(['onBoard', 'onShore']),
  contractStartDate: z.string().optional(),
  contractDurationDays: z.number().optional(),
  contractEndDate: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  currentVesselId: z.string().optional().nullable(),
});

type AddCrewFormData = z.infer<typeof addCrewSchema>;

interface AddCrewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const crewRanks = [
  'Captain',
  'Chief Officer',
  'Chief Officer (NCV)',
  '2nd Officer', 
  '3rd Officer',
  'IV Master',
  'Second Master (IV)',
  'Chief Engineer',
  'Chief Engineer (NCV)',
  '2nd Engineer',
  '3rd Engineer',
  '4th Engineer',
  'Bosun',
  'AB Seaman',
  'Deck Watchkeeping Rating (AB)',
  'OS Seaman',
  'Engine Rating',
  'Cook',
  '2nd Cook',
  'Messman',
  'Saloon Rating',
  'Oiler',
  'Wiper',
  'Fitter',
  'Handler',
  'Tube Operator',
  'Lathe Operator',
  'Radio Officer',
  'ETO',
  'ASST ETO',
  'GMDSS OPERATOR'
];

const relationships = [
  'Spouse',
  'Wife',
  'Parent',
  'Child',
  'Sibling',
  'Friend',
  'Other'
];

export default function AddCrewForm({ open, onOpenChange }: AddCrewFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vessels } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  const form = useForm<AddCrewFormData>({
    resolver: zodResolver(addCrewSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: '',
      dateOfBirth: '',
      rank: '',
      phoneNumber: '',
      email: '',
      status: 'onBoard',
      contractStartDate: '',
      contractDurationDays: 90, // Default 3 months
      contractEndDate: '',
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
        email: '',
      },
      currentVesselId: undefined,
    },
  });

  const addCrewMutation = useMutation({
    mutationFn: async (data: AddCrewFormData) => {
      const crewData = {
        userId: undefined,
        firstName: data.firstName,
        lastName: data.lastName,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        rank: data.rank,
        phoneNumber: data.phoneNumber || undefined,
        email: data.email || undefined,
        emergencyContact: data.emergencyContact,
        currentVesselId: data.currentVesselId && data.currentVesselId !== 'none' ? data.currentVesselId : undefined,
        status: data.status,
        contractStartDate: data.contractStartDate,
        contractEndDate: data.contractEndDate,
        contractDurationDays: data.contractDurationDays,
      };

      const crewResponse = await fetch('/api/crew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(crewData),
      });
      
      if (!crewResponse.ok) {
        const errorData = await crewResponse.json().catch(() => ({}));
        if (errorData.error === 'DUPLICATE_CREW_MEMBER') {
          throw new Error(errorData.message || 'This crew member already exists on the same vessel.');
        }
        throw new Error(errorData.message || 'Failed to add crew member');
      }
      
      const newCrewMember = await crewResponse.json();

      return newCrewMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      toast({
        title: 'Success',
        description: 'Crew member added successfully',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add crew member',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddCrewFormData) => {
    addCrewMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl max-h-[95vh] overflow-hidden m-2 sm:m-6">
        <DialogHeader className="px-3 sm:px-6 pt-4 sm:pt-6 pb-2">
          <DialogTitle className="text-lg sm:text-xl">Add New Crew Member</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Enter the crew member's details to add them to the system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-3 sm:px-6 pb-4 sm:pb-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            
            {/* Personal Information */}
            <div className="space-y-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 sm:mr-3"></div>
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="first-name-input" />
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
                        <Input {...field} data-testid="last-name-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationality</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="nationality-input" />
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
                        <Input type="date" {...field} data-testid="dob-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} data-testid="phone-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email address" {...field} value={field.value || ''} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center">
                <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                Professional Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rank"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rank</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="rank-select">
                            <SelectValue placeholder="Select rank" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {crewRanks.map((rank) => (
                            <SelectItem key={rank} value={rank}>
                              {rank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentVesselId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Vessel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="vessel-select">
                            <SelectValue placeholder="Select vessel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No assignment</SelectItem>
                          {vessels?.map((vessel: any) => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name} ({vessel.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                        data-testid="status-radio-group"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="onBoard" id="onBoard" />
                          <Label htmlFor="onBoard" className="cursor-pointer">On Board</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="onShore" id="onShore" />
                          <Label htmlFor="onShore" className="cursor-pointer">On Shore</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Emergency Contact */}
            <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center">
                <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
                Emergency Contact
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContact.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="emergency-name-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact.relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="relationship-select">
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {relationships.map((rel) => (
                            <SelectItem key={rel} value={rel}>
                              {rel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergencyContact.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="emergency-phone-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="emergency-email-input" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

              <div className="flex justify-end space-x-2 pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="cancel-add-crew"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addCrewMutation.isPending}
                  data-testid="add-crew-submit"
                >
                  {addCrewMutation.isPending ? 'Adding...' : 'Add Crew Member'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
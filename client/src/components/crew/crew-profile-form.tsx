import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { insertCrewMemberSchema } from '@shared/schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';

const crewFormSchema = insertCrewMemberSchema.extend({
  dateOfBirth: z.string(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactEmail: z.string().email().optional().or(z.literal('')),
});

type CrewFormData = z.infer<typeof crewFormSchema>;

interface CrewProfileFormProps {
  crewMemberId?: string;
  onSuccess?: () => void;
}

const rankOptions = [
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
  'Radio Officer',
  'ETO',
  'ASST ETO',
  'Electrician',
  'Fitter',
  'Handler',
  'Tube Operator',
  'Lathe Operator',
];

export default function CrewProfileForm({ crewMemberId, onSuccess }: CrewProfileFormProps) {
  const { toast } = useToast();
  const isEdit = Boolean(crewMemberId);

  const form = useForm<CrewFormData>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: '',
      dateOfBirth: '',
      rank: '',
      phoneNumber: '',
      status: 'onShore',
      emergencyContactName: '',
      emergencyContactRelationship: '',
      emergencyContactPhone: '',
      emergencyContactEmail: '',
    },
  });

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

  const { data: existingCrew } = useQuery({
    queryKey: ['/api/crew', crewMemberId],
    queryFn: async () => {
      if (!crewMemberId) return null;
      const response = await fetch(`/api/crew/${crewMemberId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew member');
      return response.json();
    },
    enabled: Boolean(crewMemberId),
  });

  // Populate form with existing data when editing
  React.useEffect(() => {
    if (existingCrew) {
      const emergencyContact = existingCrew.emergencyContact || {};
      form.reset({
        firstName: existingCrew.firstName,
        lastName: existingCrew.lastName,
        nationality: existingCrew.nationality,
        dateOfBirth: existingCrew.dateOfBirth ? new Date(existingCrew.dateOfBirth).toISOString().split('T')[0] : '',
        rank: existingCrew.rank,
        phoneNumber: existingCrew.phoneNumber || '',
        currentVesselId: existingCrew.currentVesselId || undefined,
        status: existingCrew.status,
        emergencyContactName: emergencyContact.name || '',
        emergencyContactRelationship: emergencyContact.relationship || '',
        emergencyContactPhone: emergencyContact.phone || '',
        emergencyContactEmail: emergencyContact.email || '',
      });
    }
  }, [existingCrew, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CrewFormData) => {
      const { emergencyContactName, emergencyContactRelationship, emergencyContactPhone, emergencyContactEmail, dateOfBirth, ...crewData } = data;

      const payload = {
        ...crewData,
        dateOfBirth: new Date(dateOfBirth),
        emergencyContact: emergencyContactName ? {
          name: emergencyContactName,
          relationship: emergencyContactRelationship || '',
          phone: emergencyContactPhone || '',
          email: emergencyContactEmail || '',
        } : null,
      };

      if (isEdit) {
        return apiRequest('PUT', `/api/crew/${crewMemberId}`, payload);
      } else {
        return apiRequest('POST', '/api/crew', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      toast({
        title: 'Success',
        description: `Crew member ${isEdit ? 'updated' : 'created'} successfully`,
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to ${isEdit ? 'update' : 'create'} crew member`,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CrewFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Personal Information */}
        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
            Personal Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
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
                  <FormLabel>Last Name *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="last-name-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality *</FormLabel>
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
                  <FormLabel>Date of Birth *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="dob-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
        </div>

        {/* Professional Information */}
        <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
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
                  <FormLabel>Rank *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="rank-select">
                        <SelectValue placeholder="Select rank" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rankOptions.map((rank) => (
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
                      <RadioGroupItem value="onBoard" id="onBoard-profile" />
                      <Label htmlFor="onBoard-profile" className="cursor-pointer">On Board</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="onShore" id="onShore-profile" />
                      <Label htmlFor="onShore-profile" className="cursor-pointer">On Shore</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Emergency Contact */}
        <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center">
            <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
            Emergency Contact
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="emergencyContactName"
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
              name="emergencyContactRelationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Spouse, Parent" data-testid="emergency-relationship-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="emergencyContactPhone"
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
              name="emergencyContactEmail"
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

        {/* Form Actions */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onSuccess}
            data-testid="cancel-crew-form-button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-maritime-navy hover:bg-blue-800"
            disabled={createMutation.isPending}
            data-testid="save-crew-form-button"
          >
            {isEdit ? 'Update' : 'Create'} Crew Member
          </Button>
        </div>
      </form>
    </Form>
  );
}

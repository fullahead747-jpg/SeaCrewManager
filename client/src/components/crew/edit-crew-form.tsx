import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { CrewMemberWithDetails, Vessel } from '@shared/schema';
import { FileText } from 'lucide-react';

const editCrewSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  rank: z.string().min(1, 'Rank is required'),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  postalAddress: z.string().optional(),
  status: z.enum(['onBoard', 'onShore']),
  currentVesselId: z.string().optional().nullable(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactEmail: z.string().optional(),
  emergencyContactPostalAddress: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractDurationDays: z.number().optional(),
  contractEndDate: z.string().optional(),
  passportNumber: z.string().optional(),
  passportPlaceOfIssue: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportExpiryDate: z.string().optional(),
  cdcNumber: z.string().optional(),
  cdcPlaceOfIssue: z.string().optional(),
  cdcIssueDate: z.string().optional(),
  cdcExpiryDate: z.string().optional(),
  cocGradeNo: z.string().optional(),
  cocPlaceOfIssue: z.string().optional(),
  cocIssueDate: z.string().optional(),
  cocExpiryDate: z.string().optional(),
  cocNotApplicable: z.boolean().optional(),
  medicalIssuingAuthority: z.string().optional(),
  medicalApprovalNo: z.string().optional(),
  medicalIssueDate: z.string().optional(),
  medicalExpiryDate: z.string().optional(),
});

type EditCrewFormData = z.infer<typeof editCrewSchema>;

import { formatDateForInput } from '@/lib/utils';

interface EditCrewFormProps {
  crewMember: CrewMemberWithDetails;
  onSuccess: () => void;
}

export default function EditCrewForm({ crewMember, onSuccess }: EditCrewFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const originalStatus = crewMember.status;

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  const passport = crewMember.documents?.find(d => d.type === 'passport');
  const cdc = crewMember.documents?.find(d => d.type === 'cdc');
  const coc = crewMember.documents?.find(d => d.type === 'coc');
  const medical = crewMember.documents?.find(d => d.type === 'medical');

  // Debug logging
  console.log('🔍 Edit Form Debug:', {
    crewName: `${crewMember.firstName} ${crewMember.lastName}`,
    hasDocuments: !!crewMember.documents,
    documentCount: crewMember.documents?.length || 0,
    hasPassport: !!passport,
    passportData: passport ? {
      issueDate: passport.issueDate,
      expiryDate: passport.expiryDate,
      issueDateType: typeof passport.issueDate,
      expiryDateType: typeof passport.expiryDate,
      issueDateFormatted: formatDateForInput(passport.issueDate),
      expiryDateFormatted: formatDateForInput(passport.expiryDate),
    } : null
  });


  const form = useForm<EditCrewFormData>({
    resolver: zodResolver(editCrewSchema),
    defaultValues: {
      firstName: crewMember.firstName,
      lastName: crewMember.lastName,
      nationality: crewMember.nationality,
      dateOfBirth: formatDateForInput(crewMember.dateOfBirth),
      rank: crewMember.rank,
      phoneNumber: crewMember.phoneNumber || '',
      email: (crewMember as any).email || '',
      postalAddress: (crewMember as any).postalAddress || '',
      status: crewMember.status as 'onBoard' | 'onShore',
      currentVesselId: crewMember.currentVesselId || undefined,
      emergencyContactName: (crewMember.emergencyContact as any)?.name || '',
      emergencyContactRelationship: (crewMember.emergencyContact as any)?.relationship || '',
      emergencyContactPhone: (crewMember.emergencyContact as any)?.phone || '',
      emergencyContactEmail: (crewMember.emergencyContact as any)?.email || '',
      emergencyContactPostalAddress: (crewMember.emergencyContact as any)?.postalAddress || '',
      contractStartDate: formatDateForInput(crewMember.activeContract?.startDate),
      contractDurationDays: crewMember.activeContract?.startDate && crewMember.activeContract?.endDate
        ? Math.ceil((new Date(crewMember.activeContract.endDate).getTime() - new Date(crewMember.activeContract.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 90,
      contractEndDate: formatDateForInput(crewMember.activeContract?.endDate),
      passportNumber: passport?.documentNumber || '',
      passportPlaceOfIssue: passport?.issuingAuthority || '',
      passportIssueDate: formatDateForInput(passport?.issueDate),
      passportExpiryDate: formatDateForInput(passport?.expiryDate),
      cdcNumber: cdc?.documentNumber || '',
      cdcPlaceOfIssue: cdc?.issuingAuthority || '',
      cdcIssueDate: formatDateForInput(cdc?.issueDate),
      cdcExpiryDate: formatDateForInput(cdc?.expiryDate),
      cocGradeNo: coc?.documentNumber || '',
      cocPlaceOfIssue: coc?.issuingAuthority || '',
      cocIssueDate: formatDateForInput(coc?.issueDate),
      cocExpiryDate: formatDateForInput(coc?.expiryDate),
      cocNotApplicable: crewMember.cocNotApplicable || false,
      medicalIssuingAuthority: medical?.issuingAuthority || '',
      medicalApprovalNo: medical?.documentNumber || '',
      medicalIssueDate: formatDateForInput(medical?.issueDate),
      medicalExpiryDate: formatDateForInput(medical?.expiryDate),
    },
  });

  // Reset form when crewMember changes to populate fields with new data
  useEffect(() => {
    const passport = crewMember.documents?.find(d => d.type === 'passport');
    const cdc = crewMember.documents?.find(d => d.type === 'cdc');
    const coc = crewMember.documents?.find(d => d.type === 'coc');
    const medical = crewMember.documents?.find(d => d.type === 'medical');

    form.reset({
      firstName: crewMember.firstName,
      lastName: crewMember.lastName,
      nationality: crewMember.nationality,
      dateOfBirth: formatDateForInput(crewMember.dateOfBirth),
      rank: crewMember.rank,
      phoneNumber: crewMember.phoneNumber || '',
      email: (crewMember as any).email || '',
      postalAddress: (crewMember as any).postalAddress || '',
      status: crewMember.status as 'onBoard' | 'onShore',
      currentVesselId: crewMember.currentVesselId || undefined,
      emergencyContactName: (crewMember.emergencyContact as any)?.name || '',
      emergencyContactRelationship: (crewMember.emergencyContact as any)?.relationship || '',
      emergencyContactPhone: (crewMember.emergencyContact as any)?.phone || '',
      emergencyContactEmail: (crewMember.emergencyContact as any)?.email || '',
      emergencyContactPostalAddress: (crewMember.emergencyContact as any)?.postalAddress || '',
      contractStartDate: formatDateForInput(crewMember.activeContract?.startDate),
      contractDurationDays: crewMember.activeContract?.startDate && crewMember.activeContract?.endDate
        ? Math.ceil((new Date(crewMember.activeContract.endDate).getTime() - new Date(crewMember.activeContract.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 90,
      contractEndDate: formatDateForInput(crewMember.activeContract?.endDate),
      passportNumber: passport?.documentNumber || '',
      passportPlaceOfIssue: passport?.issuingAuthority || '',
      passportIssueDate: formatDateForInput(passport?.issueDate),
      passportExpiryDate: formatDateForInput(passport?.expiryDate),
      cdcNumber: cdc?.documentNumber || '',
      cdcPlaceOfIssue: cdc?.issuingAuthority || '',
      cdcIssueDate: formatDateForInput(cdc?.issueDate),
      cdcExpiryDate: formatDateForInput(cdc?.expiryDate),
      cocGradeNo: coc?.documentNumber || '',
      cocPlaceOfIssue: coc?.issuingAuthority || '',
      cocIssueDate: formatDateForInput(coc?.issueDate),
      cocExpiryDate: formatDateForInput(coc?.expiryDate),
      cocNotApplicable: crewMember.cocNotApplicable || false,
      medicalIssuingAuthority: medical?.issuingAuthority || '',
      medicalApprovalNo: medical?.documentNumber || '',
      medicalIssueDate: formatDateForInput(medical?.issueDate),
      medicalExpiryDate: formatDateForInput(medical?.expiryDate),
    });
  }, [crewMember, form]);

  const updateCrewMutation = useMutation({
    mutationFn: async (data: EditCrewFormData & { statusChangeReason?: string }) => {
      console.log('Updating crew member:', crewMember.id, 'with data:', data);

      const updateData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth, // Send as string, server will handle conversion
        rank: data.rank,
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
        status: data.status,
        currentVesselId: data.currentVesselId === "none" ? null : data.currentVesselId || null,
        emergencyContact: data.emergencyContactName ? {
          name: data.emergencyContactName,
          relationship: data.emergencyContactRelationship || '',
          phone: data.emergencyContactPhone || '',
          email: data.emergencyContactEmail || '',
          postalAddress: data.emergencyContactPostalAddress || '',
        } : null,
        postalAddress: data.postalAddress || null,
        cocNotApplicable: data.cocNotApplicable || false,
      };

      // Include status change reason if status changed
      if (data.statusChangeReason) {
        updateData.statusChangeReason = data.statusChangeReason;
      }

      // Handle contract update separately if contract dates are provided
      if (data.contractStartDate && data.contractEndDate && crewMember.activeContract) {
        const contractUpdateData = {
          startDate: new Date(data.contractStartDate + 'T00:00:00.000Z'),
          endDate: new Date(data.contractEndDate + 'T00:00:00.000Z'),
        };

        console.log('Updating contract:', crewMember.activeContract.id, 'with data:', contractUpdateData);

        const contractResponse = await fetch(`/api/contracts/${crewMember.activeContract.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contractUpdateData),
        });

        if (!contractResponse.ok) {
          const errorText = await contractResponse.text();
          console.error('Failed to update contract:', contractResponse.status, errorText);
          throw new Error(`Failed to update contract: ${contractResponse.status} - ${errorText}`);
        } else {
          const updatedContract = await contractResponse.json();
          console.log('Contract updated successfully:', updatedContract);
        }
      }

      // Helper function to update or create a document
      const updateOrCreateDocument = async (
        type: string,
        documentNumber: string | undefined,
        issuingAuthority: string | undefined,
        issueDate: string | undefined,
        expiryDate: string | undefined,
        existingDoc: any
      ) => {
        const hasData = documentNumber || issueDate || expiryDate;

        // If no data and no existing doc, nothing to do
        if (!hasData && !existingDoc) return;

        if (existingDoc) {
          // Update existing document with form values directly (allows clearing)
          const docData = {
            crewMemberId: crewMember.id,
            type,
            documentNumber: documentNumber || '',
            issuingAuthority: issuingAuthority || '',
            issueDate: issueDate ? new Date(issueDate + 'T00:00:00.000Z') : null,
            expiryDate: expiryDate ? new Date(expiryDate + 'T00:00:00.000Z') : null,
          };

          const response = await fetch(`/api/documents/${existingDoc.id}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(docData),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || errorData.message || `Failed to update ${type} document`;
            throw new Error(errorMessage);
          }
        } else if (documentNumber && issueDate && expiryDate) {
          // Only create new document if all required fields are provided
          const docData = {
            crewMemberId: crewMember.id,
            type,
            documentNumber: documentNumber,
            issuingAuthority: issuingAuthority || '',
            issueDate: new Date(issueDate + 'T00:00:00.000Z'),
            expiryDate: new Date(expiryDate + 'T00:00:00.000Z'),
          };

          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(docData),
          });
          if (!response.ok) console.error(`Failed to create ${type} document`);
        }
      };

      // Update documents
      await updateOrCreateDocument('passport', data.passportNumber, data.passportPlaceOfIssue, data.passportIssueDate, data.passportExpiryDate, passport);
      await updateOrCreateDocument('cdc', data.cdcNumber, data.cdcPlaceOfIssue, data.cdcIssueDate, data.cdcExpiryDate, cdc);

      // Only update/create COC if not marked as Not Applicable
      if (!data.cocNotApplicable) {
        await updateOrCreateDocument('coc', data.cocGradeNo, data.cocPlaceOfIssue, data.cocIssueDate, data.cocExpiryDate, coc);
      } else if (coc) {
        // If coc exists but now marked as N/A, we should probably delete it or mark it
        // For now, let's just not update it. 
        // In a real scenario, we might want to delete the document record:
        await fetch(`/api/documents/${coc.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      }

      await updateOrCreateDocument('medical', data.medicalApprovalNo, data.medicalIssuingAuthority, data.medicalIssueDate, data.medicalExpiryDate, medical);

      console.log('Sending update data:', updateData);

      const response = await fetch(`/api/crew/${crewMember.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update failed:', response.status, errorText);
        console.error('Update data that failed:', updateData);
        throw new Error(`Failed to update crew member: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Force immediate cache refresh for all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/upcoming-events'] });
      // Force refetch to happen immediately
      queryClient.refetchQueries({ queryKey: ['/api/crew'] });
      queryClient.refetchQueries({ queryKey: ['/api/contracts'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Success',
        description: 'Crew member updated successfully',
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update crew member',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditCrewFormData) => {
    console.log('Form data:', data);
    const isStatusChanged = data.status !== originalStatus;

    // Validate status change reason if status changed
    if (isStatusChanged && !statusChangeReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for changing the crew status.',
        variant: 'destructive',
      });
      return;
    }

    updateCrewMutation.mutate({
      ...data,
      statusChangeReason: isStatusChanged ? statusChangeReason : undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Personal Information */}
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
            Personal Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-firstName" />
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
                    <Input {...field} data-testid="edit-lastName" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-nationality" />
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
                    <Input type="date" {...field} data-testid="edit-dateOfBirth" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="Enter or select rank"
                        data-testid="edit-rank"
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
                    <Input {...field} data-testid="edit-phoneNumber" />
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
                    <Input type="email" placeholder="Enter email address" {...field} value={field.value || ''} data-testid="edit-email" />
                  </FormControl>
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
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex space-x-6"
                    data-testid="edit-status"
                    disabled={true}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="onBoard" id="edit-onBoard" disabled />
                      <Label htmlFor="edit-onBoard" className="text-muted-foreground">On Board</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="onShore" id="edit-onShore" disabled />
                      <Label htmlFor="edit-onShore" className="text-muted-foreground">On Shore</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">
                  ℹ️ Status is automatically managed by the system based on the sign-on and sign-off details
                </p>
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
                <FormControl>
                  <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value === "none" ? null : value)}>
                    <SelectTrigger data-testid="edit-currentVesselId">
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No vessel assigned</SelectItem>
                      {vessels.map((vessel) => (
                        <SelectItem key={vessel.id} value={vessel.id}>
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
        </div>

        {/* Next of Kin (NOK) Section */}
        <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center">
            <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
            Next of Kin (NOK)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-emergencyContactName" />
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
                        placeholder="Enter or select relationship"
                        data-testid="edit-emergencyContactRelationship"
                      />
                      <datalist id="relationship-options">
                        <option value="Spouse" />
                        <option value="Wife" />
                        <option value="Husband" />
                        <option value="Parent" />
                        <option value="Father" />
                        <option value="Mother" />
                        <option value="Child" />
                        <option value="Son" />
                        <option value="Daughter" />
                        <option value="Sibling" />
                        <option value="Brother" />
                        <option value="Sister" />
                        <option value="Friend" />
                        <option value="Other" />
                      </datalist>
                    </>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-emergencyContactPhone" />
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
                    <Input type="email" {...field} data-testid="edit-emergencyContactEmail" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="emergencyContactPostalAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Address</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="edit-emergencyContactPostalAddress" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Passport Details Section */}
        <div className="space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 flex items-center">
            <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
            Passport Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="passportNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passport Number</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-passportNumber" />
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
                    <Input {...field} data-testid="edit-passportPlaceOfIssue" />
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
                    <Input type="date" {...field} data-testid="edit-passportIssueDate" />
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
                    <Input type="date" {...field} data-testid="edit-passportExpiryDate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* CDC Details Section */}
        <div className="space-y-3 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
          <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-100 flex items-center">
            <div className="w-2 h-2 bg-teal-600 rounded-full mr-3"></div>
            CDC Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cdcNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CDC Number</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-cdcNumber" />
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
                    <Input {...field} data-testid="edit-cdcPlaceOfIssue" />
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
                    <Input type="date" {...field} data-testid="edit-cdcIssueDate" />
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
                    <Input type="date" {...field} data-testid="edit-cdcExpiryDate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* COC Details Section */}
        <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 flex items-center">
              <div className="w-2 h-2 bg-amber-600 rounded-full mr-3"></div>
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
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      checked={field.value}
                      onChange={field.onChange}
                      data-testid="edit-cocNotApplicable"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-medium text-amber-900 dark:text-amber-100 cursor-pointer">
                    NILL / Not Applicable
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cocGradeNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={form.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>COC Grade/Number</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={form.watch('cocNotApplicable')} data-testid="edit-cocGradeNo" />
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
                  <FormLabel className={form.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Place of Issue</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={form.watch('cocNotApplicable')} data-testid="edit-cocPlaceOfIssue" />
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
                  <FormLabel className={form.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Issue Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={form.watch('cocNotApplicable')} data-testid="edit-cocIssueDate" />
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
                  <FormLabel className={form.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Expiry Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={form.watch('cocNotApplicable')} data-testid="edit-cocExpiryDate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {form.watch('cocNotApplicable') && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 italic">
              * COC requirement is waived for this crew member.
            </p>
          )}
        </div>

        {/* Medical Certificate Details Section */}
        <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg">
          <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-100 flex items-center">
            <div className="w-2 h-2 bg-rose-600 rounded-full mr-3"></div>
            Medical Certificate Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="medicalIssuingAuthority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issuing Authority</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-medicalIssuingAuthority" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicalApprovalNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approval Number</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-medicalApprovalNo" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicalIssueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="edit-medicalIssueDate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicalExpiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="edit-medicalExpiryDate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Contract Information */}
        <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 flex items-center">
            <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
            Contract Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="contractStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Start Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      data-testid="edit-contractStartDate"
                      onChange={(e) => {
                        field.onChange(e);
                        // Calculate end date when start date changes
                        const startDate = e.target.value;
                        const duration = form.getValues('contractDurationDays');
                        if (startDate && duration) {
                          const start = new Date(startDate);
                          const end = new Date(start);
                          end.setDate(start.getDate() + duration);
                          form.setValue('contractEndDate', end.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contractDurationDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (Days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g., 90"
                      {...field}
                      value={field.value || 90}
                      data-testid="edit-contractDurationDays"
                      onChange={(e) => {
                        const duration = parseInt(e.target.value) || 0;
                        field.onChange(duration);
                        // Calculate end date when duration changes
                        const startDate = form.getValues('contractStartDate');
                        if (startDate && duration > 0) {
                          const start = new Date(startDate);
                          const end = new Date(start);
                          end.setDate(start.getDate() + duration);
                          form.setValue('contractEndDate', end.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="contractEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contract End Date (Auto-calculated)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    data-testid="edit-contractEndDate"
                    readOnly
                    className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Contract Document Viewing */}
          {crewMember.activeContract?.filePath && (
            <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
              <p className="font-medium mb-2 text-sm">Contract Document:</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/contracts/${crewMember.activeContract?.id}/view`, {
                      headers: getAuthHeaders(),
                    });
                    if (!response.ok) {
                      throw new Error('Failed to fetch document');
                    }
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    // Clean up after a delay
                    setTimeout(() => window.URL.revokeObjectURL(url), 100);
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to open contract document',
                      variant: 'destructive',
                    });
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <FileText className="h-4 w-4" />
                View Contract Document
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateCrewMutation.isPending}
            className="bg-maritime-navy hover:bg-blue-800"
            data-testid="submit-edit-crew"
          >
            {updateCrewMutation.isPending ? 'Updating...' : 'Update Crew Member'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

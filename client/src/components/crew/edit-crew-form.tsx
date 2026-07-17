import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { CrewMemberWithDetails, Vessel } from '@shared/schema';
import { formatDateForInput } from '@/lib/utils';
import { CrewFormSidebar } from './crew-form-sidebar';
import { CrewFormContent } from './crew-form-content';

const editCrewSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().or(z.literal('')),
  nationality: z.string().min(1, 'Nationality is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  rank: z.string().min(1, 'Rank is required'),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  postalAddress: z.string().optional(),
  status: z.enum(['onBoard', 'onShore']),
  currentVesselId: z.string().optional().nullable(), // Changed to string to match database UUIDs
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
  medicalIssuingAuthority: z.string().optional(),
  medicalApprovalNo: z.string().optional(),
  medicalIssueDate: z.string().optional(),
  medicalExpiryDate: z.string().optional(),
  passportNotApplicable: z.boolean().optional(),
  cdcNotApplicable: z.boolean().optional(),
  cocNotApplicable: z.boolean().optional(),
  medicalNotApplicable: z.boolean().optional(),
  stcwNumber: z.string().optional(),
  stcwIssuingAuthority: z.string().optional(),
  stcwIssueDate: z.string().optional(),
  stcwExpiryDate: z.string().optional(),
  stcwNotApplicable: z.boolean().optional(),
  sidNumber: z.string().optional(),
  sidPlaceOfIssue: z.string().optional(),
  sidIssueDate: z.string().optional(),
  sidExpiryDate: z.string().optional(),
  statusChangeReason: z.string().optional(),
});

type EditCrewFormData = z.infer<typeof editCrewSchema>;

interface EditCrewFormProps {
  crewMember: CrewMemberWithDetails;
  onSuccess: () => void;
}

export default function EditCrewForm({ crewMember, onSuccess }: EditCrewFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [statusChangeReason, setStatusChangeReason] = useState(''); // Kept for logic, though not in UI explicitly yet

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
  const stcw = crewMember.documents?.find(d => d.type === 'stcw_course');
  const sid = crewMember.documents?.find(d => d.type === 'sid');

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
      status: (crewMember.status === 'onShore' ? 'onShore' : 'onBoard') as 'onBoard' | 'onShore',
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
      medicalIssuingAuthority: medical?.issuingAuthority || '',
      medicalApprovalNo: medical?.documentNumber || '',
      medicalIssueDate: formatDateForInput(medical?.issueDate),
      medicalExpiryDate: formatDateForInput(medical?.expiryDate),
      passportNotApplicable: crewMember.passportNotApplicable || false,
      cdcNotApplicable: crewMember.cdcNotApplicable || false,
      cocNotApplicable: crewMember.cocNotApplicable || false,
      medicalNotApplicable: crewMember.medicalNotApplicable || false,
      stcwNumber: stcw?.documentNumber || '',
      stcwIssuingAuthority: stcw?.issuingAuthority || '',
      stcwIssueDate: formatDateForInput(stcw?.issueDate),
      stcwExpiryDate: formatDateForInput(stcw?.expiryDate),
      stcwNotApplicable: crewMember.stcwNotApplicable || false,
      sidNumber: sid?.documentNumber || '',
      sidPlaceOfIssue: sid?.issuingAuthority || '',
      sidIssueDate: formatDateForInput(sid?.issueDate),
      sidExpiryDate: formatDateForInput(sid?.expiryDate),
    },
  });

  // Helper logic from original form
  const updateOrCreateDocument = async (
    type: string,
    documentNumber: string | undefined,
    issuingAuthority: string | undefined,
    issueDate: string | undefined,
    expiryDate: string | undefined,
    existingDoc: any,
    isNotApplicable: boolean = false
  ) => {
    if (isNotApplicable && existingDoc) {
      const res = await fetch(`/api/documents/${existingDoc.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to delete ${type.toUpperCase()} document`);
      }
      return;
    }

    const hasData = documentNumber || issueDate || expiryDate;
    if (!hasData && !existingDoc) return;

    if (existingDoc) {
      const docData = {
        crewMemberId: crewMember.id,
        type,
        documentNumber: documentNumber || '',
        issuingAuthority: issuingAuthority || '',
        issueDate: issueDate ? new Date(issueDate + 'T00:00:00.000Z') : null,
        expiryDate: expiryDate ? new Date(expiryDate + 'T00:00:00.000Z') : null,
      };
      const res = await fetch(`/api/documents/${existingDoc.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to update ${type.toUpperCase()} document`);
      }
    } else if (documentNumber && (issueDate || expiryDate)) {
      const docData = {
        crewMemberId: crewMember.id,
        type,
        documentNumber: documentNumber,
        issuingAuthority: issuingAuthority || '',
        issueDate: issueDate ? new Date(issueDate + 'T00:00:00.000Z') : null,
        expiryDate: expiryDate ? new Date(expiryDate + 'T00:00:00.000Z') : null,
      };
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to create ${type.toUpperCase()} document`);
      }
    }
  };

  const updateCrewMutation = useMutation({
    mutationFn: async (data: EditCrewFormData & { statusChangeReason?: string }) => {
      const updateData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        rank: data.rank,
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
        status: data.status,
        currentVesselId: data.currentVesselId || null,
        emergencyContact: data.emergencyContactName ? {
          name: data.emergencyContactName,
          relationship: data.emergencyContactRelationship || '',
          phone: data.emergencyContactPhone || '',
          email: data.emergencyContactEmail || '',
          postalAddress: data.emergencyContactPostalAddress || '',
        } : null,
        postalAddress: data.postalAddress || null,
        passportNotApplicable: data.passportNotApplicable || false,
        cdcNotApplicable: data.cdcNotApplicable || false,
        cocNotApplicable: data.cocNotApplicable || false,
        medicalNotApplicable: data.medicalNotApplicable || false,
        stcwNotApplicable: data.stcwNotApplicable || false,
      };

      if (data.statusChangeReason) {
        updateData.statusChangeReason = data.statusChangeReason;
      }

      // Handle contract update logic (Simplified from original for brevity, but retaining core logic)
      if (data.contractStartDate && data.contractEndDate && crewMember.activeContract) {
        const contractUpdateData = {
          startDate: new Date(data.contractStartDate + 'T00:00:00.000Z'),
          endDate: new Date(data.contractEndDate + 'T00:00:00.000Z'),
        };
        await fetch(`/api/contracts/${crewMember.activeContract.id}`, {
          method: 'PUT',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(contractUpdateData),
        });
      } else if (data.contractStartDate && data.contractEndDate && !crewMember.activeContract && data.currentVesselId) {
        // Create contract if missing but dates provided
        const contractCreateData = {
          crewMemberId: crewMember.id,
          vesselId: data.currentVesselId, // Default to selected vessel
          startDate: new Date(data.contractStartDate + 'T00:00:00.000Z'),
          endDate: new Date(data.contractEndDate + 'T00:00:00.000Z'),
          durationDays: data.contractDurationDays || 90,
          status: 'active',
          contractType: 'SEA',
        };
        await fetch('/api/contracts', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(contractCreateData),
        });
      }

      // Update Documents
      await updateOrCreateDocument('passport', data.passportNumber, data.passportPlaceOfIssue, data.passportIssueDate, data.passportExpiryDate, passport, data.passportNotApplicable);
      await updateOrCreateDocument('cdc', data.cdcNumber, data.cdcPlaceOfIssue, data.cdcIssueDate, data.cdcExpiryDate, cdc, data.cdcNotApplicable);

      if (!data.cocNotApplicable) {
        await updateOrCreateDocument('coc', data.cocGradeNo, data.cocPlaceOfIssue, data.cocIssueDate, data.cocExpiryDate, coc, false);
      }

      await updateOrCreateDocument('medical', data.medicalApprovalNo, data.medicalIssuingAuthority, data.medicalIssueDate, data.medicalExpiryDate, medical, data.medicalNotApplicable);
      await updateOrCreateDocument('stcw_course', data.stcwNumber, data.stcwIssuingAuthority, data.stcwIssueDate, data.stcwExpiryDate, stcw, data.stcwNotApplicable);
      await updateOrCreateDocument('sid', data.sidNumber, data.sidPlaceOfIssue, data.sidIssueDate, data.sidExpiryDate, sid);

      const response = await fetch(`/api/crew/${crewMember.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update crew member: ${response.status} - ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({ title: 'Success', description: 'Crew member updated successfully' });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const onSubmit = (data: EditCrewFormData) => {
    updateCrewMutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error('Edit Crew Form Validation Errors:', errors);
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => {
        // Handle nested errors if necessary, but most are top-level here
        const message = error.message || 'Invalid value';
        const fieldName = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        return `${fieldName}: ${message}`;
      })
      .join(', ');

    toast({
      title: 'Validation Error',
      description: `Please correct the following fields: ${errorMessages}`,
      variant: 'destructive',
    });
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col h-[80vh] w-full max-w-5xl mx-auto bg-white dark:bg-gray-950 rounded-lg overflow-hidden shadow-xl">
        <div className="flex flex-1 overflow-hidden">
          <CrewFormSidebar activeTab={activeTab} setActiveTab={setActiveTab} title="Edit Crew Member" />
          <CrewFormContent activeTab={activeTab} crewMember={crewMember} vessels={vessels} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <Button type="button" variant="outline" onClick={onSuccess} className="bg-white dark:bg-gray-800">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateCrewMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {updateCrewMutation.isPending ? 'Updating...' : 'Update Crew Member'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

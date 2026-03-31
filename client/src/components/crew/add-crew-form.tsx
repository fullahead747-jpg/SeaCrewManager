import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { CrewFormSidebar } from './crew-form-sidebar';
import { CrewFormContent } from './crew-form-content';
import { Vessel } from '@shared/schema';
import { OCRDocumentScanner } from './OCRDocumentScanner';

const addCrewSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().or(z.literal('')),
  nationality: z.string().min(1, 'Nationality is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  rank: z.string().min(1, 'Rank is required'),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  status: z.enum(['onBoard', 'onShore']),
  currentVesselId: z.string().optional().nullable(),

  // Emergency Contact (Flattened)
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactEmail: z.string().optional(),
  emergencyContactPostalAddress: z.string().optional(),

  // Contract
  contractStartDate: z.string().optional(),
  contractDurationDays: z.number().optional(),
  contractEndDate: z.string().optional(),

  // Documents
  passportNumber: z.string().optional(),
  passportPlaceOfIssue: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportExpiryDate: z.string().optional(),
  passportTbd: z.boolean().optional(),

  cdcNumber: z.string().optional(),
  cdcPlaceOfIssue: z.string().optional(),
  cdcIssueDate: z.string().optional(),
  cdcExpiryDate: z.string().optional(),
  cdcTbd: z.boolean().optional(),

  cocGradeNo: z.string().optional(),
  cocPlaceOfIssue: z.string().optional(),
  cocIssueDate: z.string().optional(),
  cocExpiryDate: z.string().optional(),
  cocNotApplicable: z.boolean().optional(),

  medicalIssuingAuthority: z.string().optional(),
  medicalApprovalNo: z.string().optional(),
  medicalIssueDate: z.string().optional(),
  medicalExpiryDate: z.string().optional(),
  medicalTbd: z.boolean().optional(),

  stcwNumber: z.string().optional(),
  stcwIssuingAuthority: z.string().optional(),
  stcwIssueDate: z.string().optional(),
  stcwExpiryDate: z.string().optional(),
  stcwTbd: z.boolean().optional(),
});

type AddCrewFormData = z.infer<typeof addCrewSchema>;

interface AddCrewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVesselId?: string;
}

export default function AddCrewForm({ open, onOpenChange, defaultVesselId }: AddCrewFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [scannedAoaFile, setScannedAoaFile] = useState<File | null>(null);

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
      contractDurationDays: 90,
      contractEndDate: '',
      currentVesselId: defaultVesselId,
      emergencyContactName: '',
      emergencyContactRelationship: '',
      emergencyContactPhone: '',
      emergencyContactEmail: '',
      emergencyContactPostalAddress: '',
      passportNumber: '',
      passportPlaceOfIssue: '',
      passportIssueDate: '',
      passportExpiryDate: '',
      cdcNumber: '',
      cdcPlaceOfIssue: '',
      cdcIssueDate: '',
      cdcExpiryDate: '',
      cocGradeNo: '',
      cocPlaceOfIssue: '',
      cocIssueDate: '',
      cocExpiryDate: '',
      cocNotApplicable: false,
      medicalIssuingAuthority: '',
      medicalApprovalNo: '',
      medicalIssueDate: '',
      medicalExpiryDate: '',
      passportTbd: false,
      cdcTbd: false,
      medicalTbd: false,
      stcwNumber: '',
      stcwIssuingAuthority: '',
      stcwIssueDate: '',
      stcwExpiryDate: '',
      stcwTbd: false,
    },
  });

  useEffect(() => {
    if (defaultVesselId) {
      form.setValue('currentVesselId', defaultVesselId);
    }
  }, [defaultVesselId, form]);

  const convertDateToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim().replace(/\s+/g, '-').toUpperCase();

    // Already in YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;

    const months: { [key: string]: string } = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };

    // Format: DD-MMM-YYYY or DD MMM YYYY or DD/MMM/YYYY
    const mmmMatch = cleanStr.match(/(\d{1,2})[-/. ]([A-Z]{3})[-/. ](\d{4})/i);
    if (mmmMatch) {
      const [, day, month, year] = mmmMatch;
      const monthNum = months[month.toUpperCase()];
      if (monthNum) return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }

    // Format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = cleanStr.match(/(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      // Heuristic: assume DD/MM/YYYY for seafaring docs if month <= 12
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      if (m <= 12) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else if (d <= 12) {
        // Fallback for MM/DD/YYYY
        return `${year}-${day.padStart(2, '0')}-${month.padStart(2, '0')}`;
      }
    }

    return dateStr;
  };

  const handleOCRDataExtracted = (extractedData: any) => {
    const setValueOptions = { shouldDirty: true, shouldTouch: true, shouldValidate: true };

    // Capture the scanned file if present
    if (extractedData.scannedFile) {
      setScannedAoaFile(extractedData.scannedFile);
    }

    // Standard Identity Fields
    if (extractedData.firstName) form.setValue('firstName', extractedData.firstName, setValueOptions);
    if (extractedData.lastName) form.setValue('lastName', extractedData.lastName, setValueOptions);
    if (extractedData.nationality) form.setValue('nationality', extractedData.nationality, setValueOptions);
    if (extractedData.dateOfBirth) form.setValue('dateOfBirth', convertDateToISO(extractedData.dateOfBirth), setValueOptions);
    if (extractedData.rank) form.setValue('rank', extractedData.rank, setValueOptions);
    if (extractedData.phoneNumber) form.setValue('phoneNumber', extractedData.phoneNumber, setValueOptions);
    if (extractedData.email) form.setValue('email', extractedData.email, setValueOptions);

    // Emergency Contact
    if (extractedData.emergencyContactName) form.setValue('emergencyContactName', extractedData.emergencyContactName, setValueOptions);
    if (extractedData.emergencyContactRelationship) form.setValue('emergencyContactRelationship', extractedData.emergencyContactRelationship, setValueOptions);
    if (extractedData.emergencyContactPhone) form.setValue('emergencyContactPhone', extractedData.emergencyContactPhone, setValueOptions);
    if (extractedData.emergencyContactEmail) form.setValue('emergencyContactEmail', extractedData.emergencyContactEmail, setValueOptions);
    if (extractedData.emergencyContactPostalAddress) form.setValue('emergencyContactPostalAddress', extractedData.emergencyContactPostalAddress, setValueOptions);

    // Passport
    if (extractedData.passportNumber) form.setValue('passportNumber', extractedData.passportNumber, setValueOptions);
    if (extractedData.passportPlaceOfIssue) form.setValue('passportPlaceOfIssue', extractedData.passportPlaceOfIssue, setValueOptions);
    if (extractedData.passportIssueDate) form.setValue('passportIssueDate', convertDateToISO(extractedData.passportIssueDate), setValueOptions);
    if (extractedData.passportExpiryDate) form.setValue('passportExpiryDate', convertDateToISO(extractedData.passportExpiryDate), setValueOptions);

    // CDC
    if (extractedData.cdcNumber) form.setValue('cdcNumber', extractedData.cdcNumber, setValueOptions);
    if (extractedData.cdcPlaceOfIssue) form.setValue('cdcPlaceOfIssue', extractedData.cdcPlaceOfIssue, setValueOptions);
    if (extractedData.cdcIssueDate) form.setValue('cdcIssueDate', convertDateToISO(extractedData.cdcIssueDate), setValueOptions);
    if (extractedData.cdcExpiryDate) form.setValue('cdcExpiryDate', convertDateToISO(extractedData.cdcExpiryDate), setValueOptions);

    // COC
    if (extractedData.cocGradeNo) form.setValue('cocGradeNo', extractedData.cocGradeNo, setValueOptions);
    if (extractedData.cocPlaceOfIssue) form.setValue('cocPlaceOfIssue', extractedData.cocPlaceOfIssue, setValueOptions);
    if (extractedData.cocIssueDate) form.setValue('cocIssueDate', convertDateToISO(extractedData.cocIssueDate), setValueOptions);
    if (extractedData.cocExpiryDate) form.setValue('cocExpiryDate', convertDateToISO(extractedData.cocExpiryDate), setValueOptions);

    // Medical
    if (extractedData.medicalIssuingAuthority) form.setValue('medicalIssuingAuthority', extractedData.medicalIssuingAuthority, setValueOptions);
    if (extractedData.medicalApprovalNo) form.setValue('medicalApprovalNo', extractedData.medicalApprovalNo, setValueOptions);
    if (extractedData.medicalIssueDate) form.setValue('medicalIssueDate', convertDateToISO(extractedData.medicalIssueDate), setValueOptions);
    if (extractedData.medicalExpiryDate) form.setValue('medicalExpiryDate', convertDateToISO(extractedData.medicalExpiryDate), setValueOptions);

    // Employment / Contract
    if (extractedData.contractStartDate) {
      form.setValue('contractStartDate', convertDateToISO(extractedData.contractStartDate), setValueOptions);
    }
    if (extractedData.engagementPeriodMonths) {
      const durationDays = extractedData.engagementPeriodMonths * 30;
      form.setValue('contractDurationDays', durationDays, setValueOptions);
      const startDate = form.getValues('contractStartDate');
      if (startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + durationDays);
        form.setValue('contractEndDate', end.toISOString().split('T')[0], setValueOptions);
      }
    }

    toast({
      title: "Data Extracted",
      description: "Form fields populated from uploaded document.",
    });
  };

  const addCrewMutation = useMutation({
    mutationFn: async (data: AddCrewFormData) => {
      // 1. Create the Crew Member
      const crewData = {
        userId: undefined,
        firstName: data.firstName,
        lastName: data.lastName,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        rank: data.rank,
        phoneNumber: data.phoneNumber || undefined,
        email: data.email || undefined,
        currentVesselId: data.currentVesselId || null,
        status: data.status,
        emergencyContact: {
          name: data.emergencyContactName,
          relationship: data.emergencyContactRelationship,
          phone: data.emergencyContactPhone,
          email: data.emergencyContactEmail,
          postalAddress: data.emergencyContactPostalAddress,
        },
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

      // 1.5 Handle Scanned AOA File Upload
      let aoaFilePath = undefined;
      if (scannedAoaFile) {
        try {
          const formData = new FormData();
          formData.append('file', scannedAoaFile);
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { ...getAuthHeaders() }, // Browser sets boundary automatically
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            aoaFilePath = uploadData.filePath;
            console.log('[AddCrew] Scanned AOA file uploaded:', aoaFilePath);
          }
        } catch (uploadError) {
          console.error('[AddCrew] Failed to upload scanned AOA file:', uploadError);
        }
      }

      // 2. Create Documents
      const createDocument = async (type: string, docData: any, filePath?: string) => {
        if (!docData.documentNumber && !docData.tbd && !docData.notApplicable && !filePath) return;

        // Ensure we have a document number for required field if it's AOA
        const documentNumber = docData.documentNumber || (type === 'aoa' ? `AOA-${Date.now()}` : '');
        const issuingAuthority = docData.issuingAuthority || (type === 'aoa' ? 'OCR Scanner' : '');
        const issueDate = docData.issueDate ? new Date(docData.issueDate + 'T00:00:00.000Z') : (type === 'aoa' ? new Date() : null);

        await fetch('/api/documents', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crewMemberId: newCrewMember.id,
            type,
            documentNumber,
            issuingAuthority,
            issueDate,
            expiryDate: docData.tbd ? null : (docData.expiryDate ? new Date(docData.expiryDate + 'T00:00:00.000Z') : null),
            filePath: filePath,
          }),
        });
      };

      await createDocument('passport', {
        documentNumber: data.passportNumber,
        issuingAuthority: data.passportPlaceOfIssue,
        issueDate: data.passportIssueDate,
        expiryDate: data.passportExpiryDate,
        tbd: data.passportTbd
      });

      await createDocument('cdc', {
        documentNumber: data.cdcNumber,
        issuingAuthority: data.cdcPlaceOfIssue,
        issueDate: data.cdcIssueDate,
        expiryDate: data.cdcExpiryDate,
        tbd: data.cdcTbd
      });

      if (!data.cocNotApplicable) {
        await createDocument('coc', {
          documentNumber: data.cocGradeNo,
          issuingAuthority: data.cocPlaceOfIssue,
          issueDate: data.cocIssueDate,
          expiryDate: data.cocExpiryDate
        });
      }

      await createDocument('medical', {
        documentNumber: data.medicalApprovalNo,
        issuingAuthority: data.medicalIssuingAuthority,
        issueDate: data.medicalIssueDate,
        expiryDate: data.medicalExpiryDate,
        tbd: data.medicalTbd
      });

      await createDocument('stcw_course', {
        documentNumber: data.stcwNumber,
        issuingAuthority: data.stcwIssuingAuthority,
        issueDate: data.stcwIssueDate,
        expiryDate: data.stcwExpiryDate,
        tbd: data.stcwTbd
      });

      // Create AOA document record if we have a file
      if (aoaFilePath) {
        await createDocument('aoa', {
          documentNumber: `AOA-${Date.now()}`,
          issuingAuthority: 'System',
          issueDate: data.contractStartDate || new Date().toISOString().split('T')[0],
          expiryDate: data.contractEndDate
        }, aoaFilePath);
      }

      // 3. Create Contract (if details provided)
      if (data.contractStartDate && data.contractDurationDays) {
        const contractData = {
          crewMemberId: newCrewMember.id,
          vesselId: data.currentVesselId || vessels[0]?.id, // Fallback if no vessel selected but contract added? Ideally validation prevents this
          startDate: new Date(data.contractStartDate + 'T00:00:00.000Z'),
          endDate: data.contractEndDate ? new Date(data.contractEndDate + 'T00:00:00.000Z') : null,
          durationDays: data.contractDurationDays,
          status: 'active',
          contractType: 'SEA',
          filePath: aoaFilePath, // Associate the AOA file with the contract
        };

        // Only create contract if we have a vessel ID (either selected or fallback logic)
        if (contractData.vesselId) {
          await fetch('/api/contracts', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(contractData),
          });
        }
      }

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
      setScannedAoaFile(null); // Clear the scanned file
      form.reset();
      onOpenChange(false);
      setActiveTab('overview');
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
      <DialogContent className="w-[95vw] max-w-[1200px] h-[85vh] p-0 overflow-hidden bg-transparent border-none shadow-none">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full w-full bg-white dark:bg-gray-950 rounded-lg overflow-hidden shadow-xl">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <OCRDocumentScanner onDataExtracted={handleOCRDataExtracted} mode="seafarer" className="w-full" />
            </div>
            <div className="flex flex-1 overflow-hidden">
              <CrewFormSidebar activeTab={activeTab} setActiveTab={setActiveTab} title="Add New Crew Member" />
              <CrewFormContent activeTab={activeTab} vessels={vessels} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-white dark:bg-gray-800">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addCrewMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addCrewMutation.isPending ? 'Adding...' : 'Add Crew Member'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
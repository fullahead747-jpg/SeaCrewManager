import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, Plus, Eye, UserMinus, Edit, LogOut, LogIn, Trash2, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OCRDocumentScanner } from '@/components/crew/OCRDocumentScanner';
import { format } from 'date-fns';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CrewMemberWithDetails } from '@shared/schema';
import type { VesselWithDetails } from './vessel-cards';
import { formatDate } from '@/lib/utils';

// Add crew form schema
const addCrewSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  rank: z.string().min(1, 'Rank is required'),
  phoneNumber: z.string().optional(),
  status: z.enum(['onBoard', 'onShore']).default('onBoard'),
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
  cocNotApplicable: z.boolean().optional().default(false),
  passportTbd: z.boolean().optional().default(false),
  cdcTbd: z.boolean().optional().default(false),
  cocTbd: z.boolean().optional().default(false),
  medicalTbd: z.boolean().optional().default(false),
});

type AddCrewFormData = z.infer<typeof addCrewSchema>;

interface CrewManagementDialogProps {
  vessel: VesselWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CrewManagementDialog({ vessel, open, onOpenChange }: CrewManagementDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedCrewForView, setSelectedCrewForView] = useState<CrewMemberWithDetails | null>(null);
  const [showAddCrewDialog, setShowAddCrewDialog] = useState(false);
  const [selectedCrewForEdit, setSelectedCrewForEdit] = useState<CrewMemberWithDetails | null>(null);
  const [showEditCrewDialog, setShowEditCrewDialog] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedCrewForContract, setSelectedCrewForContract] = useState<CrewMemberWithDetails | null>(null);
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractDuration, setContractDuration] = useState('90');
  const [contractEndDate, setContractEndDate] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [originalStatus, setOriginalStatus] = useState<string>('');
  const [signOffDialogOpen, setSignOffDialogOpen] = useState(false);
  const [selectedCrewForSignOff, setSelectedCrewForSignOff] = useState<CrewMemberWithDetails | null>(null);
  const [signOffReason, setSignOffReason] = useState('');
  const [signOnDialogOpen, setSignOnDialogOpen] = useState(false);
  const [selectedCrewForSignOn, setSelectedCrewForSignOn] = useState<CrewMemberWithDetails | null>(null);
  const [signOnReason, setSignOnReason] = useState('');
  const [deleteCrewDialogOpen, setDeleteCrewDialogOpen] = useState(false);
  const [selectedCrewForDeletion, setSelectedCrewForDeletion] = useState<CrewMemberWithDetails | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add crew form
  const addCrewForm = useForm<AddCrewFormData>({
    resolver: zodResolver(addCrewSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: '',
      dateOfBirth: '',
      rank: '',
      phoneNumber: '',
      status: 'onBoard',
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
      medicalIssuingAuthority: '',
      medicalApprovalNo: '',
      medicalIssueDate: '',
      medicalExpiryDate: '',
      cocNotApplicable: false,
      passportTbd: false,
      cdcTbd: false,
      cocTbd: false,
      medicalTbd: false,
    },
  });

  // Edit crew form
  const editCrewForm = useForm<AddCrewFormData>({
    resolver: zodResolver(addCrewSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      nationality: '',
      dateOfBirth: '',
      rank: '',
      phoneNumber: '',
      status: 'onBoard',
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
      medicalIssuingAuthority: '',
      medicalApprovalNo: '',
      medicalIssueDate: '',
      medicalExpiryDate: '',
      cocNotApplicable: false,
      passportTbd: false,
      cdcTbd: false,
      cocTbd: false,
      medicalTbd: false,
    },
  });

  // Reset edit form when selected crew member changes to populate fields
  useEffect(() => {
    if (selectedCrewForEdit) {
      const passport = selectedCrewForEdit.documents?.find(d => d.type === 'passport');
      const cdc = selectedCrewForEdit.documents?.find(d => d.type === 'cdc');
      const coc = selectedCrewForEdit.documents?.find(d => d.type === 'coc');
      const medical = selectedCrewForEdit.documents?.find(d => d.type === 'medical');

      editCrewForm.reset({
        firstName: selectedCrewForEdit.firstName,
        lastName: selectedCrewForEdit.lastName,
        nationality: selectedCrewForEdit.nationality,
        dateOfBirth: typeof selectedCrewForEdit.dateOfBirth === 'string'
          ? selectedCrewForEdit.dateOfBirth
          : new Date(selectedCrewForEdit.dateOfBirth).toISOString().split('T')[0],
        rank: selectedCrewForEdit.rank,
        phoneNumber: selectedCrewForEdit.phoneNumber || '',
        status: selectedCrewForEdit.status as 'onBoard' | 'onShore',
        emergencyContactName: (selectedCrewForEdit.emergencyContact as any)?.name || '',
        emergencyContactRelationship: (selectedCrewForEdit.emergencyContact as any)?.relationship || '',
        emergencyContactPhone: (selectedCrewForEdit.emergencyContact as any)?.phone || '',
        emergencyContactEmail: (selectedCrewForEdit.emergencyContact as any)?.email || '',
        emergencyContactPostalAddress: (selectedCrewForEdit.emergencyContact as any)?.postalAddress || '',
        passportNumber: passport?.documentNumber || '',
        passportPlaceOfIssue: passport?.issuingAuthority || '',
        passportIssueDate: passport?.issueDate ? new Date(passport.issueDate).toISOString().split('T')[0] : '',
        passportExpiryDate: passport?.expiryDate ? new Date(passport.expiryDate).toISOString().split('T')[0] : '',
        cdcNumber: cdc?.documentNumber || '',
        cdcPlaceOfIssue: cdc?.issuingAuthority || '',
        cdcIssueDate: cdc?.issueDate ? new Date(cdc.issueDate).toISOString().split('T')[0] : '',
        cdcExpiryDate: cdc?.expiryDate ? new Date(cdc.expiryDate).toISOString().split('T')[0] : '',
        cocGradeNo: coc?.documentNumber || '',
        cocPlaceOfIssue: coc?.issuingAuthority || '',
        cocIssueDate: coc?.issueDate ? new Date(coc.issueDate).toISOString().split('T')[0] : '',
        cocExpiryDate: coc?.expiryDate ? new Date(coc.expiryDate).toISOString().split('T')[0] : '',
        medicalIssuingAuthority: medical?.issuingAuthority || '',
        medicalApprovalNo: medical?.documentNumber || '',
        medicalIssueDate: medical?.issueDate ? new Date(medical.issueDate).toISOString().split('T')[0] : '',
        medicalExpiryDate: medical?.expiryDate ? new Date(medical.expiryDate).toISOString().split('T')[0] : '',
        cocNotApplicable: selectedCrewForEdit.cocNotApplicable || false,
      });
      setOriginalStatus(selectedCrewForEdit.status);
    }
  }, [selectedCrewForEdit, editCrewForm]);

  const { data: crewMembers = [], isLoading } = useQuery<CrewMemberWithDetails[]>({
    queryKey: ['/api/crew', { vesselId: vessel?.id }],
    queryFn: async () => {
      if (!vessel) return [];
      const response = await fetch(`/api/crew?vesselId=${vessel.id}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
    enabled: !!vessel && open,
  });

  const { data: allCrew = [] } = useQuery<CrewMemberWithDetails[]>({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch all crew');
      return response.json();
    },
    enabled: open,
  });

  // Fetch all vessels for assignment dropdown
  const { data: vessels = [] } = useQuery<VesselWithDetails[]>({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
    enabled: open,
  });

  const availableCrew = allCrew.filter(member => !member.currentVesselId);

  // Remove debug logging since functionality is working
  // Debug available crew silently
  if (availableCrew.length > 0) {
    console.log(`${availableCrew.length} crew members signed off and available for assignment to ${vessel?.name}`);
  }

  const filteredCrew = crewMembers.filter(member =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.rank.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.nationality.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (contractStatus?: string) => {
    if (contractStatus === 'active') return 'bg-compliance-green text-white';
    return 'bg-gray-500 text-white';
  };

  // Calculate contract end date based on start date and duration
  const calculateEndDate = (startDate: string, durationDays: string) => {
    if (!startDate || !durationDays) return '';
    const start = new Date(startDate);
    const duration = parseInt(durationDays);
    if (isNaN(duration)) return '';
    const end = new Date(start);
    end.setDate(end.getDate() + duration);
    return end.toISOString().split('T')[0];
  };

  // Update end date when start date or duration changes
  const handleContractStartDateChange = (value: string) => {
    setContractStartDate(value);
    const endDate = calculateEndDate(value, contractDuration);
    setContractEndDate(endDate);
  };

  const handleContractDurationChange = (value: string) => {
    setContractDuration(value);
    const endDate = calculateEndDate(contractStartDate, value);
    setContractEndDate(endDate);
  };

  // Helper to convert date formats from OCR (DD-MMM-YYYY) to ISO (YYYY-MM-DD)
  const convertDateToISO = (dateStr: string): string => {
    if (!dateStr) return '';
    // If already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Convert DD-MMM-YYYY to ISO
    const months: { [key: string]: string } = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };
    const match = dateStr.match(/(\d{2})-([A-Z]{3})-(\d{4})/i);
    if (match) {
      const [, day, month, year] = match;
      const monthNum = months[month.toUpperCase()];
      if (monthNum) return `${year}-${monthNum}-${day}`;
    }
    return dateStr;
  };

  // Handle OCR data extraction to populate Add Crew form
  const handleOCRDataExtracted = (extractedData: any) => {
    console.log('OCR data received in handleOCRDataExtracted:', extractedData);
    const setValueOptions = { shouldDirty: true, shouldTouch: true, shouldValidate: false };

    // Parse name into first and last name
    if (extractedData.seafarerName || extractedData.name) {
      const fullName = extractedData.seafarerName || extractedData.name || '';
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        addCrewForm.setValue('firstName', nameParts.slice(0, -1).join(' '), setValueOptions);
        addCrewForm.setValue('lastName', nameParts[nameParts.length - 1], setValueOptions);
      } else if (nameParts.length === 1) {
        addCrewForm.setValue('firstName', nameParts[0], setValueOptions);
      }
    }

    // Nationality
    if (extractedData.seafarerNationality) {
      addCrewForm.setValue('nationality', extractedData.seafarerNationality, setValueOptions);
    }

    // Date of birth - extract from combined field
    if (extractedData.seafarerDatePlaceOfBirth) {
      const dobMatch = extractedData.seafarerDatePlaceOfBirth.match(/(\d{2}-[A-Z]{3}-\d{4})/i);
      if (dobMatch) {
        addCrewForm.setValue('dateOfBirth', convertDateToISO(dobMatch[1]), setValueOptions);
      }
    }

    // Phone/Mobile
    if (extractedData.seafarerMobile) {
      addCrewForm.setValue('phoneNumber', extractedData.seafarerMobile, setValueOptions);
    }

    // Passport details
    if (extractedData.passportNumber) {
      console.log('Setting passport number:', extractedData.passportNumber);
      addCrewForm.setValue('passportNumber', extractedData.passportNumber, setValueOptions);
    }
    if (extractedData.passportPlaceOfIssue) {
      addCrewForm.setValue('passportPlaceOfIssue', extractedData.passportPlaceOfIssue, setValueOptions);
    }
    if (extractedData.passportIssueDate) {
      addCrewForm.setValue('passportIssueDate', convertDateToISO(extractedData.passportIssueDate), setValueOptions);
    }
    if (extractedData.passportExpiryDate) {
      addCrewForm.setValue('passportExpiryDate', convertDateToISO(extractedData.passportExpiryDate), setValueOptions);
    }

    // CDC details
    if (extractedData.cdcNumber) {
      console.log('Setting CDC number:', extractedData.cdcNumber);
      addCrewForm.setValue('cdcNumber', extractedData.cdcNumber, setValueOptions);
    }
    if (extractedData.cdcPlaceOfIssue) {
      addCrewForm.setValue('cdcPlaceOfIssue', extractedData.cdcPlaceOfIssue, setValueOptions);
    }
    if (extractedData.cdcIssueDate) {
      addCrewForm.setValue('cdcIssueDate', convertDateToISO(extractedData.cdcIssueDate), setValueOptions);
    }
    if (extractedData.cdcExpiryDate) {
      addCrewForm.setValue('cdcExpiryDate', convertDateToISO(extractedData.cdcExpiryDate), setValueOptions);
    }

    // COC details
    if (extractedData.cocGradeNo) {
      console.log('Setting COC grade/no:', extractedData.cocGradeNo);
      addCrewForm.setValue('cocGradeNo', extractedData.cocGradeNo, setValueOptions);
    }
    if (extractedData.cocPlaceOfIssue) {
      addCrewForm.setValue('cocPlaceOfIssue', extractedData.cocPlaceOfIssue, setValueOptions);
    }
    if (extractedData.cocIssueDate) {
      addCrewForm.setValue('cocIssueDate', convertDateToISO(extractedData.cocIssueDate), setValueOptions);
    }
    if (extractedData.cocExpiryDate) {
      addCrewForm.setValue('cocExpiryDate', convertDateToISO(extractedData.cocExpiryDate), setValueOptions);
    }

    // Medical certificate details
    if (extractedData.medicalIssuingAuthority) {
      addCrewForm.setValue('medicalIssuingAuthority', extractedData.medicalIssuingAuthority, setValueOptions);
    }
    if (extractedData.medicalApprovalNo) {
      console.log('Setting medical approval no:', extractedData.medicalApprovalNo);
      addCrewForm.setValue('medicalApprovalNo', extractedData.medicalApprovalNo, setValueOptions);
    }
    if (extractedData.medicalIssueDate) {
      addCrewForm.setValue('medicalIssueDate', convertDateToISO(extractedData.medicalIssueDate), setValueOptions);
    }
    if (extractedData.medicalExpiryDate) {
      addCrewForm.setValue('medicalExpiryDate', convertDateToISO(extractedData.medicalExpiryDate), setValueOptions);
    }

    // Emergency contact / NOK details
    if (extractedData.nokName) {
      addCrewForm.setValue('emergencyContactName', extractedData.nokName, setValueOptions);
    }
    if (extractedData.nokRelationship) {
      addCrewForm.setValue('emergencyContactRelationship', extractedData.nokRelationship, setValueOptions);
    }
    if (extractedData.nokTelephone) {
      addCrewForm.setValue('emergencyContactPhone', extractedData.nokTelephone, setValueOptions);
    }
    if (extractedData.nokEmail) {
      addCrewForm.setValue('emergencyContactEmail', extractedData.nokEmail, setValueOptions);
    }
    if (extractedData.nokPostalAddress) {
      addCrewForm.setValue('emergencyContactPostalAddress', extractedData.nokPostalAddress, setValueOptions);
    }

    // Contract dates
    if (extractedData.contractStartDate) {
      const startDate = convertDateToISO(extractedData.contractStartDate);
      addCrewForm.setValue('contractStartDate', startDate, setValueOptions);
    }
    if (extractedData.engagementPeriodMonths) {
      const durationDays = extractedData.engagementPeriodMonths * 30;
      addCrewForm.setValue('contractDurationDays', durationDays, setValueOptions);
      // Calculate end date
      const startDate = addCrewForm.getValues('contractStartDate');
      if (startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + durationDays);
        addCrewForm.setValue('contractEndDate', end.toISOString().split('T')[0], setValueOptions);
      }
    }

    // Log the final form values after setting
    console.log('Form values after OCR extraction:', addCrewForm.getValues());
  };

  // Assign crew member mutation with flexible vessel assignment
  const assignCrewMutation = useMutation({
    mutationFn: async ({ crewId, vesselId }: { crewId: string; vesselId: string }) => {
      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentVesselId: vesselId,
          status: 'onBoard',
          signOffDate: null,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to assign crew member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Success',
        description: 'Crew member assigned successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign crew member',
        variant: 'destructive',
      });
    },
  });

  // Contract creation mutation
  const createContractMutation = useMutation({
    mutationFn: async (data: { crewId: string; vesselId: string; startDate: string; durationDays: number; endDate: string }) => {
      // First, get all active contracts for this crew member and terminate them
      const getContractsResponse = await fetch(`/api/contracts?crewMemberId=${data.crewId}`, {
        headers: getAuthHeaders(),
      });

      if (getContractsResponse.ok) {
        const existingContracts = await getContractsResponse.json();
        const activeContracts = existingContracts.filter((c: any) => c.status === 'active');

        // Terminate all active contracts
        await Promise.all(
          activeContracts.map((contract: any) =>
            fetch(`/api/contracts/${contract.id}`, {
              method: 'PUT',
              headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'completed' }),
            })
          )
        );
      }

      // Now create the new contract
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crewMemberId: data.crewId,
          vesselId: data.vesselId,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          durationDays: data.durationDays,
          status: 'active',
        }),
      });
      if (!response.ok) throw new Error('Failed to create contract');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: 'Success',
        description: 'Contract created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create contract',
        variant: 'destructive',
      });
    },
  });

  // Add new crew member mutation
  const addCrewMutation = useMutation({
    mutationFn: async (data: AddCrewFormData) => {
      console.log('Add crew form data received:', JSON.stringify(data, null, 2));
      console.log('Document fields:', {
        passportNumber: data.passportNumber,
        passportExpiryDate: data.passportExpiryDate,
        cdcNumber: data.cdcNumber,
        cdcExpiryDate: data.cdcExpiryDate,
        cocGradeNo: data.cocGradeNo,
        cocExpiryDate: data.cocExpiryDate,
        medicalApprovalNo: data.medicalApprovalNo,
        medicalExpiryDate: data.medicalExpiryDate,
      });
      const crewData = {
        firstName: data.firstName,
        lastName: data.lastName,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        rank: data.rank,
        phoneNumber: data.phoneNumber || null,
        status: data.status,
        currentVesselId: vessel?.id || null,
        emergencyContact: data.emergencyContactName ? {
          name: data.emergencyContactName,
          relationship: data.emergencyContactRelationship || '',
          phone: data.emergencyContactPhone || '',
          email: data.emergencyContactEmail || '',
          postalAddress: data.emergencyContactPostalAddress || '',
        } : null,
        cocNotApplicable: data.cocNotApplicable || false,
      };

      const response = await fetch('/api/crew', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(crewData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'DUPLICATE_CREW_MEMBER') {
          throw new Error(errorData.message || 'This crew member already exists on the same vessel.');
        }
        throw new Error(errorData.message || 'Failed to create crew member');
      }
      const newCrewMember = await response.json();

      // Create documents for the new crew member
      const documentsToCreate = [];

      if (data.passportNumber || data.passportExpiryDate || data.passportTbd) {
        documentsToCreate.push({
          crewMemberId: newCrewMember.id,
          type: 'passport',
          documentNumber: data.passportNumber || 'N/A',
          issuingAuthority: data.passportPlaceOfIssue || 'Unknown',
          issueDate: data.passportIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.passportTbd ? null : (data.passportExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      if (data.cdcNumber || data.cdcExpiryDate || data.cdcTbd) {
        documentsToCreate.push({
          crewMemberId: newCrewMember.id,
          type: 'cdc',
          documentNumber: data.cdcNumber || 'N/A',
          issuingAuthority: data.cdcPlaceOfIssue || 'Unknown',
          issueDate: data.cdcIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.cdcTbd ? null : (data.cdcExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      if (!data.cocNotApplicable && (data.cocGradeNo || data.cocExpiryDate || data.cocTbd)) {
        documentsToCreate.push({
          crewMemberId: newCrewMember.id,
          type: 'coc',
          documentNumber: data.cocGradeNo || 'N/A',
          issuingAuthority: data.cocPlaceOfIssue || 'Unknown',
          issueDate: data.cocIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.cocTbd ? null : (data.cocExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      if (data.medicalApprovalNo || data.medicalExpiryDate || data.medicalTbd) {
        documentsToCreate.push({
          crewMemberId: newCrewMember.id,
          type: 'medical',
          documentNumber: data.medicalApprovalNo || 'N/A',
          issuingAuthority: data.medicalIssuingAuthority || 'Unknown',
          issueDate: data.medicalIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.medicalTbd ? null : (data.medicalExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      // Create all documents
      console.log('Creating documents:', documentsToCreate);
      for (const doc of documentsToCreate) {
        try {
          const docResponse = await fetch('/api/documents', {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(doc),
          });
          if (!docResponse.ok) {
            const errorData = await docResponse.json().catch(() => ({}));
            console.error('Failed to create document:', doc.type, errorData);
          } else {
            console.log('Document created successfully:', doc.type);
          }
        } catch (docError) {
          console.error('Error creating document:', doc.type, docError);
        }
      }

      // Create contract if contract dates are provided
      if (data.contractStartDate && data.contractEndDate && vessel?.id) {
        await fetch('/api/contracts', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            crewMemberId: newCrewMember.id,
            vesselId: vessel.id,
            startDate: new Date(data.contractStartDate),
            endDate: new Date(data.contractEndDate),
            durationDays: data.contractDurationDays || 90,
            status: 'active',
          }),
        });
      }

      return newCrewMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      toast({
        title: 'Success',
        description: 'New crew member added successfully',
      });
      setShowAddCrewDialog(false);
      addCrewForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add crew member',
        variant: 'destructive',
      });
    },
  });

  // Remove crew member from vessel mutation
  const removeCrewMutation = useMutation({
    mutationFn: async (crewId: string) => {
      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentVesselId: null }),
      });
      if (!response.ok) {
        throw new Error('Failed to remove crew member from vessel');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Success',
        description: 'Crew member removed from vessel successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove crew member from vessel',
        variant: 'destructive',
      });
    },
  });

  // Sign off crew member mutation
  const signOffCrewMutation = useMutation({
    mutationFn: async ({ crewId, reason }: { crewId: string; reason: string }) => {
      const crewMember = crewMembers?.find((member: CrewMemberWithDetails) => member.id === crewId);
      const lastVesselId = crewMember?.currentVesselId || null;

      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentVesselId: null,
          lastVesselId: lastVesselId,
          status: 'onShore',
          signOffDate: new Date().toISOString(),
          statusChangeReason: reason,
        }),
      });
      if (!response.ok) {
        const errorData = await response.text();
        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to sign off crew member');
        } catch {
          throw new Error(`Sign-off failed (${response.status}): ${errorData}`);
        }
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSignOffDialogOpen(false);
      setSelectedCrewForSignOff(null);
      setSignOffReason('');
      toast({
        title: 'Success',
        description: 'Crew member signed off successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign off crew member',
        variant: 'destructive',
      });
    },
  });

  // Handle sign off with reason dialog
  const handleSignOffClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForSignOff(member);
    setSignOffReason('');
    setSignOffDialogOpen(true);
  };

  const handleSignOffConfirm = () => {
    if (!selectedCrewForSignOff) return;
    if (!signOffReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for this status change',
        variant: 'destructive',
      });
      return;
    }
    signOffCrewMutation.mutate({ crewId: selectedCrewForSignOff.id, reason: signOffReason.trim() });
  };

  // Sign on crew member mutation
  const signOnCrewMutation = useMutation({
    mutationFn: async ({ crewId, reason }: { crewId: string; reason: string }) => {
      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'onBoard',
          statusChangeReason: reason,
        }),
      });
      if (!response.ok) {
        const errorData = await response.text();
        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to sign on crew member');
        } catch {
          throw new Error(`Sign-on failed (${response.status}): ${errorData}`);
        }
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSignOnDialogOpen(false);
      setSelectedCrewForSignOn(null);
      setSignOnReason('');
      toast({
        title: 'Success',
        description: 'Crew member signed on successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign on crew member',
        variant: 'destructive',
      });
    },
  });

  // Handle sign on with reason dialog
  const handleSignOnClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForSignOn(member);
    setSignOnReason('');
    setSignOnDialogOpen(true);
  };

  const handleSignOnConfirm = () => {
    if (!selectedCrewForSignOn) return;
    if (!signOnReason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for this status change',
        variant: 'destructive',
      });
      return;
    }
    signOnCrewMutation.mutate({ crewId: selectedCrewForSignOn.id, reason: signOnReason.trim() });
  };

  // Delete crew member mutation
  const deleteCrewMutation = useMutation({
    mutationFn: async (crewId: string) => {
      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.text();
        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to delete crew member');
        } catch {
          throw new Error(`Delete failed (${response.status}): ${errorData}`);
        }
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setDeleteCrewDialogOpen(false);
      setSelectedCrewForDeletion(null);
      toast({
        title: 'Success',
        description: 'Crew member deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete crew member',
        variant: 'destructive',
      });
    },
  });

  // Handle delete crew member
  const handleDeleteClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForDeletion(member);
    setDeleteCrewDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedCrewForDeletion) return;
    deleteCrewMutation.mutate(selectedCrewForDeletion.id);
  };

  // Edit crew member mutation
  const editCrewMutation = useMutation({
    mutationFn: async (data: AddCrewFormData & { id: string; statusChangeReason?: string }) => {
      const crewData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        nationality: data.nationality,
        dateOfBirth: data.dateOfBirth,
        rank: data.rank,
        phoneNumber: data.phoneNumber || null,
        status: data.status,
        emergencyContact: data.emergencyContactName ? {
          name: data.emergencyContactName,
          relationship: data.emergencyContactRelationship || '',
          phone: data.emergencyContactPhone || '',
          email: data.emergencyContactEmail || '',
          postalAddress: data.emergencyContactPostalAddress || '',
        } : null,
        cocNotApplicable: data.cocNotApplicable || false,
      };

      if (data.statusChangeReason) {
        crewData.statusChangeReason = data.statusChangeReason;
      }

      const response = await fetch(`/api/crew/${data.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(crewData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update crew member');
      }
      const updatedCrew = await response.json();

      // Get existing documents to update or create new ones
      const existingDocs = selectedCrewForEdit?.documents || [];

      // Helper to update or create document
      const saveDocument = async (type: string, docData: { documentNumber: string; issuingAuthority: string; issueDate: string; expiryDate: string }) => {
        const existing = existingDocs.find(d => d.type === type);
        try {
          if (existing) {
            console.log('Updating document:', type, existing.id);
            const resp = await fetch(`/api/documents/${existing.id}`, {
              method: 'PUT',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(docData),
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({}));
              console.error('Failed to update document:', type, errData);
            }
          } else if (docData.documentNumber || docData.expiryDate) {
            console.log('Creating new document:', type, docData);
            const resp = await fetch('/api/documents', {
              method: 'POST',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ crewMemberId: data.id, type, ...docData }),
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({}));
              console.error('Failed to create document:', type, errData);
            } else {
              console.log('Document created successfully:', type);
            }
          }
        } catch (err) {
          console.error('Error saving document:', type, err);
        }
      };

      // Save passport document
      if (data.passportNumber || data.passportExpiryDate || data.passportTbd || existingDocs.find(d => d.type === 'passport')) {
        await saveDocument('passport', {
          documentNumber: data.passportNumber || 'N/A',
          issuingAuthority: data.passportPlaceOfIssue || 'Unknown',
          issueDate: data.passportIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.passportTbd ? null : (data.passportExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      // Save CDC document
      if (data.cdcNumber || data.cdcExpiryDate || data.cdcTbd || existingDocs.find(d => d.type === 'cdc')) {
        await saveDocument('cdc', {
          documentNumber: data.cdcNumber || 'N/A',
          issuingAuthority: data.cdcPlaceOfIssue || 'Unknown',
          issueDate: data.cdcIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.cdcTbd ? null : (data.cdcExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      // Save COC document
      const cocDoc = existingDocs.find(d => d.type === 'coc');
      if (data.cocNotApplicable) {
        // If N/A but document exists, delete it
        if (cocDoc) {
          console.log('Deleting COC document because it is now N/A');
          await fetch(`/api/documents/${cocDoc.id}`, { method: 'DELETE', headers: getAuthHeaders() });
        }
      } else if (data.cocGradeNo || data.cocExpiryDate || data.cocTbd || cocDoc) {
        await saveDocument('coc', {
          documentNumber: data.cocGradeNo || 'N/A',
          issuingAuthority: data.cocPlaceOfIssue || 'Unknown',
          issueDate: data.cocIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.cocTbd ? null : (data.cocExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      // Save Medical document
      if (data.medicalApprovalNo || data.medicalExpiryDate || data.medicalTbd || existingDocs.find(d => d.type === 'medical')) {
        await saveDocument('medical', {
          documentNumber: data.medicalApprovalNo || 'N/A',
          issuingAuthority: data.medicalIssuingAuthority || 'Unknown',
          issueDate: data.medicalIssueDate || new Date().toISOString().split('T')[0],
          expiryDate: data.medicalTbd ? null : (data.medicalExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        });
      }

      return updatedCrew;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Success',
        description: 'Crew member updated successfully',
      });
      setShowEditCrewDialog(false);
      setSelectedCrewForEdit(null);
      setStatusChangeReason('');
      setOriginalStatus('');
      editCrewForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update crew member',
        variant: 'destructive',
      });
    },
  });



  if (!vessel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[80vh] max-h-[80vh] flex flex-col p-0">
        {/* Clean Header */}
        <div className="flex-shrink-0 p-6 border-b bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5" />
              View Crew - {vessel.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              Manage crew members assigned to this vessel, view their contracts, and assign new crew members.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Search and Action Buttons */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search crew members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="crew-search-input"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2"
                onClick={() => {
                  console.log('Add New Crew button clicked');
                  setShowAddCrewDialog(true);
                }}
                data-testid="add-new-crew-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Crew
              </Button>
            </div>
          </div>

          {/* Current Crew Section */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Current Crew ({crewMembers.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading crew...</div>
            ) : (
              <div className="rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b">
                      <TableHead className="text-gray-700 font-medium">Crew Member</TableHead>
                      <TableHead className="text-gray-700 font-medium">Rank</TableHead>
                      <TableHead className="text-gray-700 font-medium">Contract Status</TableHead>
                      <TableHead className="text-gray-700 font-medium">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCrew.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? 'No crew members match your search' : 'No crew assigned to this vessel'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCrew.map((member) => (
                        <TableRow key={member.id} className="hover:bg-gray-50 border-b border-gray-100" data-testid={`crew-row-${member.id}`}>
                          <TableCell className="py-4">
                            <div className="flex items-center space-x-3">
                              <Avatar className="w-10 h-10 bg-gray-200">
                                <AvatarFallback className="text-gray-600 font-medium text-sm">
                                  {getInitials(member.firstName, member.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">
                                  {member.firstName.toUpperCase()} {member.lastName.toUpperCase()}
                                </p>
                                <p className="text-xs text-gray-500">{member.nationality}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-700 text-sm">{member.rank}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-1">
                              Active Contract
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                                onClick={() => {
                                  console.log('Viewing crew member:', member.firstName, member.lastName);
                                  setSelectedCrewForView(member);
                                }}
                                data-testid={`view-crew-${member.id}`}
                              >
                                <Eye className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                                onClick={() => {
                                  console.log('Editing crew member:', member.firstName, member.lastName);
                                  setSelectedCrewForEdit(member);

                                  // Find documents
                                  const passport = member.documents?.find(d => d.type === 'passport');
                                  const cdc = member.documents?.find(d => d.type === 'cdc');
                                  const coc = member.documents?.find(d => d.type === 'coc');
                                  const medical = member.documents?.find(d => d.type === 'medical');

                                  // Pre-populate the edit form with current crew data
                                  editCrewForm.reset({
                                    firstName: member.firstName,
                                    lastName: member.lastName,
                                    nationality: member.nationality,
                                    dateOfBirth: typeof member.dateOfBirth === 'string' ? member.dateOfBirth : new Date(member.dateOfBirth).toISOString().split('T')[0],
                                    rank: member.rank,
                                    phoneNumber: member.phoneNumber || '',
                                    status: member.status as 'onBoard' | 'onShore',
                                    emergencyContactName: (member.emergencyContact as any)?.name || '',
                                    emergencyContactRelationship: (member.emergencyContact as any)?.relationship || '',
                                    emergencyContactPhone: (member.emergencyContact as any)?.phone || '',
                                    emergencyContactEmail: (member.emergencyContact as any)?.email || '',
                                    emergencyContactPostalAddress: (member.emergencyContact as any)?.postalAddress || '',

                                    // Documents
                                    passportNumber: passport?.documentNumber || '',
                                    passportPlaceOfIssue: passport?.issuingAuthority || '',
                                    passportIssueDate: passport?.issueDate ? new Date(passport.issueDate).toISOString().split('T')[0] : '',
                                    passportExpiryDate: passport?.expiryDate ? new Date(passport.expiryDate).toISOString().split('T')[0] : '',
                                    passportTbd: !!passport && !passport.expiryDate,

                                    cdcNumber: cdc?.documentNumber || '',
                                    cdcPlaceOfIssue: cdc?.issuingAuthority || '',
                                    cdcIssueDate: cdc?.issueDate ? new Date(cdc.issueDate).toISOString().split('T')[0] : '',
                                    cdcExpiryDate: cdc?.expiryDate ? new Date(cdc.expiryDate).toISOString().split('T')[0] : '',
                                    cdcTbd: !!cdc && !cdc.expiryDate,

                                    cocGradeNo: coc?.documentNumber || '',
                                    cocPlaceOfIssue: coc?.issuingAuthority || '',
                                    cocIssueDate: coc?.issueDate ? new Date(coc.issueDate).toISOString().split('T')[0] : '',
                                    cocExpiryDate: coc?.expiryDate ? new Date(coc.expiryDate).toISOString().split('T')[0] : '',
                                    cocNotApplicable: member.cocNotApplicable || false,
                                    cocTbd: !!coc && !coc.expiryDate,

                                    medicalApprovalNo: medical?.documentNumber || '',
                                    medicalIssuingAuthority: medical?.issuingAuthority || '',
                                    medicalIssueDate: medical?.issueDate ? new Date(medical.issueDate).toISOString().split('T')[0] : '',
                                    medicalExpiryDate: medical?.expiryDate ? new Date(medical.expiryDate).toISOString().split('T')[0] : '',
                                    medicalTbd: !!medical && !medical.expiryDate,
                                  });
                                  setOriginalStatus(member.status);
                                  setStatusChangeReason('');
                                  setShowEditCrewDialog(true);
                                }}
                                data-testid={`edit-crew-${member.id}`}
                              >
                                <Edit className="h-4 w-4 text-gray-500" />
                              </Button>
                              {member.status === 'onShore' ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-green-100"
                                    onClick={() => handleSignOnClick(member)}
                                    disabled={signOnCrewMutation.isPending}
                                    data-testid={`signon-crew-${member.id}`}
                                    title="Sign On"
                                  >
                                    <LogIn className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-red-100"
                                    onClick={() => handleDeleteClick(member)}
                                    disabled={deleteCrewMutation.isPending}
                                    data-testid={`delete-crew-${member.id}`}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-orange-100"
                                  onClick={() => handleSignOffClick(member)}
                                  disabled={signOffCrewMutation.isPending}
                                  data-testid={`signoff-crew-${member.id}`}
                                  title="Sign Off"
                                >
                                  <LogOut className="h-4 w-4 text-orange-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>


        </div>

        {/* Clean Footer */}
        <div className="flex-shrink-0 border-t p-6 bg-white dark:bg-gray-900">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="close-crew-management"
              className="px-6"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Crew Details Dialog */}
      {selectedCrewForView && (
        <Dialog open={!!selectedCrewForView} onOpenChange={() => setSelectedCrewForView(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Crew Member Details - {selectedCrewForView.firstName} {selectedCrewForView.lastName}
              </DialogTitle>
              <DialogDescription>
                Complete profile information including personal details, contract status, and documents.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* 1. Seafarer Details */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center mb-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                  Seafarer Details
                </h4>
                <div className="text-sm space-y-2">
                  <p><span className="font-medium">Full Name:</span> {selectedCrewForView.firstName} {selectedCrewForView.lastName}</p>
                  <p><span className="font-medium">Nationality:</span> {selectedCrewForView.nationality}</p>
                  <p><span className="font-medium">Rank:</span> {selectedCrewForView.rank}</p>
                  <p><span className="font-medium">Date of Birth:</span> {selectedCrewForView.dateOfBirth ? formatDate(selectedCrewForView.dateOfBirth) : 'Not provided'}</p>
                  <p><span className="font-medium">Phone:</span> {selectedCrewForView.phoneNumber || 'Not provided'}</p>
                  <p><span className="font-medium">Status:</span> <Badge className={selectedCrewForView.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}>{selectedCrewForView.status}</Badge></p>
                </div>
              </div>

              {/* 2. CDC No */}
              {(() => {
                const cdc = selectedCrewForView.documents?.find(d => d.type === 'cdc');
                return (
                  <div className="p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                    <h4 className="font-medium text-teal-900 dark:text-teal-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-teal-600 rounded-full mr-3"></div>
                      CDC No
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">CDC Number:</span> {cdc?.documentNumber || 'Not provided'}</p>
                      <p><span className="font-medium">Place of Issue:</span> {cdc?.issuingAuthority || 'Not provided'}</p>
                      <p><span className="font-medium">Issue Date:</span> {cdc?.issueDate ? formatDate(cdc.issueDate) : 'Not provided'}</p>
                      <p><span className="font-medium">Expiry Date:</span> {cdc?.expiryDate ? formatDate(cdc.expiryDate) : 'TBD'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Passport Details */}
              {(() => {
                const passport = selectedCrewForView.documents?.find(d => d.type === 'passport');
                return (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <h4 className="font-medium text-indigo-900 dark:text-indigo-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
                      Passport Details
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Passport Number:</span> {passport?.documentNumber || 'Not provided'}</p>
                      <p><span className="font-medium">Place of Issue:</span> {passport?.issuingAuthority || 'Not provided'}</p>
                      <p><span className="font-medium">Issue Date:</span> {passport?.issueDate ? formatDate(passport.issueDate) : 'Not provided'}</p>
                      <p><span className="font-medium">Expiry Date:</span> {passport?.expiryDate ? formatDate(passport.expiryDate) : 'TBD'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* 4. Next of Kin (NOK) */}
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <h4 className="font-medium text-orange-900 dark:text-orange-100 flex items-center mb-3">
                  <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
                  Next of Kin (NOK)
                </h4>
                <div className="text-sm space-y-2">
                  <p><span className="font-medium">Name:</span> {(selectedCrewForView.emergencyContact as any)?.name || 'Not provided'}</p>
                  <p><span className="font-medium">Relationship:</span> {(selectedCrewForView.emergencyContact as any)?.relationship || 'Not provided'}</p>
                  <p><span className="font-medium">Phone:</span> {(selectedCrewForView.emergencyContact as any)?.phone || 'Not provided'}</p>
                  <p>
                    <span className="font-medium">Email:</span>{' '}
                    {(selectedCrewForView.emergencyContact as any)?.email ? (
                      <a
                        href={`mailto:${(selectedCrewForView.emergencyContact as any).email}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                      >
                        {(selectedCrewForView.emergencyContact as any).email}
                      </a>
                    ) : (
                      'Not provided'
                    )}
                  </p>
                  <p><span className="font-medium">Postal Address:</span> {(selectedCrewForView.emergencyContact as any)?.postalAddress || 'Not provided'}</p>
                </div>
              </div>

              {/* 5. Details of Competency Certificates */}
              {(() => {
                const coc = selectedCrewForView.documents?.find(d => d.type === 'coc');
                return (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <h4 className="font-medium text-amber-900 dark:text-amber-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-amber-600 rounded-full mr-3"></div>
                      Details of Competency Certificates
                      {selectedCrewForView.cocNotApplicable && (
                        <Badge className="ml-3 bg-amber-100 text-amber-800 border-amber-200">NILL / Not Applicable</Badge>
                      )}
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">COC Grade/Number:</span> {coc?.documentNumber || 'Not provided'}</p>
                      <p><span className="font-medium">Place of Issue:</span> {coc?.issuingAuthority || 'Not provided'}</p>
                      <p><span className="font-medium">Issue Date:</span> {coc?.issueDate ? formatDate(coc.issueDate) : 'Not provided'}</p>
                      <p><span className="font-medium">Expiry Date:</span> {coc?.expiryDate ? formatDate(coc.expiryDate) : 'TBD'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* 6. Details of Medical Certificate */}
              {(() => {
                const medical = selectedCrewForView.documents?.find(d => d.type === 'medical');
                return (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                    <h4 className="font-medium text-rose-900 dark:text-rose-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-rose-600 rounded-full mr-3"></div>
                      Details of Medical Certificate
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Issuing Authority:</span> {medical?.issuingAuthority || 'Not provided'}</p>
                      <p><span className="font-medium">Approval Number:</span> {medical?.documentNumber || 'Not provided'}</p>
                      <p><span className="font-medium">Issue Date:</span> {medical?.issueDate ? formatDate(medical.issueDate) : 'Not provided'}</p>
                      <p><span className="font-medium">Expiry Date:</span> {medical?.expiryDate ? formatDate(medical.expiryDate) : 'TBD'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* 7. Articles of Agreement (AOA) */}
              {(() => {
                const aoaDoc = selectedCrewForView.documents?.find(d => d.type === 'aoa');
                const contract = selectedCrewForView.activeContract;
                const useContractAsAoa = !aoaDoc && contract && (contract.filePath || contract.endDate);

                const displayAoa = aoaDoc || (useContractAsAoa ? {
                  id: contract.id,
                  documentNumber: contract.contractNumber || 'Contract File',
                  issuingAuthority: 'System',
                  issueDate: contract.startDate,
                  expiryDate: contract.endDate,
                  filePath: contract.filePath,
                  isContract: true
                } : null);

                return displayAoa ? (
                  <div className="p-4 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                    <h4 className="font-medium text-cyan-900 dark:text-cyan-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-cyan-600 rounded-full mr-3"></div>
                      Articles of Agreement (AOA)
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Document Number:</span> {displayAoa.documentNumber}</p>
                      <p><span className="font-medium">Issuing Authority:</span> {displayAoa.issuingAuthority}</p>
                      <p><span className="font-medium">Issue Date:</span> {displayAoa.issueDate ? formatDate(displayAoa.issueDate) : 'N/A'}</p>
                      <p><span className="font-medium">Expiry Date:</span> {displayAoa.expiryDate ? formatDate(displayAoa.expiryDate) : 'N/A'}</p>
                      {displayAoa.filePath && (
                        <div className="mt-3 pt-3 border-t border-cyan-200 dark:border-cyan-700">
                          <p className="font-medium mb-2">AOA Document:</p>
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const endpoint = (displayAoa as any).isContract ? `/api/contracts/${displayAoa.id}/view` : `/api/documents/${displayAoa.id}/view`;
                                const response = await fetch(endpoint, {
                                  headers: getAuthHeaders(),
                                });
                                if (!response.ok) {
                                  throw new Error('Failed to fetch document');
                                }
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                window.open(url, '_blank');
                                setTimeout(() => window.URL.revokeObjectURL(url), 100);
                              } catch (error) {
                                toast({
                                  title: 'Error',
                                  description: 'Failed to open AOA document',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
                          >
                            <FileText className="h-4 w-4" />
                            View AOA Document
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* 8. Details of Ship */}
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center mb-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                  Details of Ship
                </h4>
                <div className="text-sm space-y-2">
                  <p><span className="font-medium">Vessel Name:</span> {selectedCrewForView.currentVessel?.name || 'Not assigned'}</p>
                  <p><span className="font-medium">Vessel Type:</span> {selectedCrewForView.currentVessel?.type || 'Not provided'}</p>
                  <p><span className="font-medium">IMO Number:</span> {selectedCrewForView.currentVessel?.imoNumber || 'Not provided'}</p>
                  <p><span className="font-medium">Flag:</span> {selectedCrewForView.currentVessel?.flag || 'Not provided'}</p>
                </div>
              </div>

              {/* 8. Contract Information */}
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 flex items-center mb-3">
                  <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                  Contract Information
                </h4>
                <div className="text-sm space-y-2">
                  <p><span className="font-medium">Start Date:</span> {selectedCrewForView.activeContract?.startDate ? formatDate(selectedCrewForView.activeContract.startDate) : 'Not provided'}</p>
                  <p><span className="font-medium">End Date:</span> {selectedCrewForView.activeContract?.endDate ? formatDate(selectedCrewForView.activeContract.endDate) : 'Not provided'}</p>
                  <p><span className="font-medium">Status:</span> {selectedCrewForView.activeContract ? <Badge className={getStatusColor(selectedCrewForView.activeContract.status)}>{selectedCrewForView.activeContract.status}</Badge> : 'No active contract'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setSelectedCrewForView(null)}
                data-testid="close-crew-details"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add New Crew Dialog */}
      {showAddCrewDialog && (
        <Dialog open={showAddCrewDialog} onOpenChange={setShowAddCrewDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Crew Member
              </DialogTitle>
              <DialogDescription>
                Create a new crew member profile with personal and emergency contact information. They will be automatically assigned to {vessel?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(95vh-120px)]">
              {/* OCR Document Scanner */}
              <div className="mb-4">
                <OCRDocumentScanner
                  onDataExtracted={handleOCRDataExtracted}
                  className="w-full"
                  mode="seafarer"
                />
              </div>

              <Form {...addCrewForm}>
                <form onSubmit={addCrewForm.handleSubmit((data) => addCrewMutation.mutate(data))} className="space-y-4">
                  {/* Personal Information */}
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter first name" {...field} data-testid="input-firstName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter last name" {...field} data-testid="input-lastName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="nationality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter nationality" {...field} data-testid="input-nationality" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-dateOfBirth" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={addCrewForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter phone number" {...field} data-testid="input-phoneNumber" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Professional Information */}
                  <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center">
                      <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                      Professional Information
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="rank"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rank</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-rank">
                                  <SelectValue placeholder="Select rank" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Captain">Captain</SelectItem>
                                <SelectItem value="Master (NCV)">Master (NCV)</SelectItem>
                                <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                                <SelectItem value="Chief Engineer (NCV)">Chief Engineer (NCV)</SelectItem>
                                <SelectItem value="2nd Engineer">2nd Engineer</SelectItem>
                                <SelectItem value="3rd Engineer">3rd Engineer</SelectItem>
                                <SelectItem value="4th Engineer">4th Engineer</SelectItem>
                                <SelectItem value="Chief Officer">Chief Officer</SelectItem>
                                <SelectItem value="Chief Officer (NCV)">Chief Officer (NCV)</SelectItem>
                                <SelectItem value="Second Officer">Second Officer</SelectItem>
                                <SelectItem value="Third Officer">Third Officer</SelectItem>
                                <SelectItem value="IV Master">IV Master</SelectItem>
                                <SelectItem value="Second Master (IV)">Second Master (IV)</SelectItem>
                                <SelectItem value="Bosun">Bosun</SelectItem>
                                <SelectItem value="AB Seaman">AB Seaman</SelectItem>
                                <SelectItem value="Deck Watchkeeping Rating (AB)">Deck Watchkeeping Rating (AB)</SelectItem>
                                <SelectItem value="Engine Rating">Engine Rating</SelectItem>
                                <SelectItem value="Cook">Cook</SelectItem>
                                <SelectItem value="2nd Cook">2nd Cook</SelectItem>
                                <SelectItem value="Saloon Rating">Saloon Rating</SelectItem>
                                <SelectItem value="Oiler">Oiler</SelectItem>
                                <SelectItem value="Wiper">Wiper</SelectItem>
                                <SelectItem value="Fitter">Fitter</SelectItem>
                                <SelectItem value="Handler">Handler</SelectItem>
                                <SelectItem value="Tube Operator">Tube Operator</SelectItem>
                                <SelectItem value="Lathe Operator">Lathe Operator</SelectItem>
                                <SelectItem value="Radio Officer">Radio Officer</SelectItem>
                                <SelectItem value="ETO">ETO</SelectItem>
                                <SelectItem value="ASST ETO">ASST ETO</SelectItem>
                                <SelectItem value="GMDSS OPERATOR">GMDSS OPERATOR</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={addCrewForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value || 'onBoard'}
                                className="flex flex-col space-y-2"
                                data-testid="status-radio-group-crew-mgmt"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="onBoard" id="onBoard-crew-mgmt" />
                                  <Label htmlFor="onBoard-crew-mgmt" className="cursor-pointer">On Board</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="onShore" id="onShore-crew-mgmt" />
                                  <Label htmlFor="onShore-crew-mgmt" className="cursor-pointer">On Shore</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center">
                      <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
                      Emergency Contact (Optional)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter contact name" {...field} data-testid="input-emergencyContactName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="emergencyContactRelationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="input-emergencyContactRelationship">
                                  <SelectValue placeholder="Select relationship" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Spouse">Spouse</SelectItem>
                                <SelectItem value="Wife">Wife</SelectItem>
                                <SelectItem value="Parent">Parent</SelectItem>
                                <SelectItem value="Child">Child</SelectItem>
                                <SelectItem value="Sibling">Sibling</SelectItem>
                                <SelectItem value="Friend">Friend</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter contact phone" {...field} data-testid="input-emergencyContactPhone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="emergencyContactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Enter contact email" {...field} data-testid="input-emergencyContactEmail" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={addCrewForm.control}
                      name="emergencyContactPostalAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter postal address" {...field} data-testid="input-emergencyContactPostalAddress" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Passport Details */}
                  <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 flex items-center">
                      <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                      Passport Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="passportNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter passport number" {...field} data-testid="input-passportNumber" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="passportPlaceOfIssue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter place of issue" {...field} data-testid="input-passportPlaceOfIssue" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="passportIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-passportIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="passportExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={addCrewForm.watch('passportTbd')}
                                data-testid="input-passportExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="passportTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    addCrewForm.setValue('passportExpiryDate', '');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal cursor-pointer text-muted-foreground">
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* CDC Details */}
                  <div className="space-y-3 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-100 flex items-center">
                      <div className="w-2 h-2 bg-teal-600 rounded-full mr-3"></div>
                      CDC Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="cdcNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CDC Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter CDC number" {...field} data-testid="input-cdcNumber" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cdcPlaceOfIssue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter place of issue" {...field} data-testid="input-cdcPlaceOfIssue" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cdcIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-cdcIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cdcExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={addCrewForm.watch('cdcTbd')}
                                data-testid="input-cdcExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cdcTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    addCrewForm.setValue('cdcExpiryDate', '');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal cursor-pointer text-muted-foreground">
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* COC Details */}
                  <div className="space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 flex items-center">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
                      COC Details
                      <FormField
                        control={addCrewForm.control}
                        name="cocNotApplicable"
                        render={({ field }) => (
                          <div className="ml-auto flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="add-cocNotApplicable"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <Label htmlFor="add-cocNotApplicable" className="text-sm font-medium cursor-pointer">NILL / Not Applicable</Label>
                          </div>
                        )}
                      />
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="cocGradeNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={addCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Grade / Certificate Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter COC grade/number" {...field} disabled={addCrewForm.watch('cocNotApplicable')} data-testid="input-cocGradeNo" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cocPlaceOfIssue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={addCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Place of Issue</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter place of issue" {...field} disabled={addCrewForm.watch('cocNotApplicable')} data-testid="input-cocPlaceOfIssue" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cocIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={addCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} disabled={addCrewForm.watch('cocNotApplicable')} data-testid="input-cocIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cocExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={addCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={addCrewForm.watch('cocNotApplicable') || addCrewForm.watch('cocTbd')}
                                data-testid="input-cocExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="cocTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    addCrewForm.setValue('cocExpiryDate', '');
                                  }
                                }}
                                disabled={addCrewForm.watch('cocNotApplicable')}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className={`font-normal cursor-pointer ${addCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Medical Certificate Details */}
                  <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-100 flex items-center">
                      <div className="w-2 h-2 bg-rose-600 rounded-full mr-3"></div>
                      Medical Certificate Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="medicalIssuingAuthority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuing Authority</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter issuing authority" {...field} data-testid="input-medicalIssuingAuthority" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="medicalApprovalNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approval Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter approval number" {...field} data-testid="input-medicalApprovalNo" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="medicalIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-medicalIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="medicalExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={addCrewForm.watch('medicalTbd')}
                                data-testid="input-medicalExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addCrewForm.control}
                        name="medicalTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    addCrewForm.setValue('medicalExpiryDate', '');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal cursor-pointer text-muted-foreground">
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addCrewForm.control}
                        name="contractStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contract Start Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-contractStartDate"
                                onChange={(e) => {
                                  field.onChange(e);
                                  // Calculate end date when start date changes
                                  const startDate = e.target.value;
                                  const duration = addCrewForm.getValues('contractDurationDays');
                                  if (startDate && duration) {
                                    const start = new Date(startDate);
                                    const end = new Date(start);
                                    end.setDate(start.getDate() + duration);
                                    addCrewForm.setValue('contractEndDate', end.toISOString().split('T')[0]);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={addCrewForm.control}
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
                                data-testid="input-contractDurationDays"
                                onChange={(e) => {
                                  const duration = parseInt(e.target.value) || 0;
                                  field.onChange(duration);
                                  // Calculate end date when duration changes
                                  const startDate = addCrewForm.getValues('contractStartDate');
                                  if (startDate && duration > 0) {
                                    const start = new Date(startDate);
                                    const end = new Date(start);
                                    end.setDate(start.getDate() + duration);
                                    addCrewForm.setValue('contractEndDate', end.toISOString().split('T')[0]);
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
                      control={addCrewForm.control}
                      name="contractEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract End Date (Auto-calculated)</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              data-testid="input-contractEndDate"
                              readOnly
                              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddCrewDialog(false)}
                      data-testid="cancel-add-crew"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-maritime-navy hover:bg-blue-800"
                      disabled={addCrewMutation.isPending}
                      data-testid="submit-add-crew"
                    >
                      {addCrewMutation.isPending ? 'Adding...' : 'Add Crew Member'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Crew Dialog */}
      {selectedCrewForEdit && (
        <Dialog open={showEditCrewDialog} onOpenChange={setShowEditCrewDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Crew Member - {selectedCrewForEdit.firstName} {selectedCrewForEdit.lastName}
              </DialogTitle>
              <DialogDescription>
                Update crew member information and emergency contact details.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 overflow-y-auto max-h-[calc(95vh-120px)]">
              <Form {...editCrewForm}>
                <form onSubmit={editCrewForm.handleSubmit((data) => {
                  const isStatusChanged = originalStatus && data.status !== originalStatus;
                  if (isStatusChanged && !statusChangeReason.trim()) {
                    toast({
                      title: 'Reason Required',
                      description: 'Please provide a reason for changing the crew status.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  editCrewMutation.mutate({
                    ...data,
                    id: selectedCrewForEdit.id,
                    statusChangeReason: isStatusChanged ? statusChangeReason : undefined
                  });
                })} className="space-y-4">
                  {/* Personal Information */}
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter first name" {...field} data-testid="edit-input-firstName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter last name" {...field} data-testid="edit-input-lastName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="nationality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter nationality" {...field} data-testid="edit-input-nationality" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="edit-input-dateOfBirth" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={editCrewForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter phone number" {...field} data-testid="edit-input-phoneNumber" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Professional Information */}
                  <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 flex items-center">
                      <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                      Professional Information
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="rank"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rank</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="edit-select-rank">
                                  <SelectValue placeholder="Select rank" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Captain">Captain</SelectItem>
                                <SelectItem value="Master (NCV)">Master (NCV)</SelectItem>
                                <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                                <SelectItem value="Chief Engineer (NCV)">Chief Engineer (NCV)</SelectItem>
                                <SelectItem value="2nd Engineer">2nd Engineer</SelectItem>
                                <SelectItem value="3rd Engineer">3rd Engineer</SelectItem>
                                <SelectItem value="4th Engineer">4th Engineer</SelectItem>
                                <SelectItem value="Chief Officer">Chief Officer</SelectItem>
                                <SelectItem value="Chief Officer (NCV)">Chief Officer (NCV)</SelectItem>
                                <SelectItem value="Second Officer">Second Officer</SelectItem>
                                <SelectItem value="Third Officer">Third Officer</SelectItem>
                                <SelectItem value="IV Master">IV Master</SelectItem>
                                <SelectItem value="Second Master (IV)">Second Master (IV)</SelectItem>
                                <SelectItem value="Bosun">Bosun</SelectItem>
                                <SelectItem value="AB Seaman">AB Seaman</SelectItem>
                                <SelectItem value="Deck Watchkeeping Rating (AB)">Deck Watchkeeping Rating (AB)</SelectItem>
                                <SelectItem value="Engine Rating">Engine Rating</SelectItem>
                                <SelectItem value="Cook">Cook</SelectItem>
                                <SelectItem value="2nd Cook">2nd Cook</SelectItem>
                                <SelectItem value="Saloon Rating">Saloon Rating</SelectItem>
                                <SelectItem value="Oiler">Oiler</SelectItem>
                                <SelectItem value="Wiper">Wiper</SelectItem>
                                <SelectItem value="Fitter">Fitter</SelectItem>
                                <SelectItem value="Handler">Handler</SelectItem>
                                <SelectItem value="Tube Operator">Tube Operator</SelectItem>
                                <SelectItem value="Lathe Operator">Lathe Operator</SelectItem>
                                <SelectItem value="Radio Officer">Radio Officer</SelectItem>
                                <SelectItem value="ETO">ETO</SelectItem>
                                <SelectItem value="ASST ETO">ASST ETO</SelectItem>
                                <SelectItem value="GMDSS OPERATOR">GMDSS OPERATOR</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editCrewForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-row space-x-4"
                                data-testid="edit-radio-status"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="onBoard" id="edit-onBoard" />
                                  <Label htmlFor="edit-onBoard">On Board</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="onShore" id="edit-onShore" />
                                  <Label htmlFor="edit-onShore">On Shore</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Status Change Reason - shows when status is being changed */}
                    {originalStatus && editCrewForm.watch('status') !== originalStatus && (
                      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <Label className="text-amber-900 dark:text-amber-100 font-medium">
                          Reason for Status Change <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                          Changing status from {originalStatus === 'onBoard' ? 'On Board' : 'On Shore'} to {editCrewForm.watch('status') === 'onBoard' ? 'On Board' : 'On Shore'}
                        </p>
                        <Textarea
                          placeholder="Please provide a reason for this status change..."
                          value={statusChangeReason}
                          onChange={(e) => setStatusChangeReason(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="edit-input-statusChangeReason"
                        />
                      </div>
                    )}
                  </div>

                  {/* Emergency Contact Information */}
                  <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 flex items-center">
                      <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
                      Emergency Contact Information
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter contact name" {...field} data-testid="edit-input-emergencyContactName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="emergencyContactRelationship"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="edit-input-emergencyContactRelationship">
                                  <SelectValue placeholder="Select relationship" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Spouse">Spouse</SelectItem>
                                <SelectItem value="Wife">Wife</SelectItem>
                                <SelectItem value="Parent">Parent</SelectItem>
                                <SelectItem value="Child">Child</SelectItem>
                                <SelectItem value="Sibling">Sibling</SelectItem>
                                <SelectItem value="Friend">Friend</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter contact phone" {...field} data-testid="edit-input-emergencyContactPhone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="emergencyContactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Enter contact email" {...field} data-testid="edit-input-emergencyContactEmail" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editCrewForm.control}
                      name="emergencyContactPostalAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter postal address" {...field} data-testid="edit-input-emergencyContactPostalAddress" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Passport Details */}
                  <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 flex items-center">
                      <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                      Passport Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="passportNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter passport number" {...field} data-testid="edit-input-passportNumber" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="passportPlaceOfIssue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter place of issue" {...field} data-testid="edit-input-passportPlaceOfIssue" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="passportIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="edit-input-passportIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="passportExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={editCrewForm.watch('passportTbd')}
                                data-testid="edit-input-passportExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="passportTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    editCrewForm.setValue('passportExpiryDate', '');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal cursor-pointer text-muted-foreground">
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* CDC Details */}
                  <div className="space-y-3 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-100 flex items-center">
                      <div className="w-2 h-2 bg-teal-600 rounded-full mr-3"></div>
                      CDC Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="cdcNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CDC Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter CDC number" {...field} data-testid="edit-input-cdcNumber" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cdcPlaceOfIssue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Place of Issue</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter place of issue" {...field} data-testid="edit-input-cdcPlaceOfIssue" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cdcIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="edit-input-cdcIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cdcExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={editCrewForm.watch('cdcTbd')}
                                data-testid="edit-input-cdcExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cdcTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    editCrewForm.setValue('cdcExpiryDate', '');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal cursor-pointer text-muted-foreground">
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* COC Details */}
                  <div className="space-y-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 flex items-center">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
                      COC Details
                      <FormField
                        control={editCrewForm.control}
                        name="cocNotApplicable"
                        render={({ field }) => (
                          <div className="ml-auto flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit-cocNotApplicable"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <Label htmlFor="edit-cocNotApplicable" className="text-sm font-medium cursor-pointer">NILL / Not Applicable</Label>
                          </div>
                        )}
                      />
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="cocGradeNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={editCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Grade / Certificate Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter COC grade/number" {...field} disabled={editCrewForm.watch('cocNotApplicable')} data-testid="edit-input-cocGradeNo" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cocPlaceOfIssue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={editCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Place of Issue</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter place of issue" {...field} disabled={editCrewForm.watch('cocNotApplicable')} data-testid="edit-input-cocPlaceOfIssue" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cocIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={editCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} disabled={editCrewForm.watch('cocNotApplicable')} data-testid="edit-input-cocIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cocExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={editCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : ''}>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={editCrewForm.watch('cocNotApplicable') || editCrewForm.watch('cocTbd')}
                                data-testid="edit-input-cocExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="cocTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    editCrewForm.setValue('cocExpiryDate', '');
                                  }
                                }}
                                disabled={editCrewForm.watch('cocNotApplicable')}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className={`font-normal cursor-pointer ${editCrewForm.watch('cocNotApplicable') ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Medical Certificate Details */}
                  <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-100 flex items-center">
                      <div className="w-2 h-2 bg-rose-600 rounded-full mr-3"></div>
                      Medical Certificate Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="medicalIssuingAuthority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuing Authority</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter issuing authority" {...field} data-testid="edit-input-medicalIssuingAuthority" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="medicalApprovalNo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Approval Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter approval number" {...field} data-testid="edit-input-medicalApprovalNo" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="medicalIssueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="edit-input-medicalIssueDate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="medicalExpiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                disabled={editCrewForm.watch('medicalTbd')}
                                data-testid="edit-input-medicalExpiryDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="medicalTbd"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 col-span-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    editCrewForm.setValue('medicalExpiryDate', '');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal cursor-pointer text-muted-foreground">
                                TBD (To Be Determined)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowEditCrewDialog(false);
                        setSelectedCrewForEdit(null);
                        setStatusChangeReason('');
                        setOriginalStatus('');
                        editCrewForm.reset();
                      }}
                      data-testid="cancel-edit-crew"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-maritime-navy hover:bg-blue-800"
                      disabled={editCrewMutation.isPending}
                      data-testid="submit-edit-crew"
                    >
                      {editCrewMutation.isPending ? 'Updating...' : 'Update Crew Member'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Contract Creation Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Contract</DialogTitle>
            <DialogDescription>
              Set contract details for {selectedCrewForContract?.firstName} {selectedCrewForContract?.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contract-start-date">Start Date</Label>
              <Input
                id="contract-start-date"
                type="date"
                value={contractStartDate}
                onChange={(e) => handleContractStartDateChange(e.target.value)}
                data-testid="input-contract-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-duration">Duration (Days)</Label>
              <Input
                id="contract-duration"
                type="number"
                value={contractDuration}
                onChange={(e) => handleContractDurationChange(e.target.value)}
                placeholder="90"
                data-testid="input-contract-duration"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-end-date">End Date (Auto-calculated)</Label>
              <Input
                id="contract-end-date"
                type="date"
                value={contractEndDate}
                readOnly
                disabled
                className="bg-muted"
                data-testid="input-contract-end-date"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setContractDialogOpen(false);
                setSelectedCrewForContract(null);
                setContractStartDate('');
                setContractDuration('90');
                setContractEndDate('');
              }}
              data-testid="cancel-contract"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedCrewForContract || !vessel) return;

                if (!contractStartDate || !contractDuration) {
                  toast({
                    title: 'Error',
                    description: 'Please fill in all contract details',
                    variant: 'destructive',
                  });
                  return;
                }

                const durationDays = parseInt(contractDuration);
                if (isNaN(durationDays) || durationDays <= 0) {
                  toast({
                    title: 'Error',
                    description: 'Please enter a valid duration',
                    variant: 'destructive',
                  });
                  return;
                }

                // First assign the crew member
                assignCrewMutation.mutate(
                  { crewId: selectedCrewForContract.id, vesselId: vessel.id },
                  {
                    onSuccess: () => {
                      // Then create the contract
                      createContractMutation.mutate({
                        crewId: selectedCrewForContract.id,
                        vesselId: vessel.id,
                        startDate: contractStartDate,
                        durationDays,
                        endDate: contractEndDate,
                      });

                      // Close dialog and reset
                      setContractDialogOpen(false);
                      setSelectedCrewForContract(null);
                      setContractStartDate('');
                      setContractDuration('90');
                      setContractEndDate('');
                    },
                  }
                );
              }}
              disabled={assignCrewMutation.isPending || createContractMutation.isPending}
              className="bg-maritime-navy hover:bg-blue-800"
              data-testid="confirm-contract"
            >
              {assignCrewMutation.isPending || createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Off Reason Dialog */}
      <Dialog open={signOffDialogOpen} onOpenChange={setSignOffDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Off Crew Member</DialogTitle>
            <DialogDescription>
              {selectedCrewForSignOff && (
                <>
                  You are signing off {selectedCrewForSignOff.firstName} {selectedCrewForSignOff.lastName} from {vessel?.name || 'their current vessel'}.
                  Please provide a reason for this status change.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signoff-reason">Reason for Status Change <span className="text-red-500">*</span></Label>
              <textarea
                id="signoff-reason"
                className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-orange-600"
                placeholder="Enter the reason for signing off this crew member (required)"
                value={signOffReason}
                onChange={(e) => setSignOffReason(e.target.value)}
                data-testid="input-signoff-reason"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setSignOffDialogOpen(false);
                setSelectedCrewForSignOff(null);
                setSignOffReason('');
              }}
              data-testid="button-cancel-signoff"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSignOffConfirm}
              disabled={signOffCrewMutation.isPending || !signOffReason.trim()}
              data-testid="button-confirm-signoff"
              className="bg-orange-600 hover:bg-orange-700"
            >
              {signOffCrewMutation.isPending ? 'Signing Off...' : 'Confirm Sign Off'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign On Reason Dialog */}
      <Dialog open={signOnDialogOpen} onOpenChange={setSignOnDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign On Crew Member</DialogTitle>
            <DialogDescription>
              {selectedCrewForSignOn && (
                <>
                  You are signing on {selectedCrewForSignOn.firstName} {selectedCrewForSignOn.lastName}.
                  Please provide a reason for this status change.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signon-reason">Reason for Status Change <span className="text-red-500">*</span></Label>
              <textarea
                id="signon-reason"
                className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="Enter the reason for signing on this crew member (required)"
                value={signOnReason}
                onChange={(e) => setSignOnReason(e.target.value)}
                data-testid="input-signon-reason"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setSignOnDialogOpen(false);
                setSelectedCrewForSignOn(null);
                setSignOnReason('');
              }}
              data-testid="button-cancel-signon"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSignOnConfirm}
              disabled={signOnCrewMutation.isPending || !signOnReason.trim()}
              data-testid="button-confirm-signon"
              className="bg-green-600 hover:bg-green-700"
            >
              {signOnCrewMutation.isPending ? 'Signing On...' : 'Confirm Sign On'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Crew Member Confirmation Dialog */}
      <AlertDialog open={deleteCrewDialogOpen} onOpenChange={setDeleteCrewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Crew Member</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCrewForDeletion && (
                <>
                  Are you sure you want to delete {selectedCrewForDeletion.firstName} {selectedCrewForDeletion.lastName}?
                  This action cannot be undone and will permanently remove all associated data including contracts and documents.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteCrewDialogOpen(false);
                setSelectedCrewForDeletion(null);
              }}
              data-testid="button-cancel-delete-crew"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteCrewMutation.isPending}
              data-testid="button-confirm-delete-crew"
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCrewMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

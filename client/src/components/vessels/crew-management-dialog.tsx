import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CrewAvatar } from '../crew/crew-avatar';
import { CrewDetailCard } from '../crew/crew-detail-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, Search, Plus, Eye, UserMinus, Edit, LogOut, LogIn, Trash2, FileText, FileSpreadsheet,
  History, Mail, Download, Phone, MapPin, Calendar, Ship, Info, AlertCircle, Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import DocumentUpload from '../documents/document-upload';
import { BulkUploadDialog } from '../crew/bulk-upload-dialog';
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
import AddCrewForm from '../crew/add-crew-form';
import EditCrewForm from '../crew/edit-crew-form';
import ViewCrewDetails from '../crew/view-crew-details';
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
import { downloadFileFromResponse, openSecureView } from '@/lib/file-utils';

// Add crew form schema
const addCrewSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().or(z.literal('')),
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
  passportNotApplicable: z.boolean().optional().default(false),
  cdcNumber: z.string().optional(),
  cdcPlaceOfIssue: z.string().optional(),
  cdcIssueDate: z.string().optional(),
  cdcExpiryDate: z.string().optional(),
  cdcNotApplicable: z.boolean().optional().default(false),
  cocGradeNo: z.string().optional(),
  cocPlaceOfIssue: z.string().optional(),
  cocIssueDate: z.string().optional(),
  cocExpiryDate: z.string().optional(),
  cocNotApplicable: z.boolean().optional().default(false),
  medicalIssuingAuthority: z.string().optional(),
  medicalApprovalNo: z.string().optional(),
  medicalIssueDate: z.string().optional(),
  medicalExpiryDate: z.string().optional(),
  medicalNotApplicable: z.boolean().optional().default(false),
  stcwNumber: z.string().optional(),
  stcwIssuingAuthority: z.string().optional(),
  stcwIssueDate: z.string().optional(),
  stcwExpiryDate: z.string().optional(),
  stcwNotApplicable: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  // Passport validation
  if (!data.passportNotApplicable) {
    if (!data.passportNumber || data.passportNumber.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passport Number is required", path: ["passportNumber"] });
    }
    if (!data.passportIssueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Issue Date is required", path: ["passportIssueDate"] });
    }
    if (!data.passportExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiry Date is required", path: ["passportExpiryDate"] });
    }
  }

  // CDC validation
  if (!data.cdcNotApplicable) {
    if (!data.cdcNumber || data.cdcNumber.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CDC Number is required", path: ["cdcNumber"] });
    }
    if (!data.cdcIssueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Issue Date is required", path: ["cdcIssueDate"] });
    }
    if (!data.cdcExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiry Date is required", path: ["cdcExpiryDate"] });
    }
  }

  // COC validation
  if (!data.cocNotApplicable) {
    if (!data.cocGradeNo || data.cocGradeNo.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "COC Grade/Number is required", path: ["cocGradeNo"] });
    }
    if (!data.cocIssueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Issue Date is required", path: ["cocIssueDate"] });
    }
    if (!data.cocExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiry Date is required", path: ["cocExpiryDate"] });
    }
  }

  // Medical validation
  if (!data.medicalNotApplicable) {
    if (!data.medicalApprovalNo || data.medicalApprovalNo.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Medical Approval Number is required", path: ["medicalApprovalNo"] });
    }
    if (!data.medicalIssueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Issue Date is required", path: ["medicalIssueDate"] });
    }
    if (!data.medicalExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiry Date is required", path: ["medicalExpiryDate"] });
    }
  }

  // STCW validation
  if (!data.stcwNotApplicable) {
    if (!data.stcwNumber || data.stcwNumber.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "STCW Number is required", path: ["stcwNumber"] });
    }
    if (!data.stcwIssueDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Issue Date is required", path: ["stcwIssueDate"] });
    }
    if (!data.stcwExpiryDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expiry Date is required", path: ["stcwExpiryDate"] });
    }
  }
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

  // Document Upload State
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedCrewForUpload, setSelectedCrewForUpload] = useState<CrewMemberWithDetails | null>(null);
  const [uploadDocumentType, setUploadDocumentType] = useState<string | null>(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedCrewForBulkUpload, setSelectedCrewForBulkUpload] = useState<CrewMemberWithDetails | null>(null);
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
  const [showVesselHistoryDialog, setShowVesselHistoryDialog] = useState(false);
  const [selectedCrewForHistory, setSelectedCrewForHistory] = useState<CrewMemberWithDetails | null>(null);
  const [loadingAoaDocId, setLoadingAoaDocId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add crew form


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
      passportNotApplicable: false,
      cdcNotApplicable: false,
      cocNotApplicable: false,
      medicalNotApplicable: false,
      stcwNotApplicable: false,
    },
  });

  // Reset edit form when selected crew member changes to populate fields
  useEffect(() => {
    if (selectedCrewForEdit) {
      const passport = selectedCrewForEdit.documents?.find(d => d.type === 'passport');
      const cdc = selectedCrewForEdit.documents?.find(d => d.type === 'cdc');
      const coc = selectedCrewForEdit.documents?.find(d => d.type === 'coc');
      const medical = selectedCrewForEdit.documents?.find(d => d.type === 'medical');
      const stcw = selectedCrewForEdit.documents?.find(d => d.type === 'stcw_course');
      const contract = selectedCrewForEdit.activeContract;

      editCrewForm.reset({
        firstName: selectedCrewForEdit.firstName,
        lastName: selectedCrewForEdit.lastName,
        nationality: selectedCrewForEdit.nationality,
        dateOfBirth: typeof selectedCrewForEdit.dateOfBirth === 'string'
          ? selectedCrewForEdit.dateOfBirth
          : new Date(selectedCrewForEdit.dateOfBirth).toISOString().split('T')[0],
        rank: selectedCrewForEdit.rank,
        phoneNumber: selectedCrewForEdit.phoneNumber || '',
        // Map 'active' or any other non-standard status to 'onBoard' to satisfy schema
        status: (selectedCrewForEdit.status === 'onShore' ? 'onShore' : 'onBoard') as 'onBoard' | 'onShore',
        emergencyContactName: (selectedCrewForEdit.emergencyContact as any)?.name || '',
        emergencyContactRelationship: (selectedCrewForEdit.emergencyContact as any)?.relationship || '',
        emergencyContactPhone: (selectedCrewForEdit.emergencyContact as any)?.phone || '',
        emergencyContactEmail: (selectedCrewForEdit.emergencyContact as any)?.email || '',
        emergencyContactPostalAddress: (selectedCrewForEdit.emergencyContact as any)?.postalAddress || '',
        
        // Contract details
        contractStartDate: contract?.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : '',
        contractDurationDays: contract?.durationDays || 0,
        contractEndDate: contract?.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : '',

        // Passport details
        passportNumber: passport?.documentNumber || '',
        passportPlaceOfIssue: passport?.issuingAuthority || '',
        passportIssueDate: passport?.issueDate ? new Date(passport.issueDate).toISOString().split('T')[0] : '',
        passportExpiryDate: passport?.expiryDate ? new Date(passport.expiryDate).toISOString().split('T')[0] : '',
        passportNotApplicable: selectedCrewForEdit.passportNotApplicable || false,

        // CDC details
        cdcNumber: cdc?.documentNumber || '',
        cdcPlaceOfIssue: cdc?.issuingAuthority || '',
        cdcIssueDate: cdc?.issueDate ? new Date(cdc.issueDate).toISOString().split('T')[0] : '',
        cdcExpiryDate: cdc?.expiryDate ? new Date(cdc.expiryDate).toISOString().split('T')[0] : '',
        cdcNotApplicable: selectedCrewForEdit.cdcNotApplicable || false,

        // COC details
        cocGradeNo: coc?.documentNumber || '',
        cocPlaceOfIssue: coc?.issuingAuthority || '',
        cocIssueDate: coc?.issueDate ? new Date(coc.issueDate).toISOString().split('T')[0] : '',
        cocExpiryDate: coc?.expiryDate ? new Date(coc.expiryDate).toISOString().split('T')[0] : '',
        cocNotApplicable: selectedCrewForEdit.cocNotApplicable || false,

        // Medical details
        medicalIssuingAuthority: medical?.issuingAuthority || '',
        medicalApprovalNo: medical?.documentNumber || '',
        medicalIssueDate: medical?.issueDate ? new Date(medical.issueDate).toISOString().split('T')[0] : '',
        medicalExpiryDate: medical?.expiryDate ? new Date(medical.expiryDate).toISOString().split('T')[0] : '',
        medicalNotApplicable: selectedCrewForEdit.medicalNotApplicable || false,

        // STCW / Course details
        stcwNumber: stcw?.documentNumber || '',
        stcwIssuingAuthority: stcw?.issuingAuthority || '',
        stcwIssueDate: stcw?.issueDate ? new Date(stcw.issueDate).toISOString().split('T')[0] : '',
        stcwExpiryDate: stcw?.expiryDate ? new Date(stcw.expiryDate).toISOString().split('T')[0] : '',
        stcwNotApplicable: selectedCrewForEdit.stcwNotApplicable || false,
      });
      setOriginalStatus(selectedCrewForEdit.status === 'active' ? 'onBoard' : selectedCrewForEdit.status);
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



  // Handle OCR data extraction to populate Add Crew form


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

  // Document deletion mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete document' }));
        throw new Error(errorData.message || 'Failed to delete document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Success',
        description: 'Document file removed successfully. Document record preserved.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
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

  const handleDeleteDocument = (docId: string, type: string) => {
    if (confirm(`Are you sure you want to delete this ${type.toUpperCase()} document? This will remove the uploaded file but keep the document record.`)) {
      deleteDocumentMutation.mutate(docId);
    }
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
        passportNotApplicable: data.passportNotApplicable || false,
        cdcNotApplicable: data.cdcNotApplicable || false,
        medicalNotApplicable: data.medicalNotApplicable || false,
        stcwNotApplicable: data.stcwNotApplicable || false,
        currentVesselId: data.currentVesselId, // Ensure vessel assignment is passed
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
      const saveDocument = async (type: string, docData: { documentNumber: string; issuingAuthority: string; issueDate: string; expiryDate: string | null }, notApplicable: boolean) => {
        const existing = existingDocs.find(d => d.type === type);
        try {
          if (notApplicable) {
            if (existing) {
              console.log('Deleting document because it is now N/A:', type);
              await fetch(`/api/documents/${existing.id}`, { method: 'DELETE', headers: getAuthHeaders() });
            }
            return;
          }

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
          } else if (docData.documentNumber) {
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
      await saveDocument('passport', {
        documentNumber: data.passportNumber || 'N/A',
        issuingAuthority: data.passportPlaceOfIssue || 'Unknown',
        issueDate: data.passportIssueDate || new Date().toISOString().split('T')[0],
        expiryDate: data.passportExpiryDate || null,
      }, data.passportNotApplicable || false);

      // Save CDC document
      await saveDocument('cdc', {
        documentNumber: data.cdcNumber || 'N/A',
        issuingAuthority: data.cdcPlaceOfIssue || 'Unknown',
        issueDate: data.cdcIssueDate || new Date().toISOString().split('T')[0],
        expiryDate: data.cdcExpiryDate || null,
      }, data.cdcNotApplicable || false);

      // Save COC document
      await saveDocument('coc', {
        documentNumber: data.cocGradeNo || 'N/A',
        issuingAuthority: data.cocPlaceOfIssue || 'Unknown',
        issueDate: data.cocIssueDate || new Date().toISOString().split('T')[0],
        expiryDate: data.cocExpiryDate || null,
      }, data.cocNotApplicable || false);

      // Save Medical document
      await saveDocument('medical', {
        documentNumber: data.medicalApprovalNo || 'N/A',
        issuingAuthority: data.medicalIssuingAuthority || 'Unknown',
        issueDate: data.medicalIssueDate || new Date().toISOString().split('T')[0],
        expiryDate: data.medicalExpiryDate || null,
      }, data.medicalNotApplicable || false);

      // Save STCW document
      await saveDocument('stcw_course', {
        documentNumber: data.stcwNumber || 'N/A',
        issuingAuthority: data.stcwIssuingAuthority || 'Unknown',
        issueDate: data.stcwIssueDate || new Date().toISOString().split('T')[0],
        expiryDate: data.stcwExpiryDate || null,
      }, data.stcwNotApplicable || false);

      // Save Contract Details
      if (data.contractStartDate && data.contractDurationDays) {
        // Use the newly updated crew's currentVesselId if available, or fall back to the form data
        // This ensures if the user just assigned a vessel, we use that one.
        const effectiveVesselId = updatedCrew.currentVesselId || data.currentVesselId || vessel?.id;

        if (!effectiveVesselId) {
          console.error("Cannot create contract: No vessel assigned to crew member");
          toast({
            title: "Contract Warning",
            description: "Contract details could not be saved because no vessel is assigned. Please assign a vessel first.",
            variant: "destructive"
          });
        } else {
          const contractData = {
            crewMemberId: data.id,
            vesselId: effectiveVesselId,
            startDate: new Date(data.contractStartDate + 'T00:00:00.000Z'),
            endDate: data.contractEndDate ? new Date(data.contractEndDate + 'T00:00:00.000Z') : null,
            durationDays: data.contractDurationDays,
            status: 'active',
            contractType: 'SEA',
          };

          const existingContract = selectedCrewForEdit?.activeContract;
          if (existingContract) {
            console.log('Updating existing contract:', existingContract.id);
            const contractResp = await fetch(`/api/contracts/${existingContract.id}`, {
              method: 'PUT',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(contractData),
            });
            if (!contractResp.ok) {
              const error = await contractResp.json().catch(() => ({}));
              console.error('Failed to update contract:', error);
              toast({ title: "Contract Error", description: "Failed to update contract details.", variant: "destructive" });
            }
          } else {
            console.log('Creating new contract during edit with vesselId:', effectiveVesselId);
            const contractResp = await fetch('/api/contracts', {
              method: 'POST',
              headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(contractData),
            });
            if (!contractResp.ok) {
              const error = await contractResp.json().catch(() => ({}));
              console.error('Failed to create contract:', error);
              toast({ title: "Contract Error", description: "Failed to create new contract. Reason: " + (error.message || "Unknown error"), variant: "destructive" });
            }
          }
        }
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



  // Additional handlers for CrewDetailCard support
  const handleDownloadCrewDocuments = async (crewId: string, crewName: string) => {
    try {
      const response = await fetch(`/api/crew/${crewId}/documents/download`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Download failed');
      await downloadFileFromResponse(response, `Documents_${crewName.replace(/\s+/g, '_')}.zip`);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Could not download documents zip.',
        variant: 'destructive',
      });
    }
  };

  const sendCrewEmailMutation = useMutation({
    mutationFn: async (member: CrewMemberWithDetails) => {
      const response = await fetch('/api/email/send-crew-details', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ crewMemberId: member.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send email' }));
        throw new Error(errorData.message || 'Failed to send email');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Email Sent',
        description: 'Crew update email has been sent successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Email Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleViewAOAClick = async (m: CrewMemberWithDetails) => {
    if (m.activeContract?.filePath) {
      try {
        // First, try to get a secure view token
        const tokenResponse = await fetch(`/api/contracts/${m.activeContract.id}/view-token`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });

        if (tokenResponse.ok) {
          const { viewUrl } = await tokenResponse.json();
          openSecureView(viewUrl);
          return;
        }

        // Fallback to traditional method if token fails
        const response = await fetch(`/api/contracts/${m.activeContract.id}/view`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch document');
        await downloadFileFromResponse(response, `AOA_${m.lastName}.pdf`);
      } catch (error) {
        console.error('Error viewing AOA:', error);
        toast({
          title: 'Error',
          description: 'Failed to open AOA document',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Not Available',
        description: 'No AOA document file found for this contract.',
      });
    }
  };


  const handleExportPDF = async () => {
    if (!vessel) return;
    try {
      const response = await fetch(`/api/vessels/${vessel.id}/export-pdf`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to generate PDF export');
      await downloadFileFromResponse(response, `${vessel.name.replace(/\s+/g, '_')}_CrewReport.pdf`);

      toast({
        title: 'Report Generated',
        description: 'The professional vessel crew PDF report has been downloaded successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);


  const handleEmailPDF = async () => {
    if (!vessel) return;

    try {
      setIsEmailing(true);
      const response = await fetch(`/api/vessels/${vessel.id}/email-pdf`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send email' }));
        throw new Error(errorData.message || 'Failed to send email');
      }
      toast({
        title: 'Email Sent',
        description: 'The professional PDF report has been emailed successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Email Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsEmailing(false);
    }
  };

  const handleEditClick = (member: CrewMemberWithDetails) => {
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
      // Emergency Contact
      emergencyContactName: (member.emergencyContact as any)?.name || '',
      emergencyContactRelationship: (member.emergencyContact as any)?.relationship || '',
      emergencyContactPhone: (member.emergencyContact as any)?.phone || '',
      emergencyContactEmail: (member.emergencyContact as any)?.email || '',
      emergencyContactPostalAddress: (member.emergencyContact as any)?.postalAddress || '',

      // Contract Details
      contractStartDate: member.activeContract?.startDate ? new Date(member.activeContract.startDate).toISOString().split('T')[0] : '',
      contractDurationDays: member.activeContract?.durationDays || 90,
      contractEndDate: member.activeContract?.endDate ? new Date(member.activeContract.endDate).toISOString().split('T')[0] : '',

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
  };

  const handleVesselHistoryClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForHistory(member);
    setShowVesselHistoryDialog(true);
  };

  const handleUploadClick = (member: CrewMemberWithDetails, type: string) => {
    setSelectedCrewForUpload(member);
    setUploadDocumentType(type);
    setShowUploadDialog(true);
  };

  const handleBulkUploadClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForBulkUpload(member);
    setIsBulkUploadModalOpen(true);
  };

  const toggleNAMutation = useMutation({
    mutationFn: async ({ crewId, type, value }: { crewId: string; type: string; value: boolean }) => {
      const updates: any = {};
      
      // Map document types to their respective "NotApplicable" fields in the database
      const typeMap: Record<string, string> = {
        'passport': 'passportNotApplicable',
        'cdc': 'cdcNotApplicable',
        'coc': 'cocNotApplicable',
        'medical': 'medicalNotApplicable',
        'stcw_course': 'stcwNotApplicable',
        'coe-extension': 'coeExtensionNotApplicable'
      };

      const fieldName = typeMap[type] || `${type}NotApplicable`;
      updates[fieldName] = value;

      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update document status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Status Updated',
        description: 'Document status has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleToggleNA = (member: CrewMemberWithDetails, type: string, value: boolean) => {
    toggleNAMutation.mutate({ crewId: member.id, type, value });
  };

  if (!vessel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 shadow-2xl transform-gpu will-change-transform">
        {/* Clean Header */}
        <div className="flex-shrink-0 p-3 pb-0 border-b bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5" />
              View Crew - {vessel.name} | Current Crew Members ({crewMembers.length})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0">
              Manage crew members assigned to this vessel, view their contracts, and assign new crew members.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          {/* Search and Action Buttons */}
          <div className="flex items-center justify-between mb-2">
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 h-8 px-3 text-xs"
                onClick={handleEmailPDF}
                disabled={isEmailing}
              >
                {isEmailing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                Email (PDF Report)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs"
                onClick={handleExportPDF}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Export (PDF Report)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs"
                onClick={() => {
                  console.log('Add New Crew button clicked');
                  setShowAddCrewDialog(true);
                }}
                data-testid="add-new-crew-button"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add New Crew
              </Button>
            </div>
          </div>

          {/* Current Crew Section */}
          <div className="mb-0">

            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                <p className="text-slate-600 dark:text-slate-400 animate-pulse text-sm font-medium tracking-tight">Retrieving real-time data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCrew.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-slate-500 dark:text-slate-400 italic font-medium bg-white/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                    {searchTerm ? 'No crew members match your search' : 'No crew assigned to this vessel'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCrew.map((member) => (
                      <CrewDetailCard
                        key={member.id}
                        member={member}
                        documents={member.documents || []}
                        onView={(m) => setSelectedCrewForView(m)}
                        onEdit={(m) => handleEditClick(m)}
                        onVesselHistory={(m) => handleVesselHistoryClick(m)}
                        onSendMail={(m) => sendCrewEmailMutation.mutate(m)}
                        onDownload={(id, name) => handleDownloadCrewDocuments(id, name)}
                        onViewAOA={handleViewAOAClick}
                        onSignOff={handleSignOffClick}
                        onSignOn={handleSignOnClick}
                        onUpload={handleUploadClick}
                        onBulkUpload={handleBulkUploadClick}
                        onDelete={handleDeleteClick}
                        onDeleteDocument={handleDeleteDocument}
                        onToggleNA={handleToggleNA}
                        isMailPending={sendCrewEmailMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>


        </div>

        {/* Clean Footer */}
        <div className="flex-shrink-0 border-t py-2 px-4 bg-white dark:bg-gray-900">
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
          <DialogContent className="w-[95vw] max-w-[1200px] h-[85vh] p-0 overflow-hidden bg-transparent border-none shadow-none">
            <ViewCrewDetails
              crewMember={selectedCrewForView}
              onClose={() => setSelectedCrewForView(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Document Upload Dialog */}


      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-4xl border-0 p-0 bg-transparent shadow-none">
          <div className="h-full w-full">
            <DocumentUpload
              crewMemberId={selectedCrewForUpload?.id}
              preselectedType={uploadDocumentType || undefined}
              onSuccess={() => {
                setShowUploadDialog(false);
                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Crew Dialog */}
      {showAddCrewDialog && (
        <AddCrewForm
          open={showAddCrewDialog}
          onOpenChange={setShowAddCrewDialog}
          defaultVesselId={vessel?.id}
        />
      )}

      {/* Edit Crew Dialog */}
      {selectedCrewForEdit && (
        <Dialog open={showEditCrewDialog} onOpenChange={(open) => {
          setShowEditCrewDialog(open);
          if (!open) setSelectedCrewForEdit(null);
        }}>
          <DialogContent className="w-[95vw] max-w-[1200px] h-[85vh] p-0 overflow-hidden bg-transparent border-none shadow-none">
            <EditCrewForm
              crewMember={selectedCrewForEdit}
              onSuccess={() => {
                setShowEditCrewDialog(false);
                setSelectedCrewForEdit(null);
              }}
            />
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

      {/* Vessel History Dialog */}
      <Dialog open={showVesselHistoryDialog} onOpenChange={setShowVesselHistoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Vessel History
            </DialogTitle>
            <DialogDescription>
              History for {selectedCrewForHistory?.firstName} {selectedCrewForHistory?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border border-dashed rounded-lg">
              <Ship className="h-8 w-8 mb-2 opacity-50" />
              <p>Vessel history timeline coming soon</p>
            </div>
            {selectedCrewForHistory?.lastVessel && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Last Vessel:</p>
                <p className="text-sm text-foreground">{selectedCrewForHistory.lastVessel.name}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Document Upload Dialog */}
      <BulkUploadDialog
        open={isBulkUploadModalOpen}
        onOpenChange={setIsBulkUploadModalOpen}
        crewMember={selectedCrewForBulkUpload}
        onSuccess={() => {
          setIsBulkUploadModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
          queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
        }}
      />
    </Dialog>
  );
}

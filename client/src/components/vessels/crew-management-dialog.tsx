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

  // Document Upload State
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedCrewForUpload, setSelectedCrewForUpload] = useState<CrewMemberWithDetails | null>(null);
  const [uploadDocumentType, setUploadDocumentType] = useState<string | null>(null);
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
        // Map 'active' or any other non-standard status to 'onBoard' to satisfy schema
        status: (selectedCrewForEdit.status === 'onShore' ? 'onShore' : 'onBoard') as 'onBoard' | 'onShore',
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
      const saveDocument = async (type: string, docData: { documentNumber: string; issuingAuthority: string; issueDate: string; expiryDate: string | null }) => {
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
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `Documents_${crewName.replace(/\s+/g, '_')}.zip`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
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
        const response = await fetch(`/api/contracts/${m.activeContract.id}/view`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch document');
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
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${vessel.name.replace(/\s+/g, '_')}_CrewReport_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

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

  if (!vessel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 shadow-2xl">
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
                        onDelete={handleDeleteClick}
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
                        <Badge className="ml-3 bg-amber-100 text-amber-800 border-amber-200">TBD (To Be Determined)</Badge>
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

      {/* Document Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-4xl border-0 p-0 bg-transparent shadow-none">
          <div className="h-full w-full">
            <DocumentUpload
              crewMemberId={selectedCrewForUpload?.id}
              preselectedType={uploadDocumentType || undefined}
              onSuccess={() => {
                setShowUploadDialog(false);
                queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vessel?.id}/crew`] });
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
                }, (errors) => {
                  console.error('Form validation errors:', errors);
                  const errorMessages = Object.entries(errors)
                    .map(([field, error]: [string, any]) => {
                      const message = error.message || 'Invalid value';
                      const fieldName = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      return `${fieldName}: ${message}`;
                    })
                    .join(', ');

                  toast({
                    title: 'Validation Error',
                    description: `Please correct: ${errorMessages}`,
                    variant: 'destructive',
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

                  {/* Contract Details */}
                  <div className="space-y-3 p-4 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-sky-900 dark:text-sky-100 flex items-center">
                      <div className="w-2 h-2 bg-sky-600 rounded-full mr-3"></div>
                      Contract Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editCrewForm.control}
                        name="contractStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  const startDate = e.target.value;
                                  const duration = editCrewForm.getValues('contractDurationDays');
                                  if (startDate && duration) {
                                    const start = new Date(startDate);
                                    const end = new Date(start);
                                    end.setDate(start.getDate() + parseInt(duration.toString()));
                                    editCrewForm.setValue('contractEndDate', end.toISOString().split('T')[0]);
                                  }
                                }}
                                data-testid="edit-input-contractStartDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="contractDurationDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration (Days)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  field.onChange(val);
                                  const startDate = editCrewForm.getValues('contractStartDate');
                                  if (startDate && val > 0) {
                                    const start = new Date(startDate);
                                    const end = new Date(start);
                                    end.setDate(start.getDate() + val);
                                    editCrewForm.setValue('contractEndDate', end.toISOString().split('T')[0], { shouldDirty: true });
                                  }
                                }}
                                data-testid="edit-input-contractDurationDays"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCrewForm.control}
                        name="contractEndDate"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>End Date (Auto-calculated)</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                readOnly
                                disabled
                                className="bg-muted"
                                data-testid="edit-input-contractEndDate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                            <Label htmlFor="edit-cocNotApplicable" className="text-sm font-medium cursor-pointer">TBD (To Be Determined)</Label>
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
    </Dialog>
  );
}

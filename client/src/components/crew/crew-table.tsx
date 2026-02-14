import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Eye, Edit, LogOut, LogIn, X, Ship, Trash2, Mail, Loader2, Archive, FileText, Users } from 'lucide-react';
import React, { useState } from 'react';
import { CrewMemberWithDetails, Document } from '@shared/schema';
import EditCrewForm from './edit-crew-form';
import SignOnWizardDialog from './sign-on-wizard-dialog';
import { ContractProgress } from './contract-progress';
import { AOAViewDialog } from './aoa-view-dialog';
import { formatDate } from '@/lib/utils';
import { CrewDetailCard } from './crew-detail-card';
import DocumentUpload from '../documents/document-upload';

// Helper function for calculating contract days remaining
export const getContractDaysRemaining = (member: any) => {
  if (!member.activeContract) return 0;

  const now = new Date();
  const endDate = new Date(member.activeContract.endDate);
  const daysDiff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Return days remaining (can be negative if expired, positive if future)
  return daysDiff > 0 ? daysDiff : 0;
};

export default function CrewTable() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [vesselFilter, setVesselFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMemberWithDetails | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showVesselHistoryDialog, setShowVesselHistoryDialog] = useState(false);
  const [selectedCrewForHistory, setSelectedCrewForHistory] = useState<CrewMemberWithDetails | null>(null);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedCrewForContract, setSelectedCrewForContract] = useState<CrewMemberWithDetails | null>(null);
  const [selectedVesselForAssignment, setSelectedVesselForAssignment] = useState<any>(null);
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractDuration, setContractDuration] = useState('90');
  const [contractEndDate, setContractEndDate] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedHistoryForDeletion, setSelectedHistoryForDeletion] = useState<any>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [signOffDialogOpen, setSignOffDialogOpen] = useState(false);
  const [selectedCrewForSignOff, setSelectedCrewForSignOff] = useState<CrewMemberWithDetails | null>(null);
  const [signOffReason, setSignOffReason] = useState('');
  const [signOnDialogOpen, setSignOnDialogOpen] = useState(false);
  const [selectedCrewForSignOn, setSelectedCrewForSignOn] = useState<CrewMemberWithDetails | null>(null);
  const [signOnReason, setSignOnReason] = useState('');
  const [signOnVesselId, setSignOnVesselId] = useState('');
  const [signOnContractStartDate, setSignOnContractStartDate] = useState('');
  const [signOnContractDuration, setSignOnContractDuration] = useState('90');
  const [signOnContractEndDate, setSignOnContractEndDate] = useState('');
  const [deleteCrewDialogOpen, setDeleteCrewDialogOpen] = useState(false);
  const [selectedCrewForDeletion, setSelectedCrewForDeletion] = useState<CrewMemberWithDetails | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedCrewForEmail, setSelectedCrewForEmail] = useState<CrewMemberWithDetails | null>(null);
  const [emailRecipientType, setEmailRecipientType] = useState<'crew' | 'additional'>('crew');
  const [additionalEmail, setAdditionalEmail] = useState('');
  const [showAOADialog, setShowAOADialog] = useState(false);
  const [selectedCrewForAOA, setSelectedCrewForAOA] = useState<CrewMemberWithDetails | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCrewForUpload, setSelectedCrewForUpload] = useState<any>(null);
  const [selectedUploadType, setSelectedUploadType] = useState<string | undefined>(undefined);

  const { data: crewMembers = [], isLoading, refetch } = useQuery<CrewMemberWithDetails[]>({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      console.log('Fetching crew data...');
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      const data = await response.json();
      console.log('Received crew data:', data);
      return data;
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

  const { data: rotations = [] } = useQuery({
    queryKey: ['/api/rotations'],
    queryFn: async () => {
      const response = await fetch('/api/rotations', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch rotations');
      return response.json();
    },
  });

  // Documents query for expiry tracking
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  // Document types to track in crew overview
  const TRACKED_DOC_TYPES = ['passport', 'cdc', 'coc', 'medical', 'aoa', 'photo', 'nok'] as const;

  // Get document expiry status for a crew member
  const getCrewDocumentExpiry = (member: any) => {
    const crewDocs = documents.filter(doc => doc.crewMemberId === member.id);
    const now = new Date();
    const isShore = member.status === 'onShore' || !member.currentVesselId;

    return TRACKED_DOC_TYPES.map(type => {
      // For COC, also check for 'stcw' type since they're used interchangeably
      // Smart matching: Prioritize documents with file paths to avoid placeholders (from legacy data)
      let doc = crewDocs.find(d => {
        const docType = d.type.toLowerCase();
        const searchType = type.toLowerCase();
        const isMatch = searchType === 'coc' ? (docType === 'coc' || docType === 'stcw') : (docType === searchType);
        return isMatch && d.filePath;
      }) || crewDocs.find(d => {
        const docType = d.type.toLowerCase();
        const searchType = type.toLowerCase();
        return searchType === 'coc' ? (docType === 'coc' || docType === 'stcw') : (docType === searchType);
      });

      // Special handling for AOA - fallback to active contract if document is missing
      if (type === 'aoa' && !doc && member.activeContract) {
        const contract = member.activeContract;
        if (contract.filePath || contract.endDate) {
          const expiryDate = contract.endDate ? new Date(contract.endDate) : null;
          const daysUntil = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

          let status: 'valid' | 'expiring' | 'expired' | 'missing' | 'runway_alert' = 'valid';
          if (daysUntil !== null && daysUntil < 0) status = 'expired';
          else if (daysUntil !== null && daysUntil <= 30) status = 'expiring';

          return {
            type,
            status,
            expiryDate,
            daysUntil,
            docId: contract.id,
            filePath: contract.filePath,
            isContract: true
          };
        }
      }

      if (!doc) {
        return { type, status: 'missing' as const, expiryDate: null, daysUntil: null, docId: null, filePath: null };
      }

      // Handle documents without expiry dates (like Photo/NOK)
      if (!doc.expiryDate) {
        // If file exists, it's valid (standard for Photo/NOK)
        if (doc.filePath) {
          return { type, status: 'valid' as const, expiryDate: null, daysUntil: null, docId: doc.id, filePath: doc.filePath };
        }
        return { type, status: 'missing' as const, expiryDate: null, daysUntil: null, docId: doc.id, filePath: doc.filePath };
      }

      const expiryDate = new Date(doc.expiryDate);

      // Check if date is valid
      if (isNaN(expiryDate.getTime())) {
        return { type, status: 'missing' as const, expiryDate: null, daysUntil: null, docId: doc.id, filePath: doc.filePath };
      }

      const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let status: 'valid' | 'expiring' | 'expired' | 'missing' | 'runway_alert' = 'valid';
      if (daysUntil < 0) {
        status = 'expired';
      } else if (daysUntil <= 30) {
        status = 'expiring';
      } else if (isShore && daysUntil <= 180) {
        // Contract Runway Alert: Valid now but expires within 6 months while on shore
        status = 'runway_alert';
      }

      return { type, status, expiryDate, daysUntil, docId: doc.id, filePath: doc.filePath };
    });
  };

  // Get document type label
  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      passport: 'Pass',
      cdc: 'CDC',
      coc: 'COC',
      medical: 'Med',
      aoa: 'AOA',
      photo: 'Photo',
      nok: 'NOK'
    };
    return labels[type] || type.toUpperCase();
  };

  const getDocStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'expiring': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'runway_alert': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200';
      case 'expired': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  // Get vessel history for a crew member
  const getVesselHistory = (crewMemberId: string) => {
    const crewRotations = rotations.filter((r: any) => r.crewMemberId === crewMemberId && r.status === 'completed');

    // Group by vessel and get unique vessels with dates
    const vesselMap = new Map();
    crewRotations.forEach((rotation: any) => {
      const vessel = vessels?.find((v: any) => v.id === rotation.vesselId);
      if (vessel && !vesselMap.has(vessel.id)) {
        vesselMap.set(vessel.id, {
          vessel,
          joinDate: rotation.joinDate,
          leaveDate: rotation.leaveDate
        });
      }
    });

    return Array.from(vesselMap.values());
  };

  const filteredCrew = crewMembers.filter(member => {
    const matchesSearch = `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.nationality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.rank.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesVessel = vesselFilter === 'all' || member.currentVesselId === vesselFilter;

    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;

    return matchesSearch && matchesVessel && matchesStatus;
  }) || [];

  const getStatusColor = (status: string | undefined, contractStatus?: string) => {
    // Prioritize crew member status over contract status
    if (status === 'onBoard') return 'bg-compliance-green text-white';
    if (status === 'onShore') return 'bg-ocean-blue text-white';

    // Legacy status support (if any old data exists)
    if (status === 'active') return 'bg-compliance-green text-white';
    if (status === 'onLeave') return 'bg-warning-amber text-white';
    if (status === 'inactive') return 'bg-gray-500 text-white';

    // Fallback to contract status if crew status is missing
    if (contractStatus === 'active') return 'bg-compliance-green text-white';
    if (contractStatus === 'completed' || contractStatus === 'terminated') return 'bg-gray-500 text-white';

    return 'bg-gray-500 text-white';
  };

  const getStatusDisplayText = (status: string | undefined) => {
    if (status === 'onBoard') return 'On Board';
    if (status === 'onShore') return 'On Shore';

    // Legacy status support (if any old data exists)
    if (status === 'active') return 'On Board';
    if (status === 'onLeave') return 'On Leave';
    if (status === 'inactive') return 'Inactive';

    return 'Unknown';
  };

  const getStatusDisplayTextMobile = (status: string | undefined) => {
    if (status === 'onBoard') return 'On\nBoard';
    if (status === 'onShore') return 'On\nShore';

    // Legacy status support (if any old data exists)
    if (status === 'active') return 'Act\nive';
    if (status === 'onLeave') return 'On\nLeave';
    if (status === 'inactive') return 'Inact\nive';

    return 'Unk\nnown';
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getContractDaysRemaining = (member: CrewMemberWithDetails) => {
    if (!member.activeContract) return 0;

    const now = new Date();
    const endDate = new Date(member.activeContract.endDate);
    const daysDiff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Return days remaining (can be negative if expired, positive if future)
    return daysDiff > 0 ? daysDiff : 0;
  };

  // Export the function so it can be used in other components like dashboard
  const exportedUtils = {
    getContractDaysRemaining,
    getStatusColor,
    getStatusDisplayText,
    getStatusDisplayTextMobile,
    getInitials
  };

  const handleUpload = (member: any, type: string) => {
    setSelectedCrewForUpload(member);
    setSelectedUploadType(type);
    setIsUploadModalOpen(true);
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

  // Handle assign button click
  const handleAssignToVessel = (crewMember: CrewMemberWithDetails, vessel: any, history: any) => {
    setSelectedCrewForContract(crewMember);
    setSelectedVesselForAssignment(vessel);
    setContractDialogOpen(true);

    // Set default start date to today
    const today = new Date().toISOString().split('T')[0];
    setContractStartDate(today);
    const endDate = calculateEndDate(today, contractDuration);
    setContractEndDate(endDate);
  };

  // Assign crew to vessel mutation
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
        const errorData = await response.text();
        console.error('Assignment failed:', response.status, errorData);

        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to assign crew member');
        } catch {
          throw new Error(`Assignment failed (${response.status}): ${errorData}`);
        }
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      toast({
        title: 'Success',
        description: 'Crew member assigned to vessel successfully',
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
              body: JSON.stringify({
                status: 'terminated',
              }),
            })
          )
        );
      }

      // Create the new contract
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crewMemberId: data.crewId,
          vesselId: data.vesselId,
          startDate: data.startDate,
          endDate: data.endDate,
          durationDays: data.durationDays,
          status: 'active',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create contract');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });

      toast({
        title: 'Success',
        description: 'Contract created successfully',
      });

      // Close all dialogs
      setContractDialogOpen(false);
      setShowVesselHistoryDialog(false);
      setSelectedCrewForContract(null);
      setSelectedVesselForAssignment(null);
      setContractStartDate('');
      setContractDuration('90');
      setContractEndDate('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create contract',
        variant: 'destructive',
      });
    },
  });

  // Delete rotation history mutation
  const deleteRotationMutation = useMutation({
    mutationFn: async ({ rotationId, reason, deletedBy }: { rotationId: string; reason: string; deletedBy: string }) => {
      const response = await fetch(`/api/rotations/${rotationId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          deletedBy,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Delete failed:', response.status, errorData);

        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to delete rotation history');
        } catch {
          throw new Error(`Delete failed (${response.status}): ${errorData}`);
        }
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });

      toast({
        title: 'Success',
        description: 'Vessel history record deleted successfully',
      });

      // Close dialogs and reset state
      setDeleteDialogOpen(false);
      setSelectedHistoryForDeletion(null);
      setDeletionReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rotation history',
        variant: 'destructive',
      });
    },
  });

  // Handle delete button click
  const handleDeleteHistory = (history: any, crewMember: CrewMemberWithDetails) => {
    setSelectedHistoryForDeletion({ ...history, crewMember });
    setDeleteDialogOpen(true);
    setDeletionReason('');
  };

  // Handle deletion confirmation
  const handleConfirmDeletion = async () => {
    if (!selectedHistoryForDeletion || !deletionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for deletion',
        variant: 'destructive',
      });
      return;
    }

    // Find the rotation record to delete
    const rotationToDelete = rotations.find((r: any) =>
      r.crewMemberId === selectedHistoryForDeletion.crewMember.id &&
      r.vesselId === selectedHistoryForDeletion.vessel.id &&
      r.status === 'completed'
    );

    if (!rotationToDelete) {
      toast({
        title: 'Error',
        description: 'Rotation record not found',
        variant: 'destructive',
      });
      return;
    }

    // Get current user's name
    const deletedBy = user?.username || 'Unknown User';

    deleteRotationMutation.mutate({
      rotationId: rotationToDelete.id,
      reason: deletionReason,
      deletedBy: deletedBy,
    });
  };

  const handleViewAOAClick = async (member: CrewMemberWithDetails) => {
    // Check for existing AOA document first
    const aoaDoc = member.documents?.find(d => d.type.toLowerCase() === 'aoa' && d.filePath);

    if (aoaDoc) {
      try {
        const response = await fetch(`/api/documents/${aoaDoc.id}/view`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => window.URL.revokeObjectURL(url), 100);
          return;
        }
      } catch (error) {
        console.error('Failed to view AOA doc', error);
        toast({
          title: 'Error',
          description: 'Failed to open saved AOA document.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Fallback to active contract if it has a file (common for AOA uploads)
    if (member.activeContract?.filePath) {
      try {
        const response = await fetch(`/api/contracts/${member.activeContract.id}/view`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => window.URL.revokeObjectURL(url), 100);
          return;
        }
      } catch (error) {
        console.error('Failed to view contract as AOA', error);
      }
    }

    // Fallback to generator dialog
    setSelectedCrewForAOA(member);
    setShowAOADialog(true);
  };

  // Handle contract confirmation
  const handleConfirmContract = () => {
    if (!selectedCrewForContract || !selectedVesselForAssignment) return;

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
      { crewId: selectedCrewForContract.id, vesselId: selectedVesselForAssignment.id },
      {
        onSuccess: () => {
          // Then create the contract
          createContractMutation.mutate({
            crewId: selectedCrewForContract.id,
            vesselId: selectedVesselForAssignment.id,
            startDate: contractStartDate,
            durationDays: durationDays,
            endDate: contractEndDate,
          });
        },
      }
    );
  };

  // Sign off crew member mutation
  const signOffCrewMutation = useMutation({
    mutationFn: async ({ crewId, reason }: { crewId: string; reason: string }) => {
      // First, get the crew member's current vessel to preserve it as lastVessel
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
        console.error('Sign-off failed:', response.status, errorData);

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

  // Sign on crew member mutation (for crew members currently on shore)
  const signOnCrewMutation = useMutation({
    mutationFn: async ({ crewId, reason, vesselId, contractStartDate, contractEndDate, profileUpdates }: {
      crewId: string;
      reason: string;
      vesselId: string;
      contractStartDate: string;
      contractEndDate: string;
      profileUpdates?: any;
    }) => {
      // First update crew member status and vessel assignment
      const crewResponse = await fetch(`/api/crew/${crewId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'onBoard',
          currentVesselId: vesselId,
          statusChangeReason: reason,
          ...(profileUpdates || {})
        }),
      });
      if (!crewResponse.ok) {
        const errorData = await crewResponse.text();
        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to sign on crew member');
        } catch {
          throw new Error(`Sign-on failed (${crewResponse.status}): ${errorData}`);
        }
      }

      // Create contract for the crew member
      const durationDays = Math.ceil((new Date(contractEndDate).getTime() - new Date(contractStartDate).getTime()) / (1000 * 60 * 60 * 24));
      const contractResponse = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crewMemberId: crewId,
          vesselId: vesselId,
          startDate: contractStartDate,
          endDate: contractEndDate,
          durationDays: durationDays,
          status: 'active',
        }),
      });
      if (!contractResponse.ok) {
        const errorData = await contractResponse.text();
        try {
          const errorJson = JSON.parse(errorData);
          throw new Error(errorJson.message || errorJson.error || 'Failed to create contract');
        } catch {
          throw new Error(`Contract creation failed (${contractResponse.status}): ${errorData}`);
        }
      }

      return crewResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSignOnDialogOpen(false);
      setSelectedCrewForSignOn(null);
      setSignOnReason('');
      setSignOnVesselId('');
      setSignOnContractStartDate('');
      setSignOnContractDuration('90');
      setSignOnContractEndDate('');
      toast({
        title: 'Success',
        description: 'Crew member signed on successfully with contract created',
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
    setSignOnVesselId('');
    const today = new Date().toISOString().split('T')[0];
    setSignOnContractStartDate(today);
    setSignOnContractDuration('90');
    // Calculate end date (90 days from today by default)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);
    setSignOnContractEndDate(endDate.toISOString().split('T')[0]);
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
    if (!signOnVesselId) {
      toast({
        title: 'Vessel Required',
        description: 'Please select a vessel for assignment',
        variant: 'destructive',
      });
      return;
    }
    if (!signOnContractStartDate || !signOnContractEndDate) {
      toast({
        title: 'Contract Dates Required',
        description: 'Please provide contract start and end dates',
        variant: 'destructive',
      });
      return;
    }
    signOnCrewMutation.mutate({
      crewId: selectedCrewForSignOn.id,
      reason: signOnReason.trim(),
      vesselId: signOnVesselId,
      contractStartDate: signOnContractStartDate,
      contractEndDate: signOnContractEndDate,
    });
  };

  // Calculate sign-on contract end date when start date or duration changes
  const calculateSignOnEndDate = (startDate: string, duration: string) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    start.setDate(start.getDate() + parseInt(duration));
    return start.toISOString().split('T')[0];
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

  // Send crew details email mutation
  const sendCrewEmailMutation = useMutation({
    mutationFn: async (data: { crewMemberId: string; additionalEmail?: string }) => {
      const response = await fetch('/api/email/send-crew-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setEmailDialogOpen(false);
      setSelectedCrewForEmail(null);
      setAdditionalEmail('');
      setEmailRecipientType('crew');
      toast({
        title: 'Email Sent',
        description: data.message || 'Crew details sent successfully via email',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive',
      });
    },
  });

  const handleSendEmailClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForEmail(member);
    setEmailDialogOpen(true);
  };

  const handleSendEmailConfirm = () => {
    if (!selectedCrewForEmail) return;

    // Get latest crew member data from the crewMembers array
    const latestCrewData = crewMembers.find(c => c.id === selectedCrewForEmail.id);
    const currentEmail = latestCrewData?.email || selectedCrewForEmail.email;

    // Determine which email to send to based on radio selection
    const emailToSend = emailRecipientType === 'crew'
      ? currentEmail
      : additionalEmail;

    sendCrewEmailMutation.mutate({
      crewMemberId: selectedCrewForEmail.id,
      additionalEmail: emailToSend || undefined
    });
  };

  // Download crew member documents as ZIP
  const handleDownloadCrewDocuments = async (crewMemberId: string, crewName: string) => {
    try {
      const response = await fetch(`/api/crew/${crewMemberId}/documents/download-all`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download documents');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${crewName.replace(/\s+/g, '_')}_documents.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: `Downloaded documents for ${crewName}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to download documents',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  // For crew members, show only their own profile
  if (user?.role === 'crew') {
    const currentMember = crewMembers?.find(member => member.user?.id === user.id);
    if (!currentMember) {
      return <div className="text-center py-8 text-muted-foreground">Profile not found</div>;
    }

    return (
      <div className="space-y-4">
        <div className="bg-muted rounded-lg p-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16 bg-maritime-navy">
              <AvatarFallback className="text-white text-lg font-semibold">
                {getInitials(currentMember.firstName, currentMember.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                {currentMember.firstName} {currentMember.lastName}
              </h3>
              <p className="text-secondary-foreground">{currentMember.rank}</p>
              <p className="text-sm text-muted-foreground">{currentMember.nationality}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Vessel</p>
              <p className="mt-1 text-foreground">{currentMember.currentVessel?.name || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contract Status</p>
              <Badge className={getStatusColor(currentMember.status, currentMember.activeContract?.status)} data-testid="crew-status">
                {getStatusDisplayText(currentMember.status)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="mt-1 text-foreground">{currentMember.phoneNumber || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="mt-1 text-foreground">{(currentMember as any).email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Documents</p>
              <p className="mt-1 text-foreground">{currentMember.documents?.length || 0} documents on file</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col responsive-container">
      {/* Search and Filter - Clean Minimal Design */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="p-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search crew members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-10 h-12 text-base bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 rounded-lg"
              data-testid="crew-search-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                data-testid="clear-search-button"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Vessel Filter */}
            <Select value={vesselFilter} onValueChange={setVesselFilter}>
              <SelectTrigger className="w-[200px] h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" data-testid="vessel-filter-select">
                <div className="flex items-center gap-2">
                  <Ship className="h-4 w-4 text-slate-500" />
                  <SelectValue placeholder="All Vessels" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels?.map((vessel: any) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" data-testid="status-filter-select">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <SelectValue placeholder="All Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="onBoard">On Board</SelectItem>
                <SelectItem value="onShore">On Shore</SelectItem>
              </SelectContent>
            </Select>

            {/* Results Count */}
            {(searchTerm || vesselFilter !== 'all' || statusFilter !== 'all') && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-md text-sm font-medium">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                {filteredCrew.length} {filteredCrew.length === 1 ? 'result' : 'results'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Crew List - Desktop and Large Tablets - Modern Card Grid */}
      <div className="flex-1 min-h-0 hidden lg:block">
        <div className="h-full w-full overflow-y-auto p-6">
          {filteredCrew.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No crew members found
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredCrew.map((member) => {
                const startDate = member.activeContract?.startDate ? new Date(member.activeContract.startDate) : null;
                const endDate = member.activeContract?.endDate ? new Date(member.activeContract.endDate) : null;
                const now = new Date();

                let remainingDays = 0;
                let totalDays = 0;
                let progressPercent = 0;

                if (startDate && endDate && member.activeContract?.status === 'active' && member.status !== 'onShore') {
                  totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                  remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  progressPercent = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;
                }

                const formatShortDate = (date: Date | null) => {
                  if (!date) return '';
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                };

                return (
                  <CrewDetailCard
                    key={member.id}
                    member={member}
                    documents={documents}
                    onView={(m) => { setSelectedCrewMember(m); setShowViewDialog(true); }}
                    onEdit={(m) => { setSelectedCrewMember(m); setShowEditDialog(true); }}
                    onVesselHistory={(m) => { setSelectedCrewForHistory(m); setShowVesselHistoryDialog(true); }}
                    onSendMail={handleSendEmailClick}
                    onDownload={handleDownloadCrewDocuments}
                    onViewAOA={handleViewAOAClick}
                    onDelete={handleDeleteClick}
                    onSignOn={handleSignOnClick}
                    onSignOff={handleSignOffClick}
                    onUpload={handleUpload}
                    isMailPending={sendCrewEmailMutation.isPending}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile and Tablet Crew Cards */}
      <div className="flex-1 min-h-0 lg:hidden">
        <div className="h-full overflow-y-auto space-y-3 pt-4 px-3 max-w-full w-full">
          {filteredCrew.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No crew members found</p>
            </div>
          ) : (
            filteredCrew.map((member) => (
              <div key={member.id} className="crew-card w-full max-w-full overflow-hidden box-border" data-testid={`crew-card-${member.id}`}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0" style={{ maxWidth: 'calc(100% - 56px)' }}>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground text-sm truncate" data-testid="crew-name">
                          {member.firstName} {member.lastName}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{member.nationality}</p>
                      </div>
                    </div>
                    <div className="w-full">
                      <ContractProgress
                        startDate={member.activeContract?.startDate || ''}
                        endDate={member.activeContract?.endDate || ''}
                        status={member.activeContract?.status || ''}
                        crewStatus={member.status}
                        memberId={member.id}
                        compact={true}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 w-12 max-w-12 flex justify-center">
                    <Badge
                      className={`${getStatusColor(member.status, member.activeContract?.status)} px-0 py-0 w-12 max-w-12 text-center border-0 mobile-status-badge`}
                      data-testid="crew-status"
                      style={{ fontSize: '8px', lineHeight: '9px', minHeight: '24px' }}
                    >
                      <span className="mobile-status-text">
                        {getStatusDisplayTextMobile(member.status)}
                      </span>
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="min-w-0 overflow-hidden">
                    <span className="text-muted-foreground block">Rank:</span>
                    <p className="font-medium text-foreground truncate break-words" data-testid="crew-rank" title={member.rank}>
                      {member.rank}
                    </p>
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <span className="text-muted-foreground block">Vessel:</span>
                    <p className="font-medium text-foreground truncate break-words" data-testid="crew-vessel" title={member.currentVessel?.name || 'Not assigned'}>
                      {member.currentVessel?.name || 'Not assigned'}
                    </p>
                  </div>
                </div>

                {/* Document Expiry Status - Mobile */}
                <div className="mb-3">
                  <span className="text-xs text-muted-foreground block mb-1">Docs:</span>
                  <div className="flex flex-wrap gap-1" data-testid={`doc-status-mobile-${member.id}`}>
                    {getCrewDocumentExpiry(member).map((doc) => (
                      <div
                        key={doc.type}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getDocStatusColor(doc.status)}`}
                        title={doc.expiryDate ? `Expires: ${formatDate(doc.expiryDate)}` : 'Not uploaded'}
                      >
                        {getDocTypeLabel(doc.type)}
                        {doc.status === 'expiring' && doc.daysUntil !== null && (
                          <span className="ml-0.5">({doc.daysUntil}d)</span>
                        )}
                        {doc.status === 'expired' && <span className="ml-0.5">!</span>}
                        {doc.status === 'missing' && <span className="ml-0.5">-</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:bg-accent h-7 text-xs px-2 flex-shrink-0"
                    data-testid={`view-crew-${member.id}`}
                    onClick={() => {
                      setSelectedCrewMember(member);
                      setShowViewDialog(true);
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-accent h-7 text-xs px-2 flex-shrink-0"
                    data-testid={`edit-crew-${member.id}`}
                    onClick={() => {
                      setSelectedCrewMember(member);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-ocean-blue hover:bg-accent h-7 text-xs px-2 flex-shrink-0"
                    data-testid={`vessel-history-mobile-${member.id}`}
                    onClick={() => {
                      setSelectedCrewForHistory(member);
                      setShowVesselHistoryDialog(true);
                    }}
                  >
                    <Ship className="h-3 w-3 mr-1" />
                    History
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:bg-blue-50 h-7 text-xs px-2 flex-shrink-0"
                    data-testid={`send-mail-mobile-${member.id}`}
                    onClick={() => handleSendEmailClick(member)}
                    disabled={sendCrewEmailMutation.isPending}
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    {sendCrewEmailMutation.isPending ? 'Sending...' : 'Send Mail'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-600 hover:bg-purple-50 h-7 text-xs px-2 flex-shrink-0"
                    data-testid={`download-docs-mobile-${member.id}`}
                    onClick={() => handleDownloadCrewDocuments(member.id, `${member.firstName} ${member.lastName}`)}
                  >
                    <Archive className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  {member.activeContract && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cyan-600 hover:bg-cyan-50 h-7 text-xs px-2 flex-shrink-0"
                      onClick={() => handleViewAOAClick(member)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View AOA
                    </Button>
                  )}
                  {member.status === 'onShore' ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:bg-green-50 h-7 text-xs px-2 flex-shrink-0"
                        data-testid={`signon-crew-mobile-${member.id}`}
                        onClick={() => handleSignOnClick(member)}
                      >
                        <LogIn className="h-3 w-3 mr-1" />
                        Sign On
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 h-7 text-xs px-2 flex-shrink-0"
                        data-testid={`delete-crew-mobile-${member.id}`}
                        onClick={() => handleDeleteClick(member)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-600 hover:bg-orange-50 h-7 text-xs px-2 flex-shrink-0"
                      data-testid={`signoff-crew-mobile-${member.id}`}
                      onClick={() => handleSignOffClick(member)}
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      Sign Off
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View Crew Member Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Crew Member Details
            </DialogTitle>
          </DialogHeader>
          {selectedCrewMember && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16 bg-maritime-navy">
                  <AvatarFallback className="text-white text-lg font-medium">
                    {getInitials(selectedCrewMember.firstName, selectedCrewMember.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {selectedCrewMember.firstName} {selectedCrewMember.lastName}
                  </h3>
                  <p className="text-muted-foreground">{selectedCrewMember.rank}</p>
                  <Badge className={getStatusColor(selectedCrewMember.status, selectedCrewMember.activeContract?.status)}>
                    {selectedCrewMember.status === 'onBoard' ? 'On Board' :
                      selectedCrewMember.status === 'onShore' ? 'On Shore' :
                        selectedCrewMember.status === 'active' ? 'On Board' :
                          selectedCrewMember.status === 'onLeave' ? 'On Leave' :
                            selectedCrewMember.status === 'inactive' ? 'On Shore' : 'Unknown'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                {/* Personal Information */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center mb-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    Personal Information
                  </h4>
                  <div className="text-sm space-y-2">
                    <p><span className="font-medium">Nationality:</span> {selectedCrewMember.nationality}</p>
                    <p><span className="font-medium">Date of Birth:</span> {formatDate(selectedCrewMember.dateOfBirth)}</p>
                    {selectedCrewMember.phoneNumber && (
                      <p><span className="font-medium">Phone:</span>{' '}
                        <a
                          href={`tel:${selectedCrewMember.phoneNumber}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          {selectedCrewMember.phoneNumber}
                        </a>
                      </p>
                    )}
                    {(selectedCrewMember as any).email && (
                      <p><span className="font-medium">Email:</span>{' '}
                        <a
                          href={`mailto:${(selectedCrewMember as any).email}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          {(selectedCrewMember as any).email}
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Professional Information */}
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <h4 className="font-medium text-green-900 dark:text-green-100 flex items-center mb-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                    Professional Information
                  </h4>
                  <div className="text-sm space-y-2">
                    <p><span className="font-medium">Current Vessel:</span> {(selectedCrewMember.currentVessel?.name as string) || 'Not assigned'}</p>
                    <p><span className="font-medium">Status:</span> {selectedCrewMember.status as string}</p>
                  </div>
                </div>

                {/* Emergency Contact / Next of Kin */}
                {!!selectedCrewMember.emergencyContact && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-orange-600 rounded-full mr-3"></div>
                      Next of Kin (NOK)
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Name:</span> {(selectedCrewMember.emergencyContact as any).name}</p>
                      <p><span className="font-medium">Relationship:</span> {(selectedCrewMember.emergencyContact as any).relationship}</p>
                      <p><span className="font-medium">Phone:</span>{' '}
                        {(selectedCrewMember.emergencyContact as any).phone ? (
                          <a
                            href={`tel:${(selectedCrewMember.emergencyContact as any).phone}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                          >
                            {(selectedCrewMember.emergencyContact as any).phone}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span>{' '}
                        {(selectedCrewMember.emergencyContact as any).email ? (
                          <a
                            href={`mailto:${(selectedCrewMember.emergencyContact as any).email}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                          >
                            {(selectedCrewMember.emergencyContact as any).email}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                      {(selectedCrewMember.emergencyContact as any).postalAddress && (
                        <p><span className="font-medium">Postal Address:</span> {(selectedCrewMember.emergencyContact as any).postalAddress}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Passport Details */}
                {(() => {
                  const passport = selectedCrewMember.documents?.find(d => d.type === 'passport');
                  return passport ? (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <h4 className="font-medium text-indigo-900 dark:text-indigo-100 flex items-center mb-3">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></div>
                        Passport Details
                      </h4>
                      <div className="text-sm space-y-2">
                        <p><span className="font-medium">Passport Number:</span> {passport.documentNumber}</p>
                        <p><span className="font-medium">Place of Issue:</span> {passport.issuingAuthority}</p>
                        <p><span className="font-medium">Issue Date:</span> {formatDate(passport.issueDate)}</p>
                        <p><span className="font-medium">Expiry Date:</span> {formatDate(passport.expiryDate)}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* CDC Details */}
                {(() => {
                  const cdc = selectedCrewMember.documents?.find(d => d.type === 'cdc');
                  return cdc ? (
                    <div className="p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
                      <h4 className="font-medium text-teal-900 dark:text-teal-100 flex items-center mb-3">
                        <div className="w-2 h-2 bg-teal-600 rounded-full mr-3"></div>
                        CDC Details
                      </h4>
                      <div className="text-sm space-y-2">
                        <p><span className="font-medium">CDC Number:</span> {cdc.documentNumber}</p>
                        <p><span className="font-medium">Place of Issue:</span> {cdc.issuingAuthority}</p>
                        <p><span className="font-medium">Issue Date:</span> {formatDate(cdc.issueDate)}</p>
                        <p><span className="font-medium">Expiry Date:</span> {formatDate(cdc.expiryDate)}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* COC Details */}
                {(() => {
                  const coc = selectedCrewMember.documents?.find(d => d.type === 'coc');
                  return coc ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <h4 className="font-medium text-amber-900 dark:text-amber-100 flex items-center mb-3">
                        <div className="w-2 h-2 bg-amber-600 rounded-full mr-3"></div>
                        COC Details
                      </h4>
                      <div className="text-sm space-y-2">
                        <p><span className="font-medium">COC Grade/Number:</span> {coc.documentNumber}</p>
                        <p><span className="font-medium">Place of Issue:</span> {coc.issuingAuthority}</p>
                        <p><span className="font-medium">Issue Date:</span> {formatDate(coc.issueDate)}</p>
                        <p><span className="font-medium">Expiry Date:</span> {formatDate(coc.expiryDate)}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Medical Details */}
                {(() => {
                  const medical = selectedCrewMember.documents?.find(d => d.type === 'medical');
                  return medical ? (
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                      <h4 className="font-medium text-rose-900 dark:text-rose-100 flex items-center mb-3">
                        <div className="w-2 h-2 bg-rose-600 rounded-full mr-3"></div>
                        Medical Certificate Details
                      </h4>
                      <div className="text-sm space-y-2">
                        <p><span className="font-medium">Issuing Authority:</span> {medical.issuingAuthority}</p>
                        <p><span className="font-medium">Approval Number:</span> {medical.documentNumber}</p>
                        <p><span className="font-medium">Issue Date:</span> {formatDate(medical.issueDate)}</p>
                        <p><span className="font-medium">Expiry Date:</span> {formatDate(medical.expiryDate)}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* AOA (Articles of Agreement) Details */}
                {(() => {
                  const aoaDoc = selectedCrewMember.documents?.find(d => d.type === 'aoa');
                  const contract = selectedCrewMember.activeContract;
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
                            <button
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
                              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                              <FileText className="h-4 w-4" />
                              View AOA Document
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Contract Information */}
                {selectedCrewMember.activeContract && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 flex items-center mb-3">
                      <div className="w-2 h-2 bg-purple-600 rounded-full mr-3"></div>
                      Contract Information
                    </h4>
                    <div className="text-sm space-y-2">
                      <p><span className="font-medium">Start Date:</span> {formatDate(selectedCrewMember.activeContract.startDate)}</p>
                      <p><span className="font-medium">End Date:</span> {formatDate(selectedCrewMember.activeContract.endDate)}</p>
                      {selectedCrewMember.activeContract.filePath && (
                        <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                          <p className="font-medium mb-2">Contract Document:</p>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/contracts/${selectedCrewMember.activeContract?.id}/view`, {
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
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowViewDialog(false);
                    setShowEditDialog(true);
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vessel History Dialog */}
      <Dialog open={showVesselHistoryDialog} onOpenChange={setShowVesselHistoryDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Ship className="h-5 w-5 text-ocean-blue" />
              <span>Previous Vessels Joined</span>
            </DialogTitle>
          </DialogHeader>

          {selectedCrewForHistory && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                <Avatar className="h-12 w-12 bg-maritime-navy">
                  <AvatarFallback className="text-white text-sm font-medium">
                    {selectedCrewForHistory.firstName.charAt(0)}{selectedCrewForHistory.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-foreground">
                    {selectedCrewForHistory.firstName} {selectedCrewForHistory.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedCrewForHistory.rank}</p>
                </div>
              </div>

              {(() => {
                const vesselHistory = getVesselHistory(selectedCrewForHistory.id);

                return vesselHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ship className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No previous vessel history found</p>
                    <p className="text-sm mt-1">This crew member has no completed rotations</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      {vesselHistory.length} {vesselHistory.length === 1 ? 'vessel' : 'vessels'} served
                    </p>
                    {vesselHistory.map((history: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                        data-testid={`vessel-history-${index}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <h4 className="font-medium text-foreground flex items-center">
                              <Ship className="h-4 w-4 mr-2 text-ocean-blue" />
                              {history.vessel.name}
                            </h4>
                            <div className="text-sm space-y-1 text-muted-foreground">
                              <p>
                                <span className="font-medium">Type:</span> {history.vessel.type}
                              </p>
                              <p>
                                <span className="font-medium">Sign On:</span>{' '}
                                {history.joinDate
                                  ? formatDate(history.joinDate)
                                  : 'N/A'
                                }
                              </p>
                              <p>
                                <span className="font-medium">Sign Off:</span>{' '}
                                {history.leaveDate
                                  ? formatDate(history.leaveDate)
                                  : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-ocean-blue text-white hover:bg-ocean-blue/90 hover:text-white"
                              onClick={() => handleAssignToVessel(selectedCrewForHistory!, history.vessel, history)}
                              data-testid={`assign-vessel-${index}`}
                            >
                              Assign
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-red-600 text-white hover:bg-red-700 hover:text-white"
                              onClick={() => handleDeleteHistory(history, selectedCrewForHistory!)}
                              data-testid={`delete-vessel-history-${index}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowVesselHistoryDialog(false);
                    setSelectedCrewForHistory(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Vessel History Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Vessel History Record</DialogTitle>
            <DialogDescription>
              You are about to delete the vessel history record for{' '}
              <span className="font-medium">
                {selectedHistoryForDeletion?.crewMember?.firstName}{' '}
                {selectedHistoryForDeletion?.crewMember?.lastName}
              </span>{' '}
              on vessel{' '}
              <span className="font-medium">{selectedHistoryForDeletion?.vessel?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <span className="font-medium">Performed by:</span> {user?.username || 'Unknown User'}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                This action will be logged for accountability and tracking purposes.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deletion-reason" className="text-red-600">
                Reason for Deletion <span className="text-red-600">*</span>
              </Label>
              <Input
                id="deletion-reason"
                placeholder="Enter the reason for deleting this record..."
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                className="border-red-200 focus:border-red-400"
                data-testid="input-deletion-reason"
              />
              <p className="text-xs text-muted-foreground">
                Please provide a clear reason for deleting this vessel history record.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedHistoryForDeletion(null);
                setDeletionReason('');
              }}
              data-testid="button-cancel-deletion"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeletion}
              disabled={deleteRotationMutation.isPending || !deletionReason.trim()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-deletion"
            >
              {deleteRotationMutation.isPending ? 'Deleting...' : 'Delete Record'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contract Information Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-maritime-navy">Contract Information</DialogTitle>
            <DialogDescription>
              Enter contract details for {selectedCrewForContract?.firstName} {selectedCrewForContract?.lastName} to join {selectedVesselForAssignment?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract-start-date">Contract Start Date</Label>
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
                  min="1"
                  data-testid="input-contract-duration"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-end-date">Contract End Date (Auto-calculated)</Label>
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

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setContractDialogOpen(false);
                setSelectedCrewForContract(null);
                setSelectedVesselForAssignment(null);
                setContractStartDate('');
                setContractDuration('90');
                setContractEndDate('');
              }}
              data-testid="button-cancel-contract"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmContract}
              disabled={assignCrewMutation.isPending || createContractMutation.isPending}
              data-testid="button-confirm-contract"
              className="bg-ocean-blue hover:bg-ocean-blue/90"
            >
              {assignCrewMutation.isPending || createContractMutation.isPending ? 'Processing...' : 'Confirm & Assign'}
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
                  You are signing off {selectedCrewForSignOff.firstName} {selectedCrewForSignOff.lastName} from {selectedCrewForSignOff.currentVessel?.name || 'their current vessel'}.
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
                className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ocean-blue"
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

      {/* Sign On Wizard Dialog */}
      <SignOnWizardDialog
        open={signOnDialogOpen}
        onOpenChange={setSignOnDialogOpen}
        crewMember={selectedCrewForSignOn}
        vessels={vessels || []}
        onSubmit={(data) => {
          if (!selectedCrewForSignOn) return;
          signOnCrewMutation.mutate({
            crewId: selectedCrewForSignOn.id,
            reason: data.reason,
            vesselId: data.vesselId,
            contractStartDate: data.startDate,
            contractEndDate: data.endDate,
            profileUpdates: data.profileUpdates,
          });
        }}
        isSubmitting={signOnCrewMutation.isPending}
      />

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

      {/* Edit Crew Member Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="p-6 overflow-y-auto max-h-[85vh]">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-foreground mb-3">
                Edit Crew Member
              </DialogTitle>
            </DialogHeader>
            {selectedCrewMember && (
              <EditCrewForm
                crewMember={selectedCrewMember}
                onSuccess={() => {
                  console.log('Edit form success - closing dialog and refreshing data');
                  setShowEditDialog(false);
                  setSelectedCrewMember(null);
                  // Force additional refresh to ensure UI updates
                  refetch();
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>



      {/* Send Crew Details Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Crew Details
            </DialogTitle>
            <DialogDescription>
              {selectedCrewForEmail && (
                <>Send complete details for {selectedCrewForEmail.firstName} {selectedCrewForEmail.lastName} via email.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select recipient:</Label>

              {/* Radio button for crew member's email */}
              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  id="email-to-crew"
                  name="email-recipient"
                  checked={emailRecipientType === 'crew'}
                  onChange={() => setEmailRecipientType('crew')}
                  className="mt-1"
                  data-testid="radio-email-crew"
                />
                <div className="flex-1">
                  <Label htmlFor="email-to-crew" className="text-sm font-medium cursor-pointer">
                    Send to crew member's email
                  </Label>
                  {(() => {
                    // Get latest crew member data from the crewMembers array
                    const latestCrewData = crewMembers.find(c => c.id === selectedCrewForEmail?.id);
                    const currentEmail = latestCrewData?.email || selectedCrewForEmail?.email;

                    return currentEmail ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentEmail}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ No email address found in Personnel Information
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Radio button for additional email */}
              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  id="email-to-additional"
                  name="email-recipient"
                  checked={emailRecipientType === 'additional'}
                  onChange={() => setEmailRecipientType('additional')}
                  className="mt-1"
                  data-testid="radio-email-additional"
                />
                <div className="flex-1">
                  <Label htmlFor="email-to-additional" className="text-sm font-medium cursor-pointer">
                    Send to additional email address
                  </Label>
                </div>
              </div>
            </div>

            {emailRecipientType === 'additional' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="additional-email-crew">Email Addresses</Label>
                <Input
                  id="additional-email-crew"
                  type="text"
                  placeholder="Enter email addresses (separate with commas)"
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                  data-testid="input-additional-email-crew"
                />
                <p className="text-xs text-muted-foreground">You can add multiple emails separated by commas</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmailDialogOpen(false);
                setSelectedCrewForEmail(null);
                setAdditionalEmail('');
                setEmailRecipientType('crew');
              }}
              data-testid="button-cancel-email-crew"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmailConfirm}
              disabled={(() => {
                if (sendCrewEmailMutation.isPending) return true;

                if (emailRecipientType === 'crew') {
                  const latestCrewData = crewMembers.find(c => c.id === selectedCrewForEmail?.id);
                  const currentEmail = latestCrewData?.email || selectedCrewForEmail?.email;
                  return !currentEmail;
                }

                return !additionalEmail;
              })()}
              data-testid="button-send-email-crew"
            >
              {sendCrewEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* AOA View Dialog */}
      <AOAViewDialog
        open={showAOADialog}
        onOpenChange={setShowAOADialog}
        crewMember={selectedCrewForAOA}
        vessels={vessels || []}
      />

      {/* Document Upload Dialog */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
          <DocumentUpload
            crewMemberId={selectedCrewForUpload?.id}
            preselectedType={selectedUploadType}
            onSuccess={() => {
              setIsUploadModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
              queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}





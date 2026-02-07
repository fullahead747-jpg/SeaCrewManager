import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Ship, User, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CrewMemberWithDetails } from '@shared/schema';
import { formatDate } from '@/lib/utils';

export default function ExHandDatabase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [vesselAssignments, setVesselAssignments] = useState<{[key: string]: string}>({});
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedCrewForContract, setSelectedCrewForContract] = useState<CrewMemberWithDetails | null>(null);
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractDuration, setContractDuration] = useState('90');
  const [contractEndDate, setContractEndDate] = useState('');

  // Fetch signed-off crew members with rotation history
  const { data: signedOffCrew = [], isLoading } = useQuery<CrewMemberWithDetails[]>({
    queryKey: ['/api/crew/signed-off'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      const allCrew = await response.json();
      // Filter for signed-off crew members
      return allCrew.filter((member: CrewMemberWithDetails) => member.status === 'onShore');
    },
  });

  // Fetch rotation history for all crew
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

  // Fetch vessels for dropdown
  const { data: vessels = [] } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      const data = await response.json();
      console.log('Loaded vessels:', data);
      console.log('Active vessels:', data.filter((v: any) => v.status === 'active'));
      return data;
    },
  });

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
          signOffDate: null, // Clear sign-off date when reassigning
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crew/signed-off'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      // Clear the selected vessel for this crew member
      setVesselAssignments(prev => {
        const updated = { ...prev };
        delete updated[variables.crewId];
        return updated;
      });
      
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Get vessel history for a crew member
  const getVesselHistory = (crewMemberId: string) => {
    const crewRotations = rotations.filter((r: any) => r.crewMemberId === crewMemberId && r.status === 'completed');
    
    // Group by vessel and get unique vessels with dates
    const vesselMap = new Map();
    crewRotations.forEach((rotation: any) => {
      const vessel = vessels.find((v: any) => v.id === rotation.vesselId);
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

  const handleVesselSelect = (crewId: string, vesselId: string) => {
    console.log('Vessel selected:', vesselId, 'for crew:', crewId);
    setVesselAssignments(prev => ({
      ...prev,
      [crewId]: vesselId
    }));
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

  const handleAssignCrew = (crewId: string) => {
    const vesselId = vesselAssignments[crewId];
    if (!vesselId) {
      toast({
        title: 'Error',
        description: 'Please select a vessel before assigning',
        variant: 'destructive',
      });
      return;
    }
    
    // Find crew member details
    const crewMember = signedOffCrew.find(c => c.id === crewId);
    if (!crewMember) return;
    
    // Open contract dialog
    setSelectedCrewForContract(crewMember);
    setContractDialogOpen(true);
    
    // Set default start date to today
    const today = new Date().toISOString().split('T')[0];
    setContractStartDate(today);
    const endDate = calculateEndDate(today, contractDuration);
    setContractEndDate(endDate);
  };

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
    },
  });

  // Handle contract confirmation
  const handleConfirmContract = () => {
    if (!selectedCrewForContract) return;
    
    const vesselId = vesselAssignments[selectedCrewForContract.id];
    if (!vesselId) return;
    
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
      { crewId: selectedCrewForContract.id, vesselId },
      {
        onSuccess: () => {
          // Then create the contract
          createContractMutation.mutate({
            crewId: selectedCrewForContract.id,
            vesselId,
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
        console.error('Delete failed:', response.status, errorData);
        
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
      queryClient.invalidateQueries({ queryKey: ['/api/crew/signed-off'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
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

  const handleDeleteCrew = (crewId: string) => {
    deleteCrewMutation.mutate(crewId);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ex-Hand Database</h1>
          <p className="text-muted-foreground">
            Historical tracking of signed-off crew members and vessel reassignment
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          {signedOffCrew.length} Ex-Crew Members
        </Badge>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <div className="rounded-md border overflow-visible">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Crew Member</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Last Vessel Sailed</TableHead>
                <TableHead>Sign-Off Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signedOffCrew.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No signed-off crew members found
                  </TableCell>
                </TableRow>
              ) : (
                signedOffCrew.map((member) => {
                  const vesselHistory = getVesselHistory(member.id);
                  const hasHistory = vesselHistory.length > 0;
                  
                  // If has history, show vessel-wise entries; otherwise show single entry
                  if (hasHistory) {
                    return vesselHistory.map((history: any, index: number) => (
                      <TableRow key={`${member.id}-${history.vessel.id}`}>
                        {index === 0 ? (
                          <TableCell rowSpan={vesselHistory.length}>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8 bg-maritime-navy">
                                <AvatarFallback className="text-white text-xs font-medium">
                                  {getInitials(member.firstName, member.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">{member.firstName} {member.lastName}</p>
                                <p className="text-sm text-muted-foreground">{member.nationality}</p>
                              </div>
                            </div>
                          </TableCell>
                        ) : null}
                        {index === 0 ? (
                          <TableCell rowSpan={vesselHistory.length}>
                            <Badge variant="secondary" className="text-xs">
                              {member.rank}
                            </Badge>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{history.vessel.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {history.leaveDate 
                              ? formatDate(history.leaveDate)
                              : 'N/A'
                            }
                          </span>
                        </TableCell>
                        {index === 0 ? (
                          <TableCell rowSpan={vesselHistory.length}>
                            <div className="flex items-center space-x-2">
                              <Select
                                value={vesselAssignments[member.id] || ''}
                                onValueChange={(value) => handleVesselSelect(member.id, value)}
                              >
                                <SelectTrigger className="w-40" data-testid={`select-vessel-${member.id}`}>
                                  <SelectValue placeholder="Select vessel" />
                                </SelectTrigger>
                                <SelectContent>
                                  {vessels.length === 0 ? (
                                      <div className="p-2 text-sm text-muted-foreground">No vessels available</div>
                                    ) : (
                                      vessels.map((vessel: any) => (
                                          <SelectItem key={vessel.id} value={vessel.id}>
                                            {vessel.name} ({vessel.type})
                                          </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleAssignCrew(member.id)}
                                disabled={!vesselAssignments[member.id] || assignCrewMutation.isPending}
                                data-testid={`assign-crew-${member.id}`}
                              >
                                {assignCrewMutation.isPending ? 'Assigning...' : 'Assign'}
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteCrewMutation.isPending}
                                    data-testid={`delete-crew-${member.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Crew Member</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to permanently delete {member.firstName} {member.lastName}? 
                                      This action cannot be undone and will remove all their data from the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCrew(member.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                      disabled={deleteCrewMutation.isPending}
                                    >
                                      {deleteCrewMutation.isPending ? 'Deleting...' : 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ));
                  } else {
                    // No history - show single row with last vessel or current vessel
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8 bg-maritime-navy">
                              <AvatarFallback className="text-white text-xs font-medium">
                                {getInitials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{member.firstName} {member.lastName}</p>
                              <p className="text-sm text-muted-foreground">{member.nationality}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {member.rank}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {member.lastVessel?.name || member.currentVessel?.name || 'No previous vessel'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {member.signOffDate 
                              ? formatDate(member.signOffDate)
                              : 'N/A'
                            }
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Select
                              value={vesselAssignments[member.id] || ''}
                              onValueChange={(value) => handleVesselSelect(member.id, value)}
                            >
                              <SelectTrigger className="w-40" data-testid={`select-vessel-${member.id}`}>
                                <SelectValue placeholder="Select vessel" />
                              </SelectTrigger>
                              <SelectContent>
                                {vessels.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">No vessels available</div>
                                  ) : (
                                    vessels.map((vessel: any) => (
                                        <SelectItem key={vessel.id} value={vessel.id}>
                                          {vessel.name} ({vessel.type})
                                        </SelectItem>
                                      ))
                                  )}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleAssignCrew(member.id)}
                              disabled={!vesselAssignments[member.id] || assignCrewMutation.isPending}
                              data-testid={`assign-crew-${member.id}`}
                            >
                              {assignCrewMutation.isPending ? 'Assigning...' : 'Assign'}
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={deleteCrewMutation.isPending}
                                  data-testid={`delete-crew-${member.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Crew Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to permanently delete {member.firstName} {member.lastName}? 
                                    This action cannot be undone and will remove all their data from the system.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteCrew(member.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={deleteCrewMutation.isPending}
                                  >
                                    {deleteCrewMutation.isPending ? 'Deleting...' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {signedOffCrew.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No signed-off crew members found</p>
          </div>
        ) : (
          signedOffCrew.map((member) => {
            const vesselHistory = getVesselHistory(member.id);
            const hasHistory = vesselHistory.length > 0;
            
            return (
              <div key={member.id} className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 bg-maritime-navy">
                      <AvatarFallback className="text-white text-sm font-medium">
                        {getInitials(member.firstName, member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-foreground">{member.firstName} {member.lastName}</h3>
                      <p className="text-sm text-muted-foreground">{member.nationality}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {member.rank}
                  </Badge>
                </div>
                
                {/* Vessel History */}
                {hasHistory ? (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Vessel History:</span>
                    {vesselHistory.map((history: any, index: number) => (
                      <div key={index} className="bg-muted/30 p-2 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{history.vessel.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {history.leaveDate 
                              ? formatDate(history.leaveDate)
                              : 'N/A'
                            }
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Vessel:</span>
                      <span className="text-sm font-medium">
                        {member.lastVessel?.name || member.currentVessel?.name || 'No previous vessel'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Sign-Off Date:</span>
                      <span className="text-sm">
                        {member.signOffDate 
                          ? formatDate(member.signOffDate)
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                )}

              <div className="space-y-2 pt-2 border-t">
                <Select
                  value={vesselAssignments[member.id] || ''}
                  onValueChange={(value) => handleVesselSelect(member.id, value)}
                >
                  <SelectTrigger className="w-full" data-testid={`select-vessel-mobile-${member.id}`}>
                    <SelectValue placeholder="Select vessel to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">No vessels available</div>
                      ) : (
                        vessels.map((vessel: any) => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name} ({vessel.type})
                            </SelectItem>
                          ))
                      )}
                  </SelectContent>
                </Select>
                <div className="flex space-x-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAssignCrew(member.id)}
                    disabled={!vesselAssignments[member.id] || assignCrewMutation.isPending}
                    data-testid={`assign-crew-${member.id}`}
                  >
                    {assignCrewMutation.isPending ? 'Assigning...' : 'Assign to Vessel'}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteCrewMutation.isPending}
                        data-testid={`delete-crew-mobile-${member.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Crew Member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to permanently delete {member.firstName} {member.lastName}? 
                          This action cannot be undone and will remove all their data from the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteCrew(member.id)}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deleteCrewMutation.isPending}
                        >
                          {deleteCrewMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* Contract Information Dialog */}
      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-maritime-navy">Contract Information</DialogTitle>
            <DialogDescription>
              Enter contract details for {selectedCrewForContract?.firstName} {selectedCrewForContract?.lastName}
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
            >
              {assignCrewMutation.isPending || createContractMutation.isPending ? 'Processing...' : 'Confirm & Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Search, Ship, Anchor, ArrowRightLeft, Users, Mail, Loader2 } from 'lucide-react';
import { StatusChangeHistoryWithDetails, Vessel } from '@shared/schema';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

export default function StatusHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [vesselFilter, setVesselFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendToAdditional, setSendToAdditional] = useState(false);
  const [additionalEmail, setAdditionalEmail] = useState('');

  const sendStatusHistoryEmailMutation = useMutation({
    mutationFn: async (data: { statusHistory: StatusChangeHistoryWithDetails[]; additionalEmail?: string }) => {
      const response = await apiRequest('POST', '/api/email/send-status-history', data);
      return response.json();
    },
    onSuccess: (data) => {
      setEmailDialogOpen(false);
      setAdditionalEmail('');
      setSendToAdditional(false);
      toast({
        title: "Email Sent",
        description: data.message || "Status history summary sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send status history email.",
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = () => {
    sendStatusHistoryEmailMutation.mutate({
      statusHistory: filteredHistory,
      additionalEmail: sendToAdditional ? additionalEmail : undefined,
    });
  };

  const { data: statusHistory, isLoading } = useQuery<StatusChangeHistoryWithDetails[]>({
    queryKey: ['/api/status-change-history'],
    queryFn: async () => {
      const response = await fetch('/api/status-change-history', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch status history');
      return response.json();
    },
  });

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  const getCrewMemberName = (history: StatusChangeHistoryWithDetails) => {
    if (!history.crewMember) return 'Unknown';
    const firstName = history.crewMember.firstName || '';
    const lastName = history.crewMember.lastName || '';
    return firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Unknown';
  };

  const getCrewMemberInitials = (history: StatusChangeHistoryWithDetails) => {
    if (!history.crewMember) return 'UK';
    const firstName = history.crewMember.firstName || '';
    const lastName = history.crewMember.lastName || '';
    const firstInitial = firstName.charAt(0) || '';
    const lastInitial = lastName.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'UK';
  };

  const getVesselName = (history: StatusChangeHistoryWithDetails) => {
    return history.vessel?.name || 'N/A';
  };

  const getCrewRank = (history: StatusChangeHistoryWithDetails) => {
    return history.crewMember?.rank || 'N/A';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'onBoard') {
      return (
        <Badge className="bg-compliance-green text-white">
          <Ship className="h-3 w-3 mr-1" />
          On Board
        </Badge>
      );
    }
    return (
      <Badge className="bg-maritime-navy text-white">
        <Anchor className="h-3 w-3 mr-1" />
        On Shore
      </Badge>
    );
  };

  const getReason = (history: StatusChangeHistoryWithDetails) => {
    return history.reason || 'No reason provided';
  };

  const getChangedBy = (history: StatusChangeHistoryWithDetails) => {
    return history.changedByUsername || 'System';
  };

  const filteredHistory = statusHistory?.filter(history => {
    const crewName = getCrewMemberName(history).toLowerCase();
    const vesselName = getVesselName(history).toLowerCase();
    const reason = getReason(history).toLowerCase();
    const changedBy = getChangedBy(history).toLowerCase();

    const matchesSearch = crewName.includes(searchTerm.toLowerCase()) ||
                         vesselName.includes(searchTerm.toLowerCase()) ||
                         reason.includes(searchTerm.toLowerCase()) ||
                         changedBy.includes(searchTerm.toLowerCase());

    const matchesVessel = vesselFilter === 'all' || history.vesselId === vesselFilter;

    const matchesTab = activeTab === 'all' ||
                      (activeTab === 'signed-off' && history.newStatus === 'onShore') ||
                      (activeTab === 'on-shore' && history.newStatus === 'onShore') ||
                      (activeTab === 'signed-on' && history.newStatus === 'onBoard');

    return matchesSearch && matchesVessel && matchesTab;
  }) || [];

  const signedOffCount = statusHistory?.filter(h => h.newStatus === 'onShore').length || 0;
  const signedOnCount = statusHistory?.filter(h => h.newStatus === 'onBoard').length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold maritime-navy mb-2" data-testid="status-history-title">
            Status History
          </h2>
          <p className="text-gray-600">
            Track all crew status changes including sign-on and sign-off records with reasons
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEmailDialogOpen(true)}
          className="h-8"
          data-testid="mail-status-history-button"
        >
          <Mail className="h-4 w-4 mr-2" />
          Send Mail
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="text-2xl font-bold" data-testid="total-records-count">
                  {statusHistory?.length || 0}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <History className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Signed Off (On Shore)</p>
                <p className="text-2xl font-bold text-maritime-navy" data-testid="signed-off-count">
                  {signedOffCount}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Anchor className="h-6 w-6 text-maritime-navy" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Signed On (On Board)</p>
                <p className="text-2xl font-bold text-compliance-green" data-testid="signed-on-count">
                  {signedOnCount}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Ship className="h-6 w-6 text-compliance-green" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="all" data-testid="tab-all">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            All Changes
          </TabsTrigger>
          <TabsTrigger value="signed-off" data-testid="tab-signed-off">
            <Anchor className="h-4 w-4 mr-2" />
            Signed Off
          </TabsTrigger>
          <TabsTrigger value="signed-on" data-testid="tab-signed-on">
            <Ship className="h-4 w-4 mr-2" />
            Signed On
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {activeTab === 'all' && 'All Status Changes'}
                {activeTab === 'signed-off' && 'Signed-Off Crew (On Shore)'}
                {activeTab === 'signed-on' && 'Signed-On Crew (On Board)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by crew name, vessel, reason, or changed by..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="search-input"
                  />
                </div>
                <Select value={vesselFilter} onValueChange={setVesselFilter}>
                  <SelectTrigger className="w-full md:w-[200px]" data-testid="vessel-filter">
                    <SelectValue placeholder="Filter by vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vessels</SelectItem>
                    {vessels?.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Crew Member</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No status change records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((history) => (
                        <TableRow key={history.id} className="hover:bg-gray-50" data-testid={`status-row-${history.id}`}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="bg-maritime-navy">
                                <AvatarFallback className="text-white font-medium">
                                  {getCrewMemberInitials(history)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium" data-testid="crew-name">
                                  {getCrewMemberName(history)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {getCrewRank(history)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(history.previousStatus)}
                              <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                              {getStatusBadge(history.newStatus)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-[200px] truncate" title={getReason(history)} data-testid="status-reason">
                              {getReason(history)}
                            </p>
                          </TableCell>
                          <TableCell data-testid="vessel-name">
                            {getVesselName(history)}
                          </TableCell>
                          <TableCell data-testid="changed-by">
                            {getChangedBy(history)}
                          </TableCell>
                          <TableCell data-testid="change-date">
                            {history.createdAt ? format(new Date(history.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-4">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No status change records found
                  </div>
                ) : (
                  filteredHistory.map((history) => (
                    <Card key={history.id} className="border" data-testid={`status-card-${history.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Avatar className="bg-maritime-navy">
                              <AvatarFallback className="text-white font-medium text-sm">
                                {getCrewMemberInitials(history)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{getCrewMemberName(history)}</p>
                              <p className="text-sm text-gray-500">{getCrewRank(history)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Status:</span>
                            {getStatusBadge(history.previousStatus)}
                            <ArrowRightLeft className="h-3 w-3 text-gray-400" />
                            {getStatusBadge(history.newStatus)}
                          </div>
                          <div>
                            <span className="text-gray-500">Reason:</span>
                            <p className="mt-1 text-gray-700">{getReason(history)}</p>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Vessel:</span>
                            <span>{getVesselName(history)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Changed By:</span>
                            <span>{getChangedBy(history)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Date:</span>
                            <span>{history.createdAt ? format(new Date(history.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Send Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Status History Summary
            </DialogTitle>
            <DialogDescription>
              Send the status change history summary via email. {filteredHistory.length} record(s) will be included.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="send-additional"
                checked={sendToAdditional}
                onCheckedChange={(checked) => setSendToAdditional(checked === true)}
                data-testid="checkbox-additional-email"
              />
              <Label htmlFor="send-additional" className="text-sm font-medium cursor-pointer">
                Also send to an additional email address
              </Label>
            </div>
            
            {sendToAdditional && (
              <div className="space-y-2">
                <Label htmlFor="additional-email">Additional Email Addresses</Label>
                <Input
                  id="additional-email"
                  type="text"
                  placeholder="Enter email addresses (separate with commas)"
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                  data-testid="input-additional-email"
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
                setAdditionalEmail('');
                setSendToAdditional(false);
              }}
              data-testid="button-cancel-email"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={sendStatusHistoryEmailMutation.isPending || (sendToAdditional && !additionalEmail)}
              data-testid="button-send-email"
            >
              {sendStatusHistoryEmailMutation.isPending ? (
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
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import CrewTable from '@/components/crew/crew-table';
import AddContractForm from '@/components/crew/add-contract-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function CrewManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddContractForm, setShowAddContractForm] = useState(false);

  const { data: crewStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
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

  const exportCrewList = () => {
    try {
      if (!crewMembers || crewMembers.length === 0) {
        toast({
          title: 'No Data',
          description: 'No crew members found to export',
          variant: 'destructive',
        });
        return;
      }

      const headers = [
        'Full Name',
        'Rank/Position',
        'Nationality',
        'Date of Birth',
        'Employment Status',
        'Phone Number',
        'Current Vessel Assignment',
        'Join Date'
      ];

      const rows = crewMembers.map((member: any) => {
        const currentVessel = vessels?.find((v: any) => v.id === member.currentVesselId);

        // Handle phone number with multiple possible field names and clean formatting
        let phoneNumber = 'N/A';
        if (member.phoneNumber) {
          phoneNumber = String(member.phoneNumber).replace(/^=/, '').trim();
        } else if (member.phone) {
          phoneNumber = String(member.phone).replace(/^=/, '').trim();
        } else if (member.emergencyContact?.phone) {
          phoneNumber = `Emergency: ${String(member.emergencyContact.phone).replace(/^=/, '').trim()}`;
        }

        // Ensure phone numbers don't start with = or + that could be misinterpreted by Excel
        if (phoneNumber.startsWith('=')) {
          phoneNumber = phoneNumber.substring(1);
        }
        if (phoneNumber.startsWith('+')) {
          phoneNumber = `'${phoneNumber}`; // Prefix with apostrophe to force text format in Excel
        }

        return [
          `${member.firstName} ${member.lastName}`,
          member.rank || 'N/A',
          member.nationality || 'N/A',
          member.dateOfBirth ? format(new Date(member.dateOfBirth), 'yyyy-MM-dd') : 'N/A',
          member.status || 'N/A',
          phoneNumber,
          currentVessel?.name || 'Unassigned',
          member.createdAt ? format(new Date(member.createdAt), 'yyyy-MM-dd') : 'N/A'
        ];
      });

      // Create CSV with proper formatting
      const csvRows = [];

      // Add title row
      csvRows.push('"CREW MANAGEMENT EXPORT REPORT"');
      csvRows.push(`"Generated on: ${format(new Date(), 'MMMM dd, yyyy at HH:mm')}"`);
      csvRows.push(`"Total Crew Members: ${crewMembers.length}"`);
      csvRows.push(''); // Empty row for spacing

      // Add headers
      csvRows.push(headers.map(header => `"${header}"`).join(','));

      // Add data rows with proper formatting
      rows.forEach((row: any[]) => {
        const formattedRow = row.map((cell: any) => {
          let cellValue = String(cell || '');
          // Clean any equals signs that might cause Excel formula issues
          cellValue = cellValue.replace(/^=+/, '');

          // Add padding for better readability in certain columns
          if (cellValue === 'N/A') {
            cellValue = '---';
          }

          return `"${cellValue}"`;
        });
        csvRows.push(formattedRow.join(','));
      });

      // Add summary footer
      csvRows.push(''); // Empty row
      csvRows.push('"SUMMARY STATISTICS"');
      csvRows.push(`"Active Crew Members: ${rows.filter((row: any[]) => row[4] === 'active').length}"`);
      csvRows.push(`"Crew on Leave: ${rows.filter((row: any[]) => row[4] === 'onLeave').length}"`);
      csvRows.push(`"Assigned to Vessels: ${rows.filter((row: any[]) => row[6] !== 'Unassigned').length}"`);

      const csvContent = csvRows.join('\n');

      // Add BOM for proper Excel UTF-8 handling
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `CrewTrack-Pro-Export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Export Successful',
        description: `Crew list exported with ${crewMembers.length} members`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Unable to export crew list. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (user?.role === 'crew') {
    // Redirect crew members to their profile view in dashboard
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-6">
            Crew members can view their profile information on the dashboard.
          </p>
          <Button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-maritime-navy hover:bg-blue-800"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" data-testid="crew-management-title">
            Crew Management
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage crew members, assignments, and profiles
          </p>
        </div>

        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCrewList}
            disabled={!crewMembers || crewMembers.length === 0}
            data-testid="export-crew-list"
            className="w-full sm:w-auto flex items-center justify-center"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Export List</span>
            <span className="sm:hidden">Export</span>
          </Button>

          <Button
            variant="outline"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-700 w-full sm:w-auto flex items-center justify-center"
            onClick={() => setShowAddContractForm(true)}
            data-testid="add-contract"
          >
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Contract</span>
            <span className="sm:hidden">Contract</span>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {crewStats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Crew on Shore</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="crew-on-shore-count">
                  {crewStats.crewOnShore}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Crew on Board</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-foreground" data-testid="crew-on-board-count">
                  {crewStats.activeCrew}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-2xl font-bold text-foreground" data-testid="pending-actions-count">
                  {crewStats.pendingActions}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Crew Table */}
      <Card className="flex-1">
        <CardHeader className="pb-4">
          <CardTitle className="text-foreground">Crew Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CrewTable />
        </CardContent>
      </Card>

      {/* Add Contract Form Dialog */}
      <AddContractForm
        open={showAddContractForm}
        onOpenChange={setShowAddContractForm}
      />
    </div>
  );
}

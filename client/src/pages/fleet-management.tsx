import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VesselDetailsDialog from '@/components/vessels/vessel-details-dialog';
import CrewManagementDialog from '@/components/vessels/crew-management-dialog';
import { VesselDocumentUploadModal } from '@/components/vessel-documents/vessel-document-upload-modal';
import {
  Ship,
  Activity,
  Anchor,
  Globe,
  Wrench,
  Pause,
  Download,
  Users,
  Flag,
  Hash,
  Calendar,
  FileText
} from 'lucide-react';

export default function FleetManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedVesselForDetails, setSelectedVesselForDetails] = useState<any>(null);
  const [selectedVesselForCrew, setSelectedVesselForCrew] = useState<any>(null);
  const [selectedVesselForUpload, setSelectedVesselForUpload] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch vessels data
  const { data: vessels, isLoading } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  // Fetch crew data for vessel crew counts
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

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Ship className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-6">
            Fleet management is only accessible to administrators.
          </p>
          <Button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-primary hover:bg-primary/90"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate counts for each category
  const totalVessels = vessels?.length || 0;
  const harbourMining = vessels?.filter((v: any) => v.status === 'harbour-mining').length || 0;
  const coastalMining = vessels?.filter((v: any) => v.status === 'coastal-mining').length || 0;
  const worldWide = vessels?.filter((v: any) => v.status === 'world-wide').length || 0;
  const oilField = vessels?.filter((v: any) => v.status === 'oil-field').length || 0;
  const lineUpMining = vessels?.filter((v: any) => v.status === 'line-up-mining').length || 0;

  // Filter vessels based on selected status
  const filteredVessels = statusFilter === 'all'
    ? vessels
    : vessels?.filter((v: any) => v.status === statusFilter) || [];

  const exportVesselList = () => {
    try {
      if (!vessels || vessels.length === 0) {
        toast({
          title: 'No Data',
          description: 'No vessels found to export',
          variant: 'destructive',
        });
        return;
      }

      const headers = [
        'Vessel Name',
        'Type',
        'IMO Number',
        'Flag',
        'Operational Status',
        'Crew On Board',
        'Sort Order',
        'Date Added'
      ];

      const rows = vessels.map((vessel: any) => {
        // Calculate crew count for this vessel
        const vesselCrewCount = crewMembers?.filter((member: any) =>
          member.currentVesselId === vessel.id && member.status === 'onBoard'
        ).length || 0;

        // Format status for better readability
        const formatStatus = (status: string) => {
          switch (status) {
            case 'harbour-mining': return 'Harbour Manning';
            case 'coastal-mining': return 'Coastal Manning';
            case 'world-wide': return 'World Wide';
            case 'oil-field': return 'Oil Field';
            case 'line-up-mining': return 'Laid Up';
            default: return status || 'Unknown';
          }
        };

        return [
          vessel.name || 'N/A',
          vessel.type || 'N/A',
          vessel.imoNumber || 'N/A',
          vessel.flag || 'N/A',
          formatStatus(vessel.status),
          vesselCrewCount.toString(),
          vessel.sortOrder?.toString() || '0',
          vessel.createdAt ? format(new Date(vessel.createdAt), 'yyyy-MM-dd') : 'N/A'
        ];
      });

      // Create CSV with proper formatting
      const csvRows = [];

      // Add title row
      csvRows.push('"FLEET MANAGEMENT EXPORT REPORT"');
      csvRows.push(`"Generated on: ${format(new Date(), 'MMMM dd, yyyy at HH:mm')}"`);
      csvRows.push(`"Total Vessels: ${vessels.length}"`);
      csvRows.push(`"Filter Applied: ${statusFilter === 'all' ? 'All Vessels' : statusFilter}"`);
      csvRows.push(''); // Empty row for spacing

      // Add headers
      csvRows.push(headers.map(header => `"${header}"`).join(','));

      // Add data rows with proper formatting
      rows.forEach((row: any[]) => {
        const formattedRow = row.map((cell: any) => {
          let cellValue = String(cell || '');
          // Clean any equals signs that might cause Excel formula issues
          cellValue = cellValue.replace(/^=+/, '');

          // Replace N/A with dashes for better readability
          if (cellValue === 'N/A') {
            cellValue = '---';
          }

          return `"${cellValue}"`;
        });
        csvRows.push(formattedRow.join(','));
      });

      // Add summary footer
      csvRows.push(''); // Empty row
      csvRows.push('"FLEET SUMMARY STATISTICS"');
      csvRows.push(`"Harbour Manning Vessels: ${vessels.filter((v: any) => v.status === 'harbour-mining').length}"`);
      csvRows.push(`"Coastal Manning Vessels: ${vessels.filter((v: any) => v.status === 'coastal-mining').length}"`);
      csvRows.push(`"World Wide Vessels: ${vessels.filter((v: any) => v.status === 'world-wide').length}"`);
      csvRows.push(`"Oil Field Vessels: ${vessels.filter((v: any) => v.status === 'oil-field').length}"`);
      csvRows.push(`"Laid-Up Vessels: ${vessels.filter((v: any) => v.status === 'line-up-mining').length}"`);
      csvRows.push(`"Total Crew Members Deployed: ${crewMembers?.filter((member: any) => member.status === 'onBoard').length || 0}"`);

      const csvContent = csvRows.join('\n');

      // Add BOM for proper Excel UTF-8 handling
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Fleet-Management-Export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Export Successful',
        description: `Fleet data exported with ${vessels.length} vessels`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Unable to export fleet data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="fleet-management-title">
            Fleet Management
          </h2>
          <p className="text-muted-foreground">
            Manage vessels, crew assignments, and fleet operations
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              <SelectItem value="harbour-mining">Harbour Manning</SelectItem>
              <SelectItem value="coastal-mining">Coastal Manning</SelectItem>
              <SelectItem value="world-wide">World Wide</SelectItem>
              <SelectItem value="oil-field">Oil Field</SelectItem>
              <SelectItem value="line-up-mining">Laid Up</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={exportVesselList}
            disabled={!vessels || vessels.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="export-fleet-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Fleet Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center">
              <Ship className="h-4 w-4 mr-2 text-blue-600" />
              Total Vessels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {totalVessels}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center">
              <Activity className="h-4 w-4 mr-2 text-green-600" />
              Harbour Manning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {harbourMining}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-cyan-700 flex items-center">
              <Anchor className="h-4 w-4 mr-2 text-cyan-600" />
              Coastal Manning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-900">
              {coastalMining}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center">
              <Globe className="h-4 w-4 mr-2 text-purple-600" />
              World Wide (Foreign Going)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {worldWide}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center">
              <Wrench className="h-4 w-4 mr-2 text-orange-600" />
              Oil Field
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900">
              {oilField}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center">
              <Pause className="h-4 w-4 mr-2 text-gray-600" />
              Laid-Up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {lineUpMining}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vessel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVessels?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Ship className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No vessels found</h3>
            <p className="text-gray-500">
              {statusFilter === 'all'
                ? 'No vessels have been added to the system yet.'
                : `No vessels found with status: ${statusFilter.replace('-', ' ')}`
              }
            </p>
          </div>
        ) : (
          filteredVessels?.map((vessel: any) => {
            const getStatusColor = (status: string) => {
              switch (status.toLowerCase()) {
                case 'harbour-mining':
                  return 'bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium';
                case 'coastal-mining':
                  return 'bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium';
                case 'world-wide':
                  return 'bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium';
                case 'oil-field':
                  return 'bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-medium';
                case 'line-up-mining':
                  return 'bg-gray-500 text-white px-3 py-1 rounded-full text-xs font-medium';
                default:
                  return 'bg-gray-500 text-white px-3 py-1 rounded-full text-xs font-medium';
              }
            };

            const formatStatus = (status: string) => {
              switch (status.toLowerCase()) {
                case 'harbour-mining':
                  return 'Harbour-Manning';
                case 'coastal-mining':
                  return 'Coastal-Manning';
                case 'world-wide':
                  return 'World-Wide';
                case 'oil-field':
                  return 'Oil-Field';
                case 'line-up-mining':
                  return 'Lined-Up';
                default:
                  return status;
              }
            };

            return (
              <Card key={vessel.id} className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 hover:border-blue-300">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Ship className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {vessel.name}
                      </h3>
                    </div>
                    <div className={getStatusColor(vessel.status)}>
                      {formatStatus(vessel.status)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type:</span>
                      <span className="text-gray-900 font-medium">{vessel.type}</span>
                    </div>

                    {vessel.imoNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">IMO:</span>
                        <span className="text-gray-900 font-medium">{vessel.imoNumber}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-500">Flag:</span>
                      <span className="text-gray-900 font-medium">{vessel.flag}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Crew:</span>
                      <span className="text-gray-900 font-medium">
                        {vessel.crewCount || 0} members
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Next Rotation:</span>
                      <span className="text-gray-900 font-medium">
                        {vessel.nextCrewChange ?
                          new Date(vessel.nextCrewChange).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit'
                          }) :
                          'Not scheduled'
                        }
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedVesselForDetails(vessel)}
                        data-testid={`view-vessel-${vessel.id}`}
                      >
                        <Ship className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedVesselForCrew(vessel)}
                        data-testid={`manage-crew-${vessel.id}`}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Crew
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedVesselForUpload(vessel)}
                        data-testid={`upload-document-${vessel.id}`}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }))}
      </div>

      {/* Vessel Details Dialog */}
      <VesselDetailsDialog
        vessel={selectedVesselForDetails}
        open={!!selectedVesselForDetails}
        onOpenChange={(open) => !open && setSelectedVesselForDetails(null)}
        onManageCrew={(vessel) => {
          setSelectedVesselForDetails(null);
          setSelectedVesselForCrew(vessel);
        }}
      />

      {/* Crew Management Dialog */}
      <CrewManagementDialog
        vessel={selectedVesselForCrew}
        open={!!selectedVesselForCrew}
        onOpenChange={(open) => !open && setSelectedVesselForCrew(null)}
      />

      {/* Document Upload Modal */}
      {selectedVesselForUpload && (
        <VesselDocumentUploadModal
          vesselId={selectedVesselForUpload.id}
          vesselName={selectedVesselForUpload.name}
          open={!!selectedVesselForUpload}
          onClose={() => setSelectedVesselForUpload(null)}
        />
      )}
    </div>
  );
}
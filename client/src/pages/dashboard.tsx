import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import StatsCard from '@/components/dashboard/stats-card';
import UpcomingEvents from '@/components/dashboard/upcoming-events';
import CrewTable from '@/components/crew/crew-table';
import VesselCards from '@/components/vessels/vessel-cards';
import DashboardNotifications from '@/components/dashboard/dashboard-notifications';
import MissingDocumentsNotifications from '@/components/documents/missing-documents-notifications';
import ExpiringDocumentsWidget from '@/components/dashboard/expiring-documents-widget';
import AddContractForm from '@/components/crew/add-contract-form';
import AttendanceUploadDialog from '@/components/crew/attendance-upload-dialog';
import ChatWidget from '@/components/dashboard/chat-widget';
import SignOffDueModal from '@/components/dashboard/sign-off-due-modal';
import ContractExpiryTimelineModal from '@/components/dashboard/contract-expiry-timeline-modal';
import InteractiveHealthCard, { HealthDataPoint } from '@/components/dashboard/interactive-health-card';
import HealthDrillDownModal from '@/components/dashboard/health-drill-down-modal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FileText, Download, Calendar, Plus, ExternalLink, ClipboardList } from 'lucide-react';
import { DashboardStats } from '@/types';
import MinimalHealthRow from '@/components/dashboard/minimal-health-row';
import { useMemo, memo } from 'react';

// Memoized helper components to stabilize data references and prevent chart jitter
const MemoizedContractHealth = memo(({ stats, statsLoading, onDrillDown }: { stats: DashboardStats, statsLoading: boolean, onDrillDown: any }) => {
  const data = useMemo(() => [
    { key: 'overdue', name: 'Overdue', value: stats.contractHealth.overdue, color: '#475569' },
    { key: 'critical', name: 'Critical (<= 15 Days)', value: stats.contractHealth.critical, color: '#ef4444' },
    { key: 'upcoming', name: 'Upcoming (16-30 Days)', value: stats.contractHealth.upcoming, color: '#f97316' },
    { key: 'soon', name: 'Attention (31-45 Days)', value: stats.contractHealth.soon, color: '#eab308' },
    { key: 'shored', name: 'Signed Off Crew', value: stats.contractHealth.shored, color: '#3b82f6' },
    { key: 'stable', name: 'Not Due', value: stats.contractHealth.stable, color: '#10b981' },
  ], [
    stats.contractHealth.overdue,
    stats.contractHealth.critical,
    stats.contractHealth.upcoming,
    stats.contractHealth.soon,
    stats.contractHealth.shored,
    stats.contractHealth.stable
  ]);

  return (
    <InteractiveHealthCard
      title="Contract Health Index"
      description=""
      total={stats.contractHealth.total}
      totalLabel="CREW RECORDS"
      isLoading={statsLoading}
      onSegmentClick={(key, name) => onDrillDown('contract', key, name)}
      data={data}
    />
  );
});

const MemoizedCertificateHealth = memo(({ stats, statsLoading, onDrillDown }: { stats: DashboardStats, statsLoading: boolean, onDrillDown: any }) => {
  const data = useMemo(() => [
    { key: 'expired', name: 'Expired Documents', value: stats.documentHealth.expired, color: '#ef4444' },
    { key: 'critical', name: 'Critical Expiry (< 30d)', value: stats.documentHealth.critical, color: '#f97316' },
    { key: 'warning', name: 'Warning (< 90d)', value: stats.documentHealth.warning, color: '#eab308' },
    { key: 'attention', name: 'Attention (< 180d)', value: stats.documentHealth.attention, color: '#3b82f6' },
    { key: 'valid', name: 'Valid / Permanent', value: stats.documentHealth.valid, color: '#10b981' },
  ], [
    stats.documentHealth.expired,
    stats.documentHealth.critical,
    stats.documentHealth.warning,
    stats.documentHealth.attention,
    stats.documentHealth.valid
  ]);

  return (
    <InteractiveHealthCard
      title="Certificate Compliance Index"
      description="Real-time validity status of mandatory documents"
      total={stats.documentHealth.total}
      totalLabel="CERTIFICATES"
      isLoading={statsLoading}
      onSegmentClick={(key, name) => onDrillDown('document', key, name)}
      data={data}
    />
  );
});

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddContractForm, setShowAddContractForm] = useState(false);
  const [showSignOffDueModal, setShowSignOffDueModal] = useState(false);
  const [showExpiryTimelineModal, setShowExpiryTimelineModal] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);

  // Drill-down states
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState({ key: '', name: '' });
  const [drillDownType, setDrillDownType] = useState<'contract' | 'document'>('document');

  const handleDrillDown = (type: 'contract' | 'document', key: string, name: string) => {
    setDrillDownType(type);
    setDrillDownCategory({ key, name });
    setDrillDownOpen(true);
  };


  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: expiringDocuments, isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/alerts/expiring-documents', { days: 90 }],
    queryFn: async () => {
      const response = await fetch('/api/alerts/expiring-documents?days=90', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch crew data for export
  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch vessels data for export
  const { data: vessels } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch contracts data for export
  const { data: contracts } = useQuery({
    queryKey: ['/api/contracts'],
    queryFn: async () => {
      const response = await fetch('/api/contracts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch contracts');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch documents data for export
  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch rotations data for export
  const { data: rotations } = useQuery({
    queryKey: ['/api/rotations'],
    queryFn: async () => {
      const response = await fetch('/api/rotations', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch rotations');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const exportCrewByVessel = async () => {
    try {
      const XLSX = await import('xlsx');
      if (!crewMembers || crewMembers.length === 0) {
        toast({
          title: 'No Data',
          description: 'No crew members found to export',
          variant: 'destructive',
        });
        return;
      }

      if (!vessels || vessels.length === 0) {
        toast({
          title: 'No Data',
          description: 'No vessels found to export',
          variant: 'destructive',
        });
        return;
      }

      // Group crew by vessel
      const vesselGroups: { [key: string]: any[] } = {};
      const unassignedCrew: any[] = [];

      // Initialize vessel groups
      vessels.forEach((vessel: any) => {
        vesselGroups[vessel.id] = [];
      });

      // Group crew members by their current vessel
      crewMembers.forEach((member: any) => {
        if (member.currentVesselId && vesselGroups[member.currentVesselId]) {
          vesselGroups[member.currentVesselId].push(member);
        } else {
          unassignedCrew.push(member);
        }
      });

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Helper function to get document number by type for a crew member
      const getDocumentDetails = (crewMemberId: string, docType: string) => {
        if (!documents) return { no: '---', expiry: '---' };
        const doc = documents.find((d: any) => d.crewMemberId === crewMemberId && d.type?.toLowerCase() === docType.toLowerCase());
        return {
          no: doc?.documentNumber || '---',
          expiry: doc?.expiryDate ? format(new Date(doc.expiryDate), 'yyyy-MM-dd') : '---'
        };
      };

      // Helper function to process crew member data
      const processCrewMember = (member: any) => {
        // Get active contract for this crew member
        const activeContract = member.activeContract;
        let contractNo = activeContract?.contractNumber || '---';
        let contractType = activeContract?.contractType || '---';
        let contractEndDate = '---';
        let daysToContractEnd = '---';

        if (activeContract?.endDate) {
          contractEndDate = format(new Date(activeContract.endDate), 'yyyy-MM-dd');
          const today = new Date();
          const endDate = new Date(activeContract.endDate);
          const diffTime = endDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          daysToContractEnd = diffDays.toString();
        }

        // Handle phone number formatting
        let phoneNumber = '---';
        if (member.phoneNumber) {
          phoneNumber = String(member.phoneNumber).replace(/^=/, '').trim();
        }

        // Format Next of Kin (emergency contact)
        let nextOfKin = '---';
        if (member.emergencyContact?.name) {
          const relationship = member.emergencyContact.relationship ? ` (${member.emergencyContact.relationship})` : '';
          const phone = member.emergencyContact.phone ? ` - ${member.emergencyContact.phone}` : '';
          nextOfKin = `${member.emergencyContact.name}${relationship}${phone}`;
        }

        // Get document details
        const passport = getDocumentDetails(member.id, 'passport');
        const cdc = getDocumentDetails(member.id, 'cdc');
        const coc = getDocumentDetails(member.id, 'coc');
        const medical = getDocumentDetails(member.id, 'medical');

        return {
          'Full Name': `${member.firstName} ${member.lastName}`,
          'Rank/Position': member.rank || '---',
          'Nationality': member.nationality || '---',
          'Date of Birth': member.dateOfBirth ? format(new Date(member.dateOfBirth), 'yyyy-MM-dd') : '---',
          'Phone Number': phoneNumber,
          'Email': member.email || '---',
          'Passport No': passport.no,
          'Passport Expiry': passport.expiry,
          'CDC No': cdc.no,
          'CDC Expiry': cdc.expiry,
          'COC No': coc.no,
          'COC Expiry': coc.expiry,
          'Medical Cert No': medical.no,
          'Medical Expiry': medical.expiry,
          'Next of Kin': nextOfKin,
          'Employment Status': member.status === 'onBoard' ? 'ON BOARD' : 'ON SHORE',
          'Contract No': contractNo,
          'Contract Type': contractType,
          'Contract End Date': contractEndDate,
          'Days Remaining': daysToContractEnd
        };
      };

      // Create a sheet for each vessel
      vessels.forEach((vessel: any) => {
        const vesselCrew = vesselGroups[vessel.id] || [];

        // Prepare worksheet data
        const worksheetData: any[] = [];

        // Header info
        worksheetData.push({ 'Full Name': 'SEA CREW MANAGER - FLEET EXPORT', 'Rank/Position': '', 'Nationality': '', 'Date of Birth': '' });
        worksheetData.push({ 'Full Name': `VESSEL: ${vessel.name}`, 'Rank/Position': `IMO: ${vessel.imoNumber || '---'}`, 'Nationality': `Flag: ${vessel.flag || '---'}`, 'Date of Birth': `Type: ${vessel.type || '---'}` });
        worksheetData.push({ 'Full Name': '', 'Rank/Position': '', 'Nationality': '', 'Date of Birth': '' }); // Empty row

        if (vesselCrew.length === 0) {
          worksheetData.push({ 'Full Name': 'No crew members currently assigned to this vessel' });
        } else {
          // Add crew data
          vesselCrew.forEach((member: any) => {
            worksheetData.push(processCrewMember(member));
          });

          // Add vessel summary
          worksheetData.push({ 'Full Name': '' });
          worksheetData.push({
            'Full Name': `SUMMARY FOR ${vessel.name}`,
            'Rank/Position': `Total Crew: ${vesselCrew.length}`,
            'Nationality': `On Board: ${vesselCrew.filter((crew: any) => crew.status === 'onBoard').length}`,
            'Date of Birth': `On Shore: ${vesselCrew.filter((crew: any) => crew.status === 'onShore').length}`,
          });
        }

        // Create worksheet for this vessel
        const worksheet = XLSX.utils.json_to_sheet(worksheetData, {
          header: [
            'Full Name', 'Rank/Position', 'Nationality', 'Date of Birth',
            'Phone Number', 'Email', 'Passport No', 'Passport Expiry',
            'CDC No', 'CDC Expiry', 'COC No', 'COC Expiry',
            'Medical Cert No', 'Medical Expiry', 'Next of Kin',
            'Employment Status', 'Contract No', 'Contract Type',
            'Contract End Date', 'Days Remaining'
          ]
        });

        // Set column widths
        const colWidths = [
          { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
          { wch: 18 }, { wch: 25 }, { wch: 18 }, { wch: 15 },
          { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
          { wch: 18 }, { wch: 15 }, { wch: 35 },
          { wch: 18 }, { wch: 18 }, { wch: 15 },
          { wch: 18 }, { wch: 15 }
        ];
        worksheet['!cols'] = colWidths;

        // Use vessel name as sheet name (sanitize for Excel)
        const sheetName = vessel.name.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      // Add unassigned crew sheet if any
      if (unassignedCrew.length > 0) {
        const unassignedData = unassignedCrew.map(m => processCrewMember(m));
        const unassignedWorksheet = XLSX.utils.json_to_sheet(unassignedData);
        XLSX.utils.book_append_sheet(workbook, unassignedWorksheet, 'Unassigned Crew');
      }

      // Add All Contracts Sheet
      if (contracts && contracts.length > 0) {
        const contractsData = contracts.map((contract: any) => {
          const crewMember = crewMembers.find((c: any) => c.id === contract.crewMemberId);
          const vessel = vessels.find((v: any) => v.id === contract.vesselId);
          return {
            'Crew Member': crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : '---',
            'Vessel': vessel?.name || '---',
            'Contract No': contract.contractNumber || '---',
            'Type': contract.contractType || '---',
            'Start Date': contract.startDate ? format(new Date(contract.startDate), 'yyyy-MM-dd') : '---',
            'End Date': contract.endDate ? format(new Date(contract.endDate), 'yyyy-MM-dd') : '---',
            'Salary': `${contract.salary || '0'} ${contract.currency || 'USD'}`,
            'Status': contract.status?.toUpperCase() || '---',
          };
        });
        const contractsWorksheet = XLSX.utils.json_to_sheet(contractsData);
        XLSX.utils.book_append_sheet(workbook, contractsWorksheet, 'All Contracts History');
      }

      // Add Summary sheet at the beginning
      const summaryData = [
        { Field: 'SEA CREW MANAGER - COMPLETE FLEET REPORT', Value: '' },
        { Field: 'Date Generated', Value: format(new Date(), 'MMMM dd, yyyy HH:mm') },
        { Field: '', Value: '' },
        { Field: 'FLEET STATISTICS', Value: '' },
        { Field: 'Total Crew Records', Value: crewMembers.length },
        { Field: 'Total Active Vessels', Value: vessels.length },
        { Field: 'Total Contract Records', Value: contracts?.length || 0 },
        { Field: 'Total Documents Uploaded', Value: documents?.length || 0 },
        { Field: '', Value: '' },
        { Field: 'CREW STATUS BREAKDOWN', Value: '' },
        { Field: 'On Board', Value: crewMembers.filter((m: any) => m.status === 'onBoard').length },
        { Field: 'On Shore', Value: crewMembers.filter((m: any) => m.status === 'onShore').length },
        { Field: '', Value: '' },
        { Field: 'VESSEL ASSIGNMENTS', Value: '' }
      ];

      vessels.forEach((v: any) => {
        const count = (vesselGroups[v.id] || []).length;
        summaryData.push({ Field: v.name, Value: `${count} Crew Members` });
      });

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      summaryWorksheet['!cols'] = [{ wch: 35 }, { wch: 45 }];

      const finalWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(finalWorkbook, summaryWorksheet, 'Dashboard Summary');

      // Copy other sheets
      workbook.SheetNames.forEach(name => {
        XLSX.utils.book_append_sheet(finalWorkbook, workbook.Sheets[name], name);
      });

      // Generate Excel file
      const excelBuffer = XLSX.write(finalWorkbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `SeaCrewManager_FullExport_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Report Generated',
        description: 'The professional fleet export has been downloaded successfully.',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to generate the professional report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-28 sm:h-32 lg:h-36 bg-muted rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header - Tighter & Smaller */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          Fleet Dashboard
        </h2>
        <p className="text-xs text-secondary-foreground opacity-80">
          {user?.role === 'admin' ? 'Overview of your maritime operations and crew status' :
            'Manage crew data entry and monitor document compliance'}
        </p>
      </div>

      {/* Minimal Health Index Summary - Text Only */}
      {stats && (
        <MinimalHealthRow
          stats={stats}
          className="mb-4"
          onSearchClick={() => handleDrillDown('contract', 'global-search', 'Global Crew Search')}
          onDownloadClick={exportCrewByVessel}
        />
      )}

      {/* Interactive Health Sections - Vertical Stack */}
      {stats && (
        <div className="space-y-6 mb-8">
          {/* Contract Health Section */}
          <MemoizedContractHealth stats={stats} statsLoading={statsLoading} onDrillDown={handleDrillDown} />

          {/* Certificate Health Section */}
          <MemoizedCertificateHealth stats={stats} statsLoading={statsLoading} onDrillDown={handleDrillDown} />
        </div>
      )}

      {/* Vessel Overview Section */}
      {(user?.role === 'admin' || user?.role === 'office_staff') && (
        <div className="mb-8">
          <div className="bg-card border border-border rounded-xl shadow-sm">
            <div className="p-6">
              <VesselCards showUploadButton={false} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="bg-card rounded-xl shadow-sm border border-border h-full min-h-[800px]">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Crew Overview
                </h3>
                {(user?.role === 'admin' || user?.role === 'office_staff') && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-700"
                      size="sm"
                      onClick={() => setShowAddContractForm(true)}
                      data-testid="add-contract-button"
                    >
                      Add Contract
                    </Button>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      size="sm"
                      onClick={() => setShowAttendanceDialog(true)}
                      data-testid="upload-attendance-button"
                    >
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Attendance Sheet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportCrewByVessel}
                      disabled={!crewMembers || crewMembers.length === 0}
                      data-testid="export-crew-button"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 flex-1">
              <CrewTable />
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <UpcomingEvents />
          <ExpiringDocumentsWidget />
          {crewMembers && documents && (
            <MissingDocumentsNotifications
              crewMembers={crewMembers}
              documents={documents}
              onUploadSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
              }}
            />
          )}
          <DashboardNotifications />
        </div>
      </div>

      <AddContractForm
        open={showAddContractForm}
        onOpenChange={setShowAddContractForm}
      />

      <AttendanceUploadDialog
        open={showAttendanceDialog}
        onOpenChange={setShowAttendanceDialog}
      />

      <SignOffDueModal
        isOpen={showSignOffDueModal}
        onClose={() => setShowSignOffDueModal(false)}
      />

      <ContractExpiryTimelineModal
        isOpen={showExpiryTimelineModal}
        onClose={() => setShowExpiryTimelineModal(false)}
      />

      {/* Drill-down Detail Modal */}
      <HealthDrillDownModal
        isOpen={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        type={drillDownType}
        categoryKey={drillDownCategory.key}
        categoryName={drillDownCategory.name}
      />
    </div>
  );
}

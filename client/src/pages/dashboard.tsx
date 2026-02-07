import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import StatsCard from '@/components/dashboard/stats-card';
import UpcomingEvents from '@/components/dashboard/upcoming-events';
import CrewTable from '@/components/crew/crew-table';
import VesselCards from '@/components/vessels/vessel-cards';
import DashboardNotifications from '@/components/dashboard/dashboard-notifications';
import MissingDocumentsNotifications from '@/components/documents/missing-documents-notifications';
import ExpiringDocumentsWidget from '@/components/dashboard/expiring-documents-widget';
import AddContractForm from '@/components/crew/add-contract-form';
import ChatWidget from '@/components/dashboard/chat-widget';
import SignOffDueModal from '@/components/dashboard/sign-off-due-modal';
import ContractExpiryTimelineModal from '@/components/dashboard/contract-expiry-timeline-modal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FileText, Download, Calendar, Plus } from 'lucide-react';
import { DashboardStats } from '@/types';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddContractForm, setShowAddContractForm] = useState(false);
  const [showSignOffDueModal, setShowSignOffDueModal] = useState(false);
  const [showExpiryTimelineModal, setShowExpiryTimelineModal] = useState(false);


  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const exportCrewByVessel = () => {
    try {
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
      const getDocumentNumber = (crewMemberId: string, docType: string) => {
        if (!documents) return '---';
        const doc = documents.find((d: any) => d.crewMemberId === crewMemberId && d.type?.toLowerCase() === docType.toLowerCase());
        return doc?.documentNumber || '---';
      };

      // Helper function to process crew member data
      const processCrewMember = (member: any) => {
        // Get active contract for this crew member
        const activeContract = member.activeContract;
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

        // Handle phone number with multiple possible field names and clean formatting
        let phoneNumber = '---';
        if (member.phoneNumber) {
          phoneNumber = String(member.phoneNumber).replace(/^=/, '').trim();
        } else if (member.phone) {
          phoneNumber = String(member.phone).replace(/^=/, '').trim();
        }

        // Format Next of Kin (emergency contact)
        let nextOfKin = '---';
        if (member.emergencyContact?.name) {
          const relationship = member.emergencyContact.relationship ? ` (${member.emergencyContact.relationship})` : '';
          const phone = member.emergencyContact.phone ? ` - ${member.emergencyContact.phone}` : '';
          nextOfKin = `${member.emergencyContact.name}${relationship}${phone}`;
        }

        // Get document numbers
        const passportNo = getDocumentNumber(member.id, 'passport');
        const cdcNo = getDocumentNumber(member.id, 'cdc');
        const cocNo = getDocumentNumber(member.id, 'coc');
        const medicalCertNo = getDocumentNumber(member.id, 'medical');

        return {
          'Full Name': `${member.firstName} ${member.lastName}`,
          'Rank/Position': member.rank || '---',
          'Nationality': member.nationality || '---',
          'Date of Birth': member.dateOfBirth ? format(new Date(member.dateOfBirth), 'yyyy-MM-dd') : '---',
          'Phone Number': phoneNumber,
          'Email': member.email || '---',
          'Passport No': passportNo,
          'CDC No': cdcNo,
          'COC No': cocNo,
          'Medical Cert No': medicalCertNo,
          'Next of Kin': nextOfKin,
          'Employment Status': member.status || '---',
          'Join Date': member.createdAt ? format(new Date(member.createdAt), 'yyyy-MM-dd') : '---',
          'Contract End Date': contractEndDate,
          'Days to Contract End': daysToContractEnd
        };
      };

      // Create a sheet for each vessel
      vessels.forEach((vessel: any) => {
        const vesselCrew = vesselGroups[vessel.id] || [];

        // Prepare worksheet data
        const worksheetData: any[] = [];

        // Create empty row template with all columns
        const emptyRow = {
          'Full Name': '', 'Rank/Position': '', 'Nationality': '', 'Date of Birth': '',
          'Phone Number': '', 'Email': '', 'Passport No': '', 'CDC No': '', 'COC No': '',
          'Medical Cert No': '', 'Next of Kin': '', 'Employment Status': '', 'Join Date': '',
          'Contract End Date': '', 'Days to Contract End': ''
        };

        // Add vessel information header
        worksheetData.push({
          ...emptyRow,
          'Full Name': `VESSEL: ${vessel.name}`,
        });

        worksheetData.push({
          ...emptyRow,
          'Full Name': `Type: ${vessel.type || '---'}`,
          'Rank/Position': `IMO: ${vessel.imoNumber || '---'}`,
          'Nationality': `Flag: ${vessel.flag || '---'}`,
          'Date of Birth': `Status: ${vessel.status || '---'}`,
          'Phone Number': `Crew On Board: ${vesselCrew.filter((crew: any) => crew.status === 'onBoard').length}`,
        });

        // Add empty row
        worksheetData.push({ ...emptyRow });

        if (vesselCrew.length === 0) {
          worksheetData.push({
            ...emptyRow,
            'Full Name': 'No crew members assigned to this vessel',
          });
        } else {
          // Add crew data
          vesselCrew.forEach((member: any) => {
            worksheetData.push(processCrewMember(member));
          });

          // Add vessel summary
          worksheetData.push({ ...emptyRow });

          worksheetData.push({
            ...emptyRow,
            'Full Name': `VESSEL SUMMARY`,
            'Rank/Position': `Total: ${vesselCrew.length}`,
            'Nationality': `On Board: ${vesselCrew.filter((crew: any) => crew.status === 'onBoard').length}`,
            'Date of Birth': `On Shore: ${vesselCrew.filter((crew: any) => crew.status === 'onShore').length}`,
          });
        }

        // Create worksheet for this vessel
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);

        // Set column widths for better readability (15 columns now)
        const colWidths = [
          { wch: 22 }, // Full Name
          { wch: 18 }, // Rank/Position
          { wch: 12 }, // Nationality
          { wch: 12 }, // Date of Birth
          { wch: 15 }, // Phone Number
          { wch: 22 }, // Email
          { wch: 15 }, // Passport No
          { wch: 15 }, // CDC No
          { wch: 15 }, // COC No
          { wch: 15 }, // Medical Cert No
          { wch: 30 }, // Next of Kin
          { wch: 15 }, // Employment Status
          { wch: 12 }, // Join Date
          { wch: 15 }, // Contract End Date
          { wch: 18 }  // Days to Contract End
        ];
        worksheet['!cols'] = colWidths;

        // Use vessel name as sheet name (sanitize for Excel)
        const sheetName = vessel.name.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      // Add unassigned crew sheet if any
      if (unassignedCrew.length > 0) {
        const unassignedData: any[] = [];

        // Empty row template for unassigned sheet
        const unassignedEmptyRow = {
          'Full Name': '', 'Rank/Position': '', 'Nationality': '', 'Date of Birth': '',
          'Phone Number': '', 'Email': '', 'Passport No': '', 'CDC No': '', 'COC No': '',
          'Medical Cert No': '', 'Next of Kin': '', 'Employment Status': '', 'Join Date': '',
          'Contract End Date': '', 'Days to Contract End': ''
        };

        // Add header
        unassignedData.push({
          ...unassignedEmptyRow,
          'Full Name': 'UNASSIGNED CREW MEMBERS',
        });

        unassignedData.push({
          ...unassignedEmptyRow,
          'Full Name': `Total: ${unassignedCrew.length}`,
        });

        // Add empty row
        unassignedData.push({ ...unassignedEmptyRow });

        // Add unassigned crew data
        unassignedCrew.forEach((member: any) => {
          unassignedData.push(processCrewMember(member));
        });

        const unassignedWorksheet = XLSX.utils.json_to_sheet(unassignedData);
        const unassignedColWidths = [
          { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
          { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
          { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }
        ];
        unassignedWorksheet['!cols'] = unassignedColWidths;
        XLSX.utils.book_append_sheet(workbook, unassignedWorksheet, 'Unassigned Crew');
      }

      // Add Contracts Sheet
      if (contracts && contracts.length > 0) {
        const contractsData = contracts.map((contract: any) => {
          const crewMember = crewMembers.find((c: any) => c.id === contract.crewMemberId);
          const vessel = vessels.find((v: any) => v.id === contract.vesselId);
          return {
            'Crew Member': crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : '---',
            'Vessel': vessel?.name || '---',
            'Start Date': contract.startDate ? format(new Date(contract.startDate), 'yyyy-MM-dd') : '---',
            'End Date': contract.endDate ? format(new Date(contract.endDate), 'yyyy-MM-dd') : '---',
            'Duration (Days)': contract.durationDays || '---',
            'Salary': contract.salary || '---',
            'Currency': contract.currency || 'USD',
            'Status': contract.status || '---',
          };
        });
        const contractsWorksheet = XLSX.utils.json_to_sheet(contractsData);
        contractsWorksheet['!cols'] = [
          { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(workbook, contractsWorksheet, 'All Contracts');
      }

      // Add Documents Sheet
      if (documents && documents.length > 0) {
        const documentsData = documents.map((doc: any) => {
          const crewMember = crewMembers.find((c: any) => c.id === doc.crewMemberId);
          return {
            'Crew Member': crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : '---',
            'Document Type': doc.type || '---',
            'Document Number': doc.documentNumber || '---',
            'Issue Date': doc.issueDate ? format(new Date(doc.issueDate), 'yyyy-MM-dd') : '---',
            'Expiry Date': doc.expiryDate ? format(new Date(doc.expiryDate), 'yyyy-MM-dd') : '---',
            'Issuing Authority': doc.issuingAuthority || '---',
            'Status': doc.status || '---',
          };
        });
        const documentsWorksheet = XLSX.utils.json_to_sheet(documentsData);
        documentsWorksheet['!cols'] = [
          { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(workbook, documentsWorksheet, 'All Documents');
      }

      // Add Crew Rotations Sheet
      if (rotations && rotations.length > 0) {
        const rotationsData = rotations.map((rotation: any) => {
          const crewMember = crewMembers.find((c: any) => c.id === rotation.crewMemberId);
          const vessel = vessels.find((v: any) => v.id === rotation.vesselId);
          return {
            'Crew Member': crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : '---',
            'Vessel': vessel?.name || '---',
            'Join Date': rotation.joinDate ? format(new Date(rotation.joinDate), 'yyyy-MM-dd') : '---',
            'Leave Date': rotation.leaveDate ? format(new Date(rotation.leaveDate), 'yyyy-MM-dd') : '---',
            'Rotation Type': rotation.rotationType || '---',
            'Status': rotation.status || '---',
            'Notes': rotation.notes || '---',
          };
        });
        const rotationsWorksheet = XLSX.utils.json_to_sheet(rotationsData);
        rotationsWorksheet['!cols'] = [
          { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }
        ];
        XLSX.utils.book_append_sheet(workbook, rotationsWorksheet, 'Crew Rotations');
      }

      // Add Vessels Details Sheet
      if (vessels && vessels.length > 0) {
        const vesselsData = vessels.map((vessel: any) => {
          const vesselCrew = vesselGroups[vessel.id] || [];
          return {
            'Vessel Name': vessel.name || '---',
            'Type': vessel.type || '---',
            'IMO Number': vessel.imoNumber || '---',
            'Flag': vessel.flag || '---',
            'Status': vessel.status || '---',
            'Total Crew': vesselCrew.length,
            'Crew On Board': vesselCrew.filter((c: any) => c.status === 'onBoard').length,
            'Crew On Shore': vesselCrew.filter((c: any) => c.status === 'onShore').length,
          };
        });
        const vesselsWorksheet = XLSX.utils.json_to_sheet(vesselsData);
        vesselsWorksheet['!cols'] = [
          { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, vesselsWorksheet, 'Vessel Details');
      }

      // Create summary sheet
      const summaryData = [
        { Field: 'COMPREHENSIVE DATA EXPORT REPORT', Value: '' },
        { Field: 'Generated on', Value: format(new Date(), 'MMMM dd, yyyy at HH:mm') },
        { Field: '', Value: '' },
        { Field: 'FLEET SUMMARY STATISTICS', Value: '' },
        { Field: 'Total Crew Members', Value: crewMembers.length },
        { Field: 'Total Vessels', Value: vessels.length },
        { Field: 'Total Contracts', Value: contracts?.length || 0 },
        { Field: 'Total Documents', Value: documents?.length || 0 },
        { Field: 'Total Rotations', Value: rotations?.length || 0 },
        { Field: 'Crew On Board', Value: crewMembers.filter((member: any) => member.status === 'onBoard').length },
        { Field: 'Crew On Shore', Value: crewMembers.filter((member: any) => member.status === 'onShore').length },
        { Field: 'Unassigned Crew', Value: unassignedCrew.length },
        { Field: '', Value: '' },
        { Field: 'VESSEL BREAKDOWN', Value: '' }
      ];

      // Add vessel breakdown
      vessels.forEach((vessel: any) => {
        const vesselCrew = vesselGroups[vessel.id] || [];
        summaryData.push({
          Field: vessel.name,
          Value: `${vesselCrew.length} crew (${vesselCrew.filter((crew: any) => crew.status === 'onBoard').length} on board)`
        });
      });

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      summaryWorksheet['!cols'] = [{ wch: 30 }, { wch: 40 }];

      // Insert summary sheet at the beginning by appending it first
      const tempWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(tempWorkbook, summaryWorksheet, 'Summary');

      // Copy all vessel sheets to the new workbook
      workbook.SheetNames.forEach(sheetName => {
        XLSX.utils.book_append_sheet(tempWorkbook, workbook.Sheets[sheetName], sheetName);
      });

      // Replace the workbook with the reordered one
      Object.assign(workbook, tempWorkbook);

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Crew-Management-Complete-Export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Export Successful',
        description: `Complete data exported: ${crewMembers.length} crew, ${vessels.length} vessels, ${contracts?.length || 0} contracts, ${documents?.length || 0} documents`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to export crew data. Please try again.',
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
      {/* Dashboard Header */}
      <div className="mb-3 sm:mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" data-testid="dashboard-title">
          {user?.role === 'admin' ? 'Fleet Dashboard' : 'Operations Dashboard'}
        </h2>
        <p className="text-sm sm:text-base text-secondary-foreground">
          {user?.role === 'admin' ? 'Overview of your maritime operations and crew status' :
            'Manage crew data entry and monitor document compliance'}
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 mb-6 sm:mb-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.5 }}>
            <StatsCard
              title="Crew On Board"
              value={stats.activeCrew}
              icon="users"
              trend={{ value: 5.2, isPositive: true }}
              color="ocean-blue"
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.5 }}>
            <StatsCard
              title="Crew On Shore"
              value={stats.crewOnShore}
              icon="user-check"
              description="Available crew members"
              color="compliance-green"
            />
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5 }}
            onClick={() => setShowSignOffDueModal(true)}
            className="cursor-pointer"
          >
            <StatsCard
              title="Sign Off Due"
              value={stats.signOffDue}
              icon="clock"
              description="Contracts expiring within 45 days"
              color="contract-purple"
            />
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5 }}
            onClick={() => setShowExpiryTimelineModal(true)}
            className="cursor-pointer"
          >
            <StatsCard
              title="Sign Off Due in 30 Days & 15 Days"
              value={stats.signOffDue30Days}
              icon="alert-circle"
              description="Contracts expiring within 30 Days & 15 Days"
              color="expiry-red"
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.5 }}>
            <StatsCard
              title="Managed Vessel"
              value={stats.activeVessels}
              icon="ship"
              description="All vessels operational"
              color="maritime-navy"
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.5 }}>
            <StatsCard
              title="Crew Document Status"
              value={stats.pendingActions}
              icon="clock"
              description="Document renewals & approvals"
              color="warning-amber"
            />
          </motion.div>
        </motion.div>
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
        {/* Crew Overview - Expanded to take more space */}
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
                      <FileText className="h-4 w-4 mr-2" />
                      Add Contract
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

      {/* Add Contract Form Dialog */}
      <AddContractForm
        open={showAddContractForm}
        onOpenChange={setShowAddContractForm}
      />

      {/* Sign Off Due Modal */}
      <SignOffDueModal
        isOpen={showSignOffDueModal}
        onClose={() => setShowSignOffDueModal(false)}
      />

      {/* Contract Expiry Timeline Modal */}
      <ContractExpiryTimelineModal
        isOpen={showExpiryTimelineModal}
        onClose={() => setShowExpiryTimelineModal(false)}
      />
    </div>
  );
}


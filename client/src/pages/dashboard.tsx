import { useState, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { useVesselScope } from '@/hooks/use-vessel-scope';
import { downloadFileFromResponse } from '@/lib/file-utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import StatsCard from '@/components/dashboard/stats-card';
const VesselCards = memo(lazy(() => import('@/components/vessels/vessel-cards')));
import SignOffDueModal from '@/components/dashboard/sign-off-due-modal';
import WeeklyReportModal from '@/components/dashboard/weekly-report-modal';
import ContractExpiryTimelineModal from '@/components/dashboard/contract-expiry-timeline-modal';
import InteractiveHealthCard, { HealthDataPoint } from '@/components/dashboard/interactive-health-card';
import HealthDrillDownModal from '@/components/dashboard/health-drill-down-modal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FileText, Download, Calendar, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { DashboardStats } from '@/types';
import MinimalHealthRow from '@/components/dashboard/minimal-health-row';

// Memoized helper components to stabilize data references and prevent chart jitter
const MemoizedContractHealth = memo(({ stats, statsLoading, onDrillDown }: { stats: DashboardStats, statsLoading: boolean, onDrillDown: any }) => {
  const data = useMemo(() => [
    { key: 'overdue', name: 'Overdue', value: stats.contractHealth.overdue, color: '#ef4444' },
    { key: 'critical', name: 'Critical (<= 15 Days)', value: stats.contractHealth.critical, color: '#f97316' },
    { key: 'upcoming', name: 'Upcoming (16-30 Days)', value: stats.contractHealth.upcoming, color: '#eab308' },
    { key: 'soon', name: 'Attention (31-45 Days)', value: stats.contractHealth.soon, color: '#3b82f6' },
    { key: 'shored', name: 'Signed Off Crew', value: stats.contractHealth.shored, color: '#64748b' },
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

const MemoizedDocumentHealth = memo(({ stats, statsLoading, onDrillDown }: { stats: DashboardStats, statsLoading: boolean, onDrillDown: any }) => {
  const data = useMemo(() => [
    { key: 'expired', name: 'Expired Docs', value: stats.documentHealth.expired, color: '#ef4444' },
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
      title="Documents Index"
      description="Real-time document compliance status of crew members"
      total={stats.documentHealth.total}
      totalLabel="DOCUMENTS"
      isLoading={statsLoading}
      onSegmentClick={(key, name) => onDrillDown('document', key, name)}
      data={data}
    />
  );
});

export default function Dashboard() {
  const { user } = useAuth();
  const vesselScope = useVesselScope();
  const { toast } = useToast();
  const [showSignOffDueModal, setShowSignOffDueModal] = useState(false);
  const [showExpiryTimelineModal, setShowExpiryTimelineModal] = useState(false);
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState(false);

  // Drill-down states
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState({ key: '', name: '' });
  const [drillDownType, setDrillDownType] = useState<'contract' | 'document'>('document');

  const handleDrillDown = useCallback((type: 'contract' | 'document', key: string, name: string) => {
    setDrillDownType(type);
    setDrillDownCategory({ key, name });
    setDrillDownOpen(true);
  }, []);


  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 30000, // Reduced from 5s to 30s to prevent lagging
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
    refetchInterval: 30000,
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
    refetchInterval: 30000, // Reduced from 5s to 30s
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
    refetchInterval: 30000, // Reduced from 5s to 30s
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
    refetchInterval: 30000, // Reduced from 5s to 30s
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
    refetchInterval: 30000, // Reduced from 5s to 30s
  });

  const exportCrewByVessel = async () => {
    try {
      const response = await fetch('/api/export/fleet-pdf', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to generate PDF export');
      await downloadFileFromResponse(response, `SeaCrewManager_FleetReport.pdf`);

      toast({
        title: 'Report Generated',
        description: 'The professional fleet PDF export has been downloaded successfully.',
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
      <div className="mb-3">
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          {vesselScope !== null ? 'WORLD LEGACY — Vessel Dashboard' : 'Fleet Dashboard'}
        </h2>
        <p className="text-xs text-secondary-foreground opacity-70">
          {vesselScope !== null
            ? 'Manage crew data entry and monitor document compliance for WORLD LEGACY'
            : user?.role === 'admin'
              ? 'Overview of your maritime operations and crew status'
              : 'Manage crew data entry and monitor document compliance'}
        </p>
      </div>

      {/* Minimal Health Index Summary - Text Only */}
      {stats && (
        <MinimalHealthRow
          stats={stats}
          className="mb-4"
          onOnBoardClick={() => handleDrillDown('contract', 'on-board', 'Crew On Board')}
          onVesselsClick={() => {
            const element = document.getElementById('vessels-section');
            element?.scrollIntoView({ behavior: 'smooth' });
          }}
          onCriticalClick={() => setShowSignOffDueModal(true)}
          onOverdueClick={() => handleDrillDown('contract', 'overdue', 'Expired Contracts')}
          onSearchClick={() => handleDrillDown('contract', 'global-search', 'Search')}
          onWeeklyReportClick={() => setShowWeeklyReportModal(true)}
          onDownloadClick={exportCrewByVessel}
        />
      )}

      {/* Interactive Health Sections - Vertical Stack */}
      {stats && (
        <div className="space-y-6 mb-8">
          {/* Contract Health Section */}
          <MemoizedContractHealth stats={stats} statsLoading={statsLoading} onDrillDown={handleDrillDown} />

          {/* Document Health Section */}
          <MemoizedDocumentHealth stats={stats} statsLoading={statsLoading} onDrillDown={handleDrillDown} />
        </div>
      )}

      {/* Vessel Overview Section */}
      {(user?.role === 'admin' || user?.role === 'office_staff' || user?.role === 'vessel_user' || vesselScope !== null) && (
        <div className="mb-8" id="vessels-section">
          <div className="bg-card border border-border rounded-xl shadow-sm">
            <div className="p-6">
              <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>}>
                <VesselCards showUploadButton={false} />
              </Suspense>
            </div>
          </div>
        </div>
      )}



      <SignOffDueModal
        isOpen={showSignOffDueModal}
        onClose={() => setShowSignOffDueModal(false)}
      />

      <WeeklyReportModal
        isOpen={showWeeklyReportModal}
        onClose={() => setShowWeeklyReportModal(false)}
      />

      <ContractExpiryTimelineModal
        isOpen={showExpiryTimelineModal}
        onClose={() => setShowExpiryTimelineModal(false)}
      />

      {/* Drill-down Detail Modal - Conditional rendering for performance */}
      {drillDownOpen && (
        <HealthDrillDownModal
          isOpen={drillDownOpen}
          onClose={() => setDrillDownOpen(false)}
          type={drillDownType}
          categoryKey={drillDownCategory.key}
          categoryName={drillDownCategory.name}
        />
      )}
    </div>
  );
}

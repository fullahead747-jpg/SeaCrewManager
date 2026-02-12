import { useState, useMemo } from 'react';
import AddVesselForm from './add-vessel-form';
import CrewManagementDialog from './crew-management-dialog';
import VesselDetailsDialog from './vessel-details-dialog';
import SimpleVesselDetailsDialog from './simple-vessel-details-dialog';
import { VesselDocumentUploadModal } from '../vessel-documents/vessel-document-upload-modal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ContractStatusBadges } from './contract-status-badges';
import ContractStatusDonut from './contract-status-donut';
import HealthDrillDownModal from '../dashboard/health-drill-down-modal';
import CrewStatsBadges from './crew-stats-badges';
import { Ship, Users, Calendar, Flag, Hash, Plus, Download, Search, GripVertical, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Vessel } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface VesselWithDetails extends Vessel {
  crewCount?: number;
  nextCrewChange?: string;
}

// Sortable Vessel Card Component - Innovative Horizontal Split Design
function SortableVesselCard({ vessel, onViewDetails, onManageCrew, onUploadDocument, isAdmin, showUploadButton = true }: {
  vessel: VesselWithDetails;
  onViewDetails: (vessel: VesselWithDetails) => void;
  onManageCrew: (vessel: VesselWithDetails) => void;
  onUploadDocument: (vessel: VesselWithDetails) => void;
  isAdmin: boolean;
  showUploadButton?: boolean;
}) {
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownCategory, setDrillDownCategory] = useState({ key: '', name: '' });
  const [drillDownType, setDrillDownType] = useState<'contract' | 'document'>('contract');
  const [drillDownVesselId, setDrillDownVesselId] = useState<string | undefined>(undefined);

  const handleSegmentClick = (vesselId: string, key: string, name: string) => {
    setDrillDownType('contract'); // Vessel card pie chart is contract-based
    setDrillDownCategory({ key, name });
    setDrillDownVesselId(vesselId);
    setDrillDownOpen(true);
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: vessel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusConfig = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'harbour-mining':
        return {
          primary: '#10b981',
          bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
          text: 'text-emerald-700 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800',
          glow: 'shadow-emerald-500/20',
          gradient: 'from-emerald-500/10 via-transparent to-transparent',
          ring: 'ring-emerald-500/30',
          label: 'Harbour Manning'
        };
      case 'coastal-mining':
        return {
          primary: '#3b82f6',
          bg: 'bg-blue-50/80 dark:bg-blue-950/20',
          text: 'text-blue-700 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800',
          glow: 'shadow-blue-500/20',
          gradient: 'from-blue-500/10 via-transparent to-transparent',
          ring: 'ring-blue-500/30',
          label: 'Coastal Manning'
        };
      case 'world-wide':
        return {
          primary: '#6366f1',
          bg: 'bg-indigo-50/80 dark:bg-indigo-950/20',
          text: 'text-indigo-700 dark:text-indigo-400',
          border: 'border-indigo-200 dark:border-indigo-800',
          glow: 'shadow-indigo-500/20',
          gradient: 'from-indigo-500/10 via-transparent to-transparent',
          ring: 'ring-indigo-500/30',
          label: 'World Wide'
        };
      case 'oil-field':
        return {
          primary: '#f59e0b',
          bg: 'bg-amber-50/80 dark:bg-amber-950/20',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
          glow: 'shadow-amber-500/20',
          gradient: 'from-amber-500/10 via-transparent to-transparent',
          ring: 'ring-amber-500/30',
          label: 'Oil Field'
        };
      case 'line-up-mining':
        return {
          primary: '#64748b',
          bg: 'bg-slate-50/80 dark:bg-slate-950/20',
          text: 'text-slate-700 dark:text-slate-400',
          border: 'border-slate-200 dark:border-slate-800',
          glow: 'shadow-slate-500/20',
          gradient: 'from-slate-500/10 via-transparent to-transparent',
          ring: 'ring-slate-500/30',
          label: 'Laid Up'
        };
      case 'active':
        return {
          primary: '#0ea5e9',
          bg: 'bg-sky-50/80 dark:bg-sky-950/20',
          text: 'text-sky-700 dark:text-sky-400',
          border: 'border-sky-200 dark:border-sky-800',
          glow: 'shadow-sky-500/20',
          gradient: 'from-sky-500/10 via-transparent to-transparent',
          ring: 'ring-sky-500/30',
          label: 'Active'
        };
      default:
        return {
          primary: '#64748b',
          bg: 'bg-slate-50/80 dark:bg-slate-950/20',
          text: 'text-slate-700 dark:text-slate-400',
          border: 'border-slate-200 dark:border-slate-800',
          glow: 'shadow-slate-500/20',
          gradient: 'from-slate-500/10 via-transparent to-transparent',
          ring: 'ring-slate-500/30',
          label: status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')
        };
    }
  };

  const statusConfig = getStatusConfig(vessel.status);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1]
          }
        }
      }}
      whileHover={{
        y: -4,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      className="h-full"
    >
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          'group relative overflow-hidden transition-all duration-500 h-full',
          'bg-white/95 dark:bg-slate-950/95 backdrop-blur-md',
          'border border-slate-200/80 dark:border-slate-800/80 rounded-[2rem]',
          'hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]',
          isDragging && 'shadow-2xl ring-2 ring-blue-500 z-50 scale-105'
        )}
        data-testid={`vessel-card-${vessel.id}`}
      >
        {/* Subtle status glow top border */}
        <div className={cn(
          'absolute top-0 left-0 right-0 h-1.5 opacity-60',
          statusConfig.bg
        )} />

        <CardContent className="p-0 h-full relative z-10">
          <div className="p-5 flex flex-col h-full">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-2xl flex items-center justify-center border transition-transform duration-500 group-hover:scale-110',
                  statusConfig.bg,
                  statusConfig.border
                )}>
                  <Ship className={cn('h-5 w-5', statusConfig.text)} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      'text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md border',
                      statusConfig.bg,
                      statusConfig.text,
                      statusConfig.border
                    )}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[160px] tracking-tight" title={vessel.name}>
                    {vessel.name}
                  </h4>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 capitalize">
                    {vessel.type.toLowerCase().includes('dredger') ? 'Dredger' : vessel.type.toLowerCase()}
                  </div>
                </div>
              </div>

              {/* Drag Handle & Simple Meta */}
              <div className="flex flex-col items-end gap-2">
                {isAdmin && (
                  <div
                    className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 dark:text-slate-700 dark:hover:text-slate-600 transition-colors"
                    {...attributes}
                    {...listeners}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Analytic Split Layout: Left (Info) | Right (Graph) */}
            <div className="grid grid-cols-[1fr,auto] gap-2 mb-4 items-center pl-1">
              {/* Left Column: Specs Grid */}
              <div className="space-y-3">
                {/* Specs: Flag & IMO */}
                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 block">Flag</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{vessel.flag}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5 block">IMO</span>
                    <span className="text-sm font-mono font-medium text-slate-600 dark:text-slate-300 tracking-tight">
                      {vessel.imoNumber?.replace(/^IMO\s*/i, '')}
                    </span>
                  </div>
                </div>

                {/* DOC Status - Cleaner Integration */}
                <div className="pt-1">
                  <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400">DOC</span>
                    <div className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Active</span>
                  </div>
                </div>
              </div>

              {/* Right Column: The Graph */}
              <div className="relative flex justify-end pr-1">
                {/* Graph Container - Adjusted Size to prevent clipping */}
                <div className="relative w-[110px] h-[110px]">
                  <ContractStatusDonut
                    vesselId={vessel.id}
                    onSegmentClick={(key, name) => handleSegmentClick(vessel.id, key, name)}
                  />
                </div>
              </div>
            </div>

            {/* Health Drilldown Modal */}
            <HealthDrillDownModal
              isOpen={drillDownOpen}
              onClose={() => setDrillDownOpen(false)}
              categoryKey={drillDownCategory.key}
              categoryName={drillDownCategory.name}
              type={drillDownType}
              vesselId={drillDownVesselId}
            />

            {/* Legend / Status Text Bottom Strip */}
            <div className="flex items-center justify-center gap-3 mb-5 text-[10px] font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Valid
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" /> Due
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Expired
              </div>
            </div>

            {/* Action Bar */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-100/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all duration-300"
                onClick={() => onViewDetails(vessel)}
              >
                <Ship className="h-3 w-3 mr-2 opacity-60" />
                INFO
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] shadow-xl shadow-slate-950/10 dark:shadow-white/5 transition-all duration-300"
                onClick={() => onManageCrew(vessel)}
              >
                <Users className="h-3 w-3 mr-2" />
                Manage
              </Button>
            </div>

            {/* Floating Upload Trigger */}
            {showUploadButton && (
              <button
                className="absolute top-1/2 -right-3 transform -translate-y-1/2 w-8 h-12 flex items-center justify-center rounded-l-2xl bg-indigo-600 text-white shadow-xl translate-x-3 group-hover:translate-x-0 transition-transform duration-500 z-20"
                onClick={() => onUploadDocument(vessel)}
                title="Quick Upload"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function VesselCards({ showUploadButton = true }: { showUploadButton?: boolean }) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddVesselForm, setShowAddVesselForm] = useState(false);
  const [selectedVesselForDetails, setSelectedVesselForDetails] = useState<VesselWithDetails | null>(null);
  const [selectedVesselForCrew, setSelectedVesselForCrew] = useState<VesselWithDetails | null>(null);
  const [selectedVesselForUpload, setSelectedVesselForUpload] = useState<VesselWithDetails | null>(null);
  const [vesselOrder, setVesselOrder] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Remove debug logging since it's working

  const { data: vessels, isLoading } = useQuery<VesselWithDetails[]>({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  // Fetch crew data for export
  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
  });

  // Fetch contracts data for export
  const { data: contracts } = useQuery({
    queryKey: ['/api/contracts'],
    queryFn: async () => {
      const response = await fetch('/api/contracts', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch contracts');
      return response.json();
    },
  });

  // Fetch documents data for export
  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  // Fetch rotations data for export
  const { data: rotations } = useQuery({
    queryKey: ['/api/rotations'],
    queryFn: async () => {
      const response = await fetch('/api/rotations', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch rotations');
      return response.json();
    },
  });

  // Update vessel order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (vesselIds: string[]) => {
      const response = await apiRequest('PUT', '/api/vessels/order', {
        vesselIds
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      toast({
        title: 'Success',
        description: 'Vessel order updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update vessel order',
        variant: 'destructive',
      });
      // Reset to original order on error
      if (vessels) {
        setVesselOrder(vessels.map(v => v.id));
      }
    },
  });

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = vesselOrder.indexOf(active.id as string);
      const newIndex = vesselOrder.indexOf(over?.id as string);

      const newOrder = arrayMove(vesselOrder, oldIndex, newIndex);
      setVesselOrder(newOrder);

      // Only admin can reorder
      if (user?.role === 'admin') {
        updateOrderMutation.mutate(newOrder);
      }
    }
  };

  // Initialize and maintain vessel order
  const orderedVessels = useMemo(() => {
    if (!vessels) return [];

    // Initialize vessel order if not set
    if (vesselOrder.length === 0) {
      const initialOrder = vessels.map(v => v.id);
      setVesselOrder(initialOrder);
      return vessels;
    }

    // Sort vessels according to the current order
    return vesselOrder
      .map(id => vessels.find(v => v.id === id))
      .filter(Boolean) as VesselWithDetails[];
  }, [vessels, vesselOrder]);

  // Filter and search vessels
  const filteredVessels = useMemo(() => {
    if (!orderedVessels) return [];

    return orderedVessels.filter(vessel => {
      const matchesStatus = statusFilter === 'all' || vessel.status === statusFilter;
      const matchesSearch = !searchQuery ||
        vessel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vessel.imoNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [orderedVessels, statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'harbour-mining': { color: 'bg-compliance-green', label: 'Harbour Manning' },
      'coastal-mining': { color: 'bg-ocean-blue', label: 'Coastal Manning' },
      'world-wide': { color: 'bg-maritime-navy', label: 'World Wide (Foreign Going)' },
      'oil-field': { color: 'bg-warning-amber', label: 'Oil Field' },
      'line-up-mining': { color: 'bg-gray-500', label: 'Laid Up' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['harbour-mining'];
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const getVesselIcon = (type: string) => {
    // Return ship icon for all types for now
    return <Ship className="h-8 w-8 text-primary" />;
  };

  const handleExportVessels = () => {
    try {
      if (!vessels || vessels.length === 0) {
        toast({ title: 'No Data', description: 'No vessels found to export', variant: 'destructive' });
        return;
      }

      const workbook = XLSX.utils.book_new();

      // Group crew by vessel
      const vesselGroups: { [key: string]: any[] } = {};
      const unassignedCrew: any[] = [];
      vessels.forEach((vessel: any) => { vesselGroups[vessel.id] = []; });
      (crewMembers || []).forEach((member: any) => {
        if (member.currentVesselId && vesselGroups[member.currentVesselId]) {
          vesselGroups[member.currentVesselId].push(member);
        } else {
          unassignedCrew.push(member);
        }
      });

      // Helper to get document number
      const getDocumentNumber = (crewMemberId: string, docType: string) => {
        if (!documents) return '---';
        const doc = (documents as any[]).find((d: any) => d.crewMemberId === crewMemberId && d.type?.toLowerCase() === docType.toLowerCase());
        return doc?.documentNumber || '---';
      };

      // Process crew member with all details
      const processCrewMember = (member: any) => {
        const activeContract = member.activeContract;
        let contractEndDate = '---', daysToContractEnd = '---';
        if (activeContract?.endDate) {
          contractEndDate = format(new Date(activeContract.endDate), 'yyyy-MM-dd');
          const diffDays = Math.ceil((new Date(activeContract.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          daysToContractEnd = diffDays.toString();
        }
        let phoneNumber = member.phoneNumber || member.phone || '---';
        let nextOfKin = '---';
        if (member.emergencyContact?.name) {
          const rel = member.emergencyContact.relationship ? ` (${member.emergencyContact.relationship})` : '';
          const ph = member.emergencyContact.phone ? ` - ${member.emergencyContact.phone}` : '';
          nextOfKin = `${member.emergencyContact.name}${rel}${ph}`;
        }
        return {
          'Full Name': `${member.firstName} ${member.lastName}`, 'Rank/Position': member.rank || '---',
          'Nationality': member.nationality || '---', 'Date of Birth': member.dateOfBirth ? format(new Date(member.dateOfBirth), 'yyyy-MM-dd') : '---',
          'Phone Number': phoneNumber, 'Email': member.email || '---',
          'Passport No': getDocumentNumber(member.id, 'passport'), 'CDC No': getDocumentNumber(member.id, 'cdc'),
          'COC No': getDocumentNumber(member.id, 'coc'), 'Medical Cert No': getDocumentNumber(member.id, 'medical'),
          'Next of Kin': nextOfKin, 'Employment Status': member.status || '---',
          'Join Date': member.createdAt ? format(new Date(member.createdAt), 'yyyy-MM-dd') : '---',
          'Contract End Date': contractEndDate, 'Days to Contract End': daysToContractEnd
        };
      };

      const emptyRow = { 'Full Name': '', 'Rank/Position': '', 'Nationality': '', 'Date of Birth': '', 'Phone Number': '', 'Email': '', 'Passport No': '', 'CDC No': '', 'COC No': '', 'Medical Cert No': '', 'Next of Kin': '', 'Employment Status': '', 'Join Date': '', 'Contract End Date': '', 'Days to Contract End': '' };
      const colWidths = [{ wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }];

      // Create vessel sheets
      vessels.forEach((vessel: any) => {
        const vesselCrew = vesselGroups[vessel.id] || [];
        const worksheetData: any[] = [
          { ...emptyRow, 'Full Name': `VESSEL: ${vessel.name}` },
          { ...emptyRow, 'Full Name': `Type: ${vessel.type || '---'}`, 'Rank/Position': `IMO: ${vessel.imoNumber || '---'}`, 'Nationality': `Flag: ${vessel.flag || '---'}`, 'Date of Birth': `Status: ${vessel.status || '---'}` },
          { ...emptyRow }
        ];
        if (vesselCrew.length === 0) {
          worksheetData.push({ ...emptyRow, 'Full Name': 'No crew members assigned' });
        } else {
          vesselCrew.forEach((member: any) => worksheetData.push(processCrewMember(member)));
          worksheetData.push({ ...emptyRow }, { ...emptyRow, 'Full Name': 'VESSEL SUMMARY', 'Rank/Position': `Total: ${vesselCrew.length}` });
        }
        const ws = XLSX.utils.json_to_sheet(worksheetData);
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(workbook, ws, vessel.name.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31));
      });

      // Unassigned crew sheet
      if (unassignedCrew.length > 0) {
        const unassignedData = [{ ...emptyRow, 'Full Name': 'UNASSIGNED CREW MEMBERS' }, { ...emptyRow, 'Full Name': `Total: ${unassignedCrew.length}` }, { ...emptyRow }];
        unassignedCrew.forEach((m: any) => unassignedData.push(processCrewMember(m)));
        const uws = XLSX.utils.json_to_sheet(unassignedData);
        uws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(workbook, uws, 'Unassigned Crew');
      }

      // Contracts sheet
      if (contracts && (contracts as any[]).length > 0) {
        const contractsData = (contracts as any[]).map((c: any) => {
          const crew = (crewMembers as any[])?.find((m: any) => m.id === c.crewMemberId);
          const vessel = vessels.find((v: any) => v.id === c.vesselId);
          return { 'Crew Member': crew ? `${crew.firstName} ${crew.lastName}` : '---', 'Vessel': vessel?.name || '---', 'Start Date': c.startDate ? format(new Date(c.startDate), 'yyyy-MM-dd') : '---', 'End Date': c.endDate ? format(new Date(c.endDate), 'yyyy-MM-dd') : '---', 'Duration (Days)': c.durationDays || '---', 'Salary': c.salary || '---', 'Currency': c.currency || 'USD', 'Status': c.status || '---' };
        });
        const cws = XLSX.utils.json_to_sheet(contractsData);
        cws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, cws, 'All Contracts');
      }

      // Documents sheet
      if (documents && (documents as any[]).length > 0) {
        const docsData = (documents as any[]).map((d: any) => {
          const crew = (crewMembers as any[])?.find((m: any) => m.id === d.crewMemberId);
          return { 'Crew Member': crew ? `${crew.firstName} ${crew.lastName}` : '---', 'Document Type': d.type || '---', 'Document Number': d.documentNumber || '---', 'Issue Date': d.issueDate ? format(new Date(d.issueDate), 'yyyy-MM-dd') : '---', 'Expiry Date': d.expiryDate ? format(new Date(d.expiryDate), 'yyyy-MM-dd') : '---', 'Issuing Authority': d.issuingAuthority || '---', 'Status': d.status || '---' };
        });
        const dws = XLSX.utils.json_to_sheet(docsData);
        dws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(workbook, dws, 'All Documents');
      }

      // Rotations sheet
      if (rotations && (rotations as any[]).length > 0) {
        const rotData = (rotations as any[]).map((r: any) => {
          const crew = (crewMembers as any[])?.find((m: any) => m.id === r.crewMemberId);
          const vessel = vessels.find((v: any) => v.id === r.vesselId);
          return { 'Crew Member': crew ? `${crew.firstName} ${crew.lastName}` : '---', 'Vessel': vessel?.name || '---', 'Join Date': r.joinDate ? format(new Date(r.joinDate), 'yyyy-MM-dd') : '---', 'Leave Date': r.leaveDate ? format(new Date(r.leaveDate), 'yyyy-MM-dd') : '---', 'Rotation Type': r.rotationType || '---', 'Status': r.status || '---', 'Notes': r.notes || '---' };
        });
        const rws = XLSX.utils.json_to_sheet(rotData);
        rws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, rws, 'Crew Rotations');
      }

      // Vessel Details sheet
      const vesselsData = vessels.map((v: any) => {
        const vc = vesselGroups[v.id] || [];
        return { 'Vessel Name': v.name, 'Type': v.type || '---', 'IMO Number': v.imoNumber || '---', 'Flag': v.flag || '---', 'Status': v.status || '---', 'Total Crew': vc.length, 'On Board': vc.filter((c: any) => c.status === 'onBoard').length, 'On Shore': vc.filter((c: any) => c.status === 'onShore').length };
      });
      const vws = XLSX.utils.json_to_sheet(vesselsData);
      vws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, vws, 'Vessel Details');

      // Summary sheet
      const summaryData = [
        { Field: 'COMPREHENSIVE DATA EXPORT REPORT', Value: '' },
        { Field: 'Generated on', Value: format(new Date(), 'MMMM dd, yyyy at HH:mm') },
        { Field: '', Value: '' },
        { Field: 'Total Crew Members', Value: crewMembers?.length || 0 },
        { Field: 'Total Vessels', Value: vessels.length },
        { Field: 'Total Contracts', Value: (contracts as any[])?.length || 0 },
        { Field: 'Total Documents', Value: (documents as any[])?.length || 0 },
        { Field: 'Total Rotations', Value: (rotations as any[])?.length || 0 },
      ];
      const sws = XLSX.utils.json_to_sheet(summaryData);
      sws['!cols'] = [{ wch: 30 }, { wch: 40 }];

      // Reorder with summary first
      const tempWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(tempWb, sws, 'Summary');
      workbook.SheetNames.forEach(name => XLSX.utils.book_append_sheet(tempWb, workbook.Sheets[name], name));
      Object.assign(workbook, tempWb);

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Crew-Management-Complete-Export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Export Successful', description: `Complete data exported: ${crewMembers?.length || 0} crew, ${vessels.length} vessels` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export Failed', description: 'Unable to export data. Please try again.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
          <div className="flex space-x-2">
            <div className="h-9 bg-muted rounded w-32 animate-pulse"></div>
            <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Vessel Overview</h3>
        <div className="flex items-center space-x-2">
          {user?.role === 'admin' && (
            <Button
              className="bg-maritime-navy hover:bg-blue-800"
              size="sm"
              onClick={() => setShowAddVesselForm(true)}
              data-testid="add-vessel-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Vessel
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportVessels}
            data-testid="export-vessels-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vessels by name or IMO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="vessel-search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="vessel-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="harbour-mining">Harbour Manning</SelectItem>
            <SelectItem value="coastal-mining">Coastal Manning</SelectItem>
            <SelectItem value="world-wide">World Wide (Foreign Going)</SelectItem>
            <SelectItem value="oil-field">Oil Field</SelectItem>
            <SelectItem value="line-up-mining">Laid Up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vessel Cards Grid with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={filteredVessels.map(v => v.id)} strategy={rectSortingStrategy}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredVessels.map((vessel) => (
              <SortableVesselCard
                key={vessel.id}
                vessel={vessel}
                onViewDetails={setSelectedVesselForDetails}
                onManageCrew={setSelectedVesselForCrew}
                onUploadDocument={setSelectedVesselForUpload}
                isAdmin={user?.role === 'admin'}
                showUploadButton={showUploadButton}
              />
            ))}
          </motion.div>
        </SortableContext>
      </DndContext>

      {/* Empty State */}
      {filteredVessels && filteredVessels.length === 0 && (
        <div className="text-center py-12">
          <Ship className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No vessels found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No vessels have been added to the system yet.'
            }
          </p>
          {user?.role === 'admin' && !searchQuery && statusFilter === 'all' && (
            <Button className="bg-maritime-navy hover:bg-blue-800">
              <Plus className="h-4 w-4 mr-2" />
              Add First Vessel
            </Button>
          )}
        </div>
      )}

      {/* Add Vessel Form Dialog */}
      <AddVesselForm
        open={showAddVesselForm}
        onOpenChange={setShowAddVesselForm}
      />

      {/* Vessel Details Dialog - Use simple dialog for dashboard */}
      {showUploadButton ? (
        <VesselDetailsDialog
          vessel={selectedVesselForDetails}
          open={!!selectedVesselForDetails}
          onOpenChange={(open) => !open && setSelectedVesselForDetails(null)}
          onManageCrew={(vessel) => {
            setSelectedVesselForDetails(null);
            setSelectedVesselForCrew(vessel);
          }}
        />
      ) : (
        <SimpleVesselDetailsDialog
          vessel={selectedVesselForDetails}
          open={!!selectedVesselForDetails}
          onOpenChange={(open) => !open && setSelectedVesselForDetails(null)}
          onManageCrew={(vessel) => {
            setSelectedVesselForDetails(null);
            setSelectedVesselForCrew(vessel);
          }}
        />
      )}

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

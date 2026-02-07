import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import ContractStatusModal from './contract-status-modal';
import { CompliancePopover } from './compliance-popover';
import { REQUIRED_DOCUMENTS } from '@/components/documents/missing-documents-notifications';

interface CrewStatsProps {
  vesselId: string;
  vesselName: string;
}

interface ContractStats {
  valid: number;
  due: number;
  expired: number;
}

interface DocumentStats {
  compliant: number;
  expiringSoon: number;
  expired: number;
  compliantCrew: any[];
  nonCompliantCrew: any[];
}

export default function CrewStatsBadges({ vesselId, vesselName }: CrewStatsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedContractType, setSelectedContractType] = useState<'valid' | 'due' | 'expired'>('valid');

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


  // Helper function to get contract days remaining (same as crew table)
  const getContractDaysRemaining = (member: any) => {
    if (!member.activeContract) return 0;

    const now = new Date();
    const endDate = new Date(member.activeContract.endDate);
    const daysDiff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Return days remaining (can be negative if expired, positive if future)
    return daysDiff;
  };

  // Calculate contract stats for this specific vessel using real contract data
  const getContractStats = (): ContractStats => {
    if (!crewMembers) return { valid: 0, due: 0, expired: 0 };

    let valid = 0;
    let due = 0;
    let expired = 0;

    crewMembers.forEach((member: any) => {
      // Only count crew members assigned to this vessel
      if (member.currentVesselId === vesselId) {
        const daysRemaining = getContractDaysRemaining(member);

        if (daysRemaining <= 0) {
          expired++; // Contract has expired
        } else if (daysRemaining <= 45) {
          due++; // Contract expires within 45 days
        } else {
          valid++; // Contract is valid (>45 days)
        }
      }
    });

    return { valid, due, expired };
  };

  const getDocumentStats = (): DocumentStats => {
    if (!crewMembers) return { compliant: 0, expiringSoon: 0, expired: 0, compliantCrew: [], nonCompliantCrew: [] };

    const compliantCrew: any[] = [];
    const nonCompliantCrew: any[] = [];
    let expiringSoonCount = 0;
    let expiredCount = 0;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    crewMembers.forEach((member: any) => {
      if (member.currentVesselId === vesselId) {
        const issues: any[] = [];
        const docs = member.documents || [];

        REQUIRED_DOCUMENTS.forEach(req => {
          // Prioritize documents with file paths to avoid placeholders showing as missing
          const doc = docs.find((d: any) => d.type.toLowerCase() === req.type.toLowerCase() && d.filePath)
            || docs.find((d: any) => d.type.toLowerCase() === req.type.toLowerCase());

          if (!doc || !doc.filePath) {
            issues.push({
              type: req.type,
              label: req.label,
              status: 'missing',
              daysRemaining: -999
            });
            return;
          }

          if (doc.expiryDate) {
            const expiryDate = new Date(doc.expiryDate);
            const daysDiff = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff <= 0) {
              issues.push({
                type: req.type,
                label: req.label,
                status: 'expired',
                daysRemaining: daysDiff
              });
            } else if (daysDiff <= 30) {
              issues.push({
                type: req.type,
                label: req.label,
                status: 'expiring_soon',
                daysRemaining: daysDiff
              });
            }
          }
        });

        if (issues.length > 0) {
          const hasExpired = issues.some(i => i.status === 'expired' || i.status === 'missing');
          if (hasExpired) expiredCount++;
          else expiringSoonCount++;

          nonCompliantCrew.push({
            ...member,
            issues: issues.sort((a, b) => a.daysRemaining - b.daysRemaining)
          });
        } else {
          compliantCrew.push(member);
        }
      }
    });

    return {
      compliant: compliantCrew.length,
      expiringSoon: expiringSoonCount,
      expired: expiredCount,
      compliantCrew,
      nonCompliantCrew
    };
  };

  const stats = getContractStats();
  const docStats = getDocumentStats();

  const handleContractClick = (type: 'valid' | 'due' | 'expired') => {
    setSelectedContractType(type);
    setModalOpen(true);
  };

  const getFilteredCrewMembers = (type: 'valid' | 'due' | 'expired') => {
    if (!crewMembers) return [];

    return crewMembers.filter((member: any) => {
      if (member.currentVesselId !== vesselId) return false;

      // Use same logic as getContractStats with real contract data
      const daysRemaining = getContractDaysRemaining(member);

      if (type === 'valid') {
        return daysRemaining > 45; // Contract is valid (>45 days)
      } else if (type === 'due') {
        return daysRemaining > 0 && daysRemaining <= 45; // Contract expires within 45 days
      } else {
        return daysRemaining <= 0; // Contract has expired
      }
    });
  };


  return (
    <div className="space-y-2">
      {/* Contract Valid */}
      <button
        className="w-full group transition-all"
        onClick={() => handleContractClick('valid')}
        data-testid={`contract-valid-${vesselId}`}
      >
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/20 hover:bg-slate-100/90 dark:hover:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-600/70" />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Valid</span>
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{stats.valid}</span>
        </div>
      </button>

      {/* Contract Due */}
      <button
        className="w-full group transition-all"
        onClick={() => handleContractClick('due')}
        data-testid={`contract-due-${vesselId}`}
      >
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/20 hover:bg-slate-100/90 dark:hover:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-600/70 animate-pulse" />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Sign Off Due</span>
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{stats.due}</span>
        </div>
      </button>

      {/* Contracts Expired */}
      <button
        className="w-full group transition-all"
        onClick={() => handleContractClick('expired')}
        data-testid={`contract-expired-${vesselId}`}
      >
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/20 hover:bg-slate-100/90 dark:hover:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 transition-all duration-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-600/70" />
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Contract Expired</span>
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{stats.expired}</span>
        </div>
      </button>

      {/* Contract Status Modal */}
      <ContractStatusModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contractType={selectedContractType}
        crewMembers={getFilteredCrewMembers(selectedContractType)}
        vesselName={vesselName}
      />

      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-3 w-3 text-slate-400" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Doc Compliance</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CompliancePopover type="OK" crew={docStats.compliantCrew} vesselName={vesselName}>
            <button className="flex flex-col gap-1 text-left">
              <div className="flex items-center justify-between px-2 py-1.5 rounded bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer">
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">OK</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{docStats.compliant}</span>
              </div>
            </button>
          </CompliancePopover>

          <CompliancePopover type="EX" crew={docStats.nonCompliantCrew} vesselName={vesselName}>
            <button className="flex flex-col gap-1 text-left">
              <div className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded border transition-colors cursor-pointer",
                docStats.nonCompliantCrew.length > 0
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 hover:bg-red-100/50 dark:hover:bg-red-900/30"
                  : "bg-slate-50/50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800"
              )}>
                <span className={cn(
                  "text-[8px] font-bold uppercase tracking-tighter",
                  docStats.nonCompliantCrew.length > 0 ? 'text-red-600' : 'text-slate-400'
                )}>EX</span>
                <span className={cn(
                  "text-xs font-bold",
                  docStats.nonCompliantCrew.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-500'
                )}>{docStats.nonCompliantCrew.length}</span>
              </div>
            </button>
          </CompliancePopover>
        </div>

        {docStats.expiringSoon > 0 && (
          <div className="mt-2 flex items-center justify-between px-2 py-1.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
            <span className="text-[8px] font-bold text-amber-600 uppercase">Expiring {'<'} 30d</span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{docStats.expiringSoon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
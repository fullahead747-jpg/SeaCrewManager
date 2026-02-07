import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Ship, Users, ChevronRight, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

interface CrewMember {
    id: string;
    firstName: string;
    lastName: string;
    rank: string;
    status: string;
    currentVesselId: string | null;
    activeContract?: {
        id: string;
        startDate: string;
        endDate: string;
        status: string;
    };
}

interface Vessel {
    id: string;
    name: string;
}

interface SignOffDueModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface VesselGroup {
    vessel: Vessel;
    contracts: Array<{
        crewMember: CrewMember;
        daysRemaining: number;
    }>;
}

export default function SignOffDueModal({ isOpen, onClose }: SignOffDueModalProps) {
    const { data: crewMembers, isLoading: crewLoading } = useQuery<CrewMember[]>({
        queryKey: ['/api/crew'],
        queryFn: async () => {
            const response = await fetch('/api/crew', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch crew');
            return response.json();
        },
        enabled: isOpen,
    });

    const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({
        queryKey: ['/api/vessels'],
        queryFn: async () => {
            const response = await fetch('/api/vessels', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch vessels');
            return response.json();
        },
        enabled: isOpen,
    });

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const formatMockupDate = (date: Date | string | null | undefined): string => {
        if (!date) return '---';
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '---';

        const day = d.getUTCDate().toString().padStart(2, '0');
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = months[d.getUTCMonth()];
        const year = d.getUTCFullYear();

        return `${day} ${month} ${year}`;
    };

    const getContractDaysRemaining = (member: CrewMember) => {
        if (!member.activeContract) return 0;

        const now = new Date();
        const endDate = new Date(member.activeContract.endDate);
        const daysDiff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return daysDiff;
    };

    // Group contracts by vessel
    const vesselGroups: VesselGroup[] = [];

    if (crewMembers && vessels) {
        const now = new Date();
        const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

        // Filter crew members with contracts expiring within 45 days
        const expiringContracts = crewMembers
            .filter(member => {
                if (!member.activeContract) return false;
                const endDate = new Date(member.activeContract.endDate);
                return endDate > now && endDate <= fortyFiveDaysFromNow;
            })
            .map(member => ({
                crewMember: member,
                daysRemaining: getContractDaysRemaining(member)
            }));

        // Group by vessel
        const vesselMap = new Map<string, Array<{ crewMember: CrewMember; daysRemaining: number }>>();

        expiringContracts.forEach(contract => {
            const vesselId = contract.crewMember.currentVesselId;
            if (!vesselId) return;

            if (!vesselMap.has(vesselId)) {
                vesselMap.set(vesselId, []);
            }
            vesselMap.get(vesselId)!.push(contract);
        });

        // Convert to array and sort
        vessels.forEach(vessel => {
            const contracts = vesselMap.get(vessel.id);
            if (contracts && contracts.length > 0) {
                // Sort contracts by days remaining (urgent first)
                contracts.sort((a, b) => a.daysRemaining - b.daysRemaining);
                vesselGroups.push({ vessel, contracts });
            }
        });

        // Sort vessels by name
        vesselGroups.sort((a, b) => a.vessel.name.localeCompare(b.vessel.name));
    }

    const totalContracts = vesselGroups.reduce((sum, group) => sum + group.contracts.length, 0);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[1000px] max-h-[90vh] border-white/10 p-0 overflow-hidden bg-[#050508] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                {/* Space/Nebula Background Wrapper */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    {/* Dark gradient base */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#020205] via-[#080812] to-[#020205] opacity-100" />

                    {/* Nebula clouds */}
                    <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-indigo-600/10 blur-[130px] rounded-full" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 blur-[130px] rounded-full" />
                    <div className="absolute top-[30%] right-[20%] w-[50%] h-[50%] bg-blue-600/5 blur-[100px] rounded-full" />

                    {/* Starfield / Grid precision background */}
                    <div
                        className="absolute inset-0 opacity-[0.15]"
                        style={{
                            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 1px)`,
                            backgroundSize: '40px 40px',
                        }}
                    />
                </div>

                <div className="relative z-10 h-full flex flex-col">
                    {/* Header Section */}
                    <div className="p-8 pb-6 border-b border-white/5 flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                    <Clock className="h-6 w-6 text-indigo-400" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-[0.02em] text-white">Sign Off Due Contracts</h2>
                            </div>
                            <p className="text-gray-400 font-medium tracking-wide text-sm pl-[52px]">
                                {totalContracts} {totalContracts === 1 ? 'contract' : 'contracts'} expiring within 45 days
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-500 hover:text-white"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                        <div className="space-y-12">
                            {crewLoading || vesselsLoading ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-white/[0.02] rounded-[2rem] border border-white/5">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 opacity-60"></div>
                                    <p className="text-gray-500 font-bold tracking-[0.3em] uppercase text-[10px] mt-6">Initializing Pipeline...</p>
                                </div>
                            ) : vesselGroups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 bg-white/[0.02] rounded-[2rem] border border-white/5 backdrop-blur-md">
                                    <div className="w-16 h-16 rounded-full bg-indigo-500/5 flex items-center justify-center mb-6">
                                        <Users className="h-8 w-8 text-indigo-500/20" />
                                    </div>
                                    <p className="text-gray-500 font-bold tracking-[0.4em] uppercase text-[10px] text-center px-4 max-w-sm">No critical data requiring immediate sign-off awareness.</p>
                                </div>
                            ) : (
                                vesselGroups.map(({ vessel, contracts }) => (
                                    <div key={vessel.id} className="space-y-6">
                                        {/* Vessel Tab Style Header */}
                                        <div className="flex items-center">
                                            <div className="flex items-center space-x-3 bg-white/[0.03] px-5 py-2.5 rounded-t-2xl border-x border-t border-white/10 backdrop-blur-3xl shadow-xl">
                                                <Ship className="h-4 w-4 text-indigo-400" />
                                                <span className="text-white font-bold tracking-[0.1em] text-xs uppercase">{vessel.name}</span>
                                                <Badge className="bg-white/10 text-[10px] text-gray-400 border-none font-bold rounded-md px-2 py-0">
                                                    {contracts.length} {contracts.length === 1 ? 'Contract' : 'Contracts'}
                                                </Badge>
                                            </div>
                                            <div className="flex-1 border-b border-white/10 mb-[1px]" />
                                        </div>

                                        {/* Crew Member Glass Cards */}
                                        <div className="space-y-4">
                                            {contracts.map(({ crewMember, daysRemaining }) => {
                                                const initials = getInitials(crewMember.firstName, crewMember.lastName);
                                                // Dynamic colors based on urgency
                                                const glowColor = daysRemaining <= 15 ? 'rgba(239, 68, 68, 0.4)' : daysRemaining <= 30 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.4)';
                                                const accentColor = daysRemaining <= 15 ? 'text-red-400' : daysRemaining <= 30 ? 'text-amber-400' : 'text-indigo-400';
                                                const strokeColor = daysRemaining <= 15 ? '#ef4444' : daysRemaining <= 30 ? '#f59e0b' : '#6366f1';

                                                return (
                                                    <div key={crewMember.id} className="relative group overflow-hidden">
                                                        {/* Outer Glow Axis */}
                                                        <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-indigo-500/40 to-transparent group-hover:via-indigo-500 transition-all duration-700" />

                                                        <div className="flex items-center bg-[#0a0a0f]/80 backdrop-blur-3xl p-6 pl-8 rounded-r-3xl border border-white/5 border-l-0 shadow-2xl group-hover:bg-white/[0.04] transition-all duration-500">

                                                            {/* Profile Identity section */}
                                                            <div className="flex items-center space-x-6 w-[350px]">
                                                                <div className="relative">
                                                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center relative shadow-inner">
                                                                        <span className="text-white font-bold text-base tracking-tight">{initials}</span>
                                                                    </div>
                                                                    {/* Small dot indicator */}
                                                                    <div className={`absolute -right-1 bottom-1 w-3 h-3 rounded-full border-2 border-[#0a0a0f]`} style={{ backgroundColor: strokeColor }} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-white font-bold uppercase tracking-[0.1em] text-sm leading-tight mb-1 truncate">
                                                                        {crewMember.firstName} {crewMember.lastName}
                                                                    </h4>
                                                                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-[0.15em]">{crewMember.rank}</p>
                                                                </div>
                                                            </div>

                                                            {/* Vertical Timeline Divider */}
                                                            <div className="flex items-center h-20 px-8 relative">
                                                                <div className="w-[1px] h-full bg-gradient-to-b from-white/20 via-white/5 to-white/20 relative">
                                                                    {/* Start Node */}
                                                                    <div className="absolute top-0 -left-[3px] w-2 h-2 rounded-full border border-white/20 bg-[#0a0a0f]" />
                                                                    {/* End Node */}
                                                                    <div className="absolute bottom-0 -left-[3px] w-2 h-2 rounded-full border border-white/20 bg-[#0a0a0f]" />
                                                                </div>

                                                                <div className="flex flex-col justify-between h-full pl-6 py-0">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] text-gray-600 font-bold tracking-[0.2em] uppercase mb-0.5">Start</span>
                                                                        <span className="text-[12px] text-gray-300 font-medium tracking-wide italic">
                                                                            {formatMockupDate(crewMember.activeContract?.startDate)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] text-gray-600 font-bold tracking-[0.2em] uppercase mb-0.5">End</span>
                                                                        <span className="text-[12px] text-gray-300 font-medium tracking-wide">
                                                                            {formatMockupDate(crewMember.activeContract?.endDate)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Circular Progress Display */}
                                                            <div className="flex-1 flex justify-end">
                                                                <div className="relative w-32 h-32 flex items-center justify-center">
                                                                    {/* Circular Background Trace */}
                                                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                                                        <circle
                                                                            cx="64" cy="64" r="50"
                                                                            fill="transparent"
                                                                            stroke="rgba(255,255,255,0.03)"
                                                                            strokeWidth="8"
                                                                        />
                                                                        {/* Progress Ring */}
                                                                        <circle
                                                                            cx="64" cy="64" r="50"
                                                                            fill="transparent"
                                                                            stroke={strokeColor}
                                                                            strokeWidth="4"
                                                                            strokeDasharray={2 * Math.PI * 50}
                                                                            strokeDashoffset={2 * Math.PI * 50 * (1 - Math.min(daysRemaining, 45) / 45)}
                                                                            strokeLinecap="round"
                                                                            className="transition-all duration-1000 ease-out"
                                                                        />
                                                                    </svg>

                                                                    {/* Inner Glow/Shadow Circle */}
                                                                    <div className="absolute w-[92px] h-[92px] rounded-full bg-black/40 shadow-inner flex items-center justify-center">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className={`text-2xl font-bold tracking-tighter ${accentColor}`}>
                                                                                {daysRemaining}
                                                                            </span>
                                                                            <span className="text-[8px] text-gray-500 font-bold tracking-[0.2em] uppercase">Days</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Outer Halo Effect */}
                                                                    <div
                                                                        className="absolute inset-4 rounded-full opacity-20 blur-xl transition-all duration-500 group-hover:opacity-40"
                                                                        style={{ backgroundColor: strokeColor }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Premium Hover Card Shine */}
                                                            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-8 pb-10 flex items-center justify-center bg-black/40 backdrop-blur-3xl border-t border-white/5">
                        <Button
                            onClick={onClose}
                            className="w-[400px] h-14 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-[1.2rem] font-bold text-sm uppercase tracking-[0.25em] transition-all duration-300 hover:tracking-[0.3em] group shadow-2xl relative overflow-hidden"
                        >
                            <span className="relative z-10">View All Detailed Analytics</span>
                            <ChevronRight className="relative z-10 w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

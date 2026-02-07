import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Ship, Users, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useState } from 'react';

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

interface ContractExpiryTimelineModalProps {
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

export default function ContractExpiryTimelineModal({ isOpen, onClose }: ContractExpiryTimelineModalProps) {
    const [activeTab, setActiveTab] = useState('30days');

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

    const getVesselGroups = (maxDays: number): VesselGroup[] => {
        const vesselGroups: VesselGroup[] = [];

        if (crewMembers && vessels) {
            const now = new Date();
            const maxDaysFromNow = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

            // Filter crew members with contracts expiring within specified days
            const expiringContracts = crewMembers
                .filter(member => {
                    if (!member.activeContract) return false;
                    const endDate = new Date(member.activeContract.endDate);
                    return endDate > now && endDate <= maxDaysFromNow;
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

        return vesselGroups;
    };

    const vesselGroups30Days = getVesselGroups(30);
    const vesselGroups15Days = getVesselGroups(15);

    const totalContracts30Days = vesselGroups30Days.reduce((sum, group) => sum + group.contracts.length, 0);
    const totalContracts15Days = vesselGroups15Days.reduce((sum, group) => sum + group.contracts.length, 0);

    const renderVesselGroups = (vesselGroups: VesselGroup[], emptyMessage: string) => {
        if (crewLoading || vesselsLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto opacity-50"></div>
                    <p className="text-gray-500 font-light tracking-widest uppercase text-[10px] mt-4">Loading contracts...</p>
                </div>
            );
        }

        if (vesselGroups.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <Users className="h-12 w-12 text-gray-600 mb-4 opacity-10" />
                    <p className="text-gray-500/60 font-light tracking-[0.4em] uppercase text-[10px] text-center px-4 max-w-sm">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="space-y-12">
                {vesselGroups.map(({ vessel, contracts }) => (
                    <div key={vessel.id} className="space-y-8">
                        <div className="flex items-center">
                            <div className="flex items-center space-x-3 bg-white/[0.03] px-5 py-2.5 rounded-t-2xl border-x border-t border-white/10 backdrop-blur-3xl shadow-xl">
                                <Ship className="h-4 w-4 text-red-500" />
                                <span className="text-white font-bold tracking-[0.1em] text-xs uppercase">{vessel.name}</span>
                                <Badge className="bg-white/10 text-[10px] text-gray-400 border-none font-bold rounded-md px-2 py-0">
                                    {contracts.length} {contracts.length === 1 ? 'Contract' : 'Contracts'}
                                </Badge>
                            </div>
                            <div className="flex-1 border-b border-white/10 mb-[1px]" />
                        </div>

                        <div className="space-y-4">
                            {contracts.map(({ crewMember, daysRemaining }) => {
                                const initials = getInitials(crewMember.firstName, crewMember.lastName);
                                // Dynamic colors based on urgency - aligned with SignOffDueModal style
                                const strokeColor = daysRemaining <= 15 ? '#ef4444' : daysRemaining <= 30 ? '#f59e0b' : '#6366f1';
                                const accentColor = daysRemaining <= 15 ? 'text-red-400' : daysRemaining <= 30 ? 'text-amber-400' : 'text-indigo-400';

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
                                                            strokeDashoffset={2 * Math.PI * 50 * (1 - Math.min(Math.max(daysRemaining, 0), 45) / 45)}
                                                            strokeLinecap="round"
                                                            className="transition-all duration-1000 ease-out"
                                                        />
                                                    </svg>

                                                    {/* Inner Glow/Shadow Circle */}
                                                    <div className="absolute w-[92px] h-[92px] rounded-full bg-black/40 shadow-inner flex items-center justify-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-2xl font-bold tracking-tighter ${accentColor}`}>
                                                                {daysRemaining <= 0 ? '0' : daysRemaining}
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
                ))}
            </div>
        );
    };

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
                    {/* Header Section Section - Matched with SignOffDueModal */}
                    <div className="p-8 pb-6 border-b border-white/5 flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                    <Clock className="h-6 w-6 text-red-500" />
                                </div>
                                <h2 className="text-2xl font-bold tracking-[0.02em] text-white">Contract Expiry Timeline</h2>
                            </div>
                            <p className="text-gray-400 font-medium tracking-wide text-sm pl-[52px]">
                                Real-time compliance monitoring and rotation planning
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
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
                            <TabsList className="grid w-full grid-cols-2 bg-white/[0.02] border border-white/10 p-1.5 rounded-2xl h-16 max-w-md mx-auto">
                                <TabsTrigger
                                    value="30days"
                                    className="flex items-center justify-center space-x-4 rounded-xl transition-all data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500 hover:text-gray-300 group"
                                >
                                    <span className="text-xs uppercase tracking-[0.3em] font-bold group-data-[state=active]:tracking-[0.35em] transition-all">30 Day Window</span>
                                    {totalContracts30Days > 0 && (
                                        <Badge variant="secondary" className="bg-white/10 text-white border-white/10 px-3 py-0.5 text-[11px] font-bold rounded-lg shadow-lg">
                                            {totalContracts30Days}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="15days"
                                    className="flex items-center justify-center space-x-4 rounded-xl transition-all data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400 text-gray-500 hover:text-gray-300 group"
                                >
                                    <span className="text-xs uppercase tracking-[0.3em] font-bold group-data-[state=active]:tracking-[0.35em] transition-all">15 Day Window</span>
                                    {totalContracts15Days > 0 && (
                                        <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/20 px-3 py-0.5 text-[11px] font-bold rounded-lg shadow-lg">
                                            {totalContracts15Days}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="30days" className="mt-0 focus-visible:outline-none">
                                {renderVesselGroups(
                                    vesselGroups30Days,
                                    'No active crew contracts are expiring within the selected 30-day monitoring window.'
                                )}
                            </TabsContent>

                            <TabsContent value="15days" className="mt-0 focus-visible:outline-none">
                                {renderVesselGroups(
                                    vesselGroups15Days,
                                    'All critical crew contracts are currently secure for at least another 15 days.'
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="p-8 pt-6 border-t border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-md flex-shrink-0">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Safe</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Due</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Critical</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl px-8 h-12 uppercase tracking-[0.2em] text-xs font-bold transition-all hover:tracking-[0.25em]"
                        >
                            Complete Review
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

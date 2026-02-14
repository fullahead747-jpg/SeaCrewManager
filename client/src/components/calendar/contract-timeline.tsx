import { format, differenceInDays, startOfMonth, endOfMonth, addDays, isSameMonth } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ship, Calendar, AlertTriangle, Clock, TrendingUp, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ContractTimelineProps {
    contracts: any[];
    crewMembers: any[];
    vessels: any[];
    currentDate: Date;
}

interface TimelineContract {
    id: string;
    crewMemberId: string;
    crewName: string;
    vesselId: string;
    vesselName: string;
    startDate: Date;
    endDate: Date;
    daysRemaining: number;
    status: 'active' | 'due_soon' | 'expired';
}

export default function ContractTimeline({ contracts, crewMembers, vessels, currentDate }: ContractTimelineProps) {
    const [hoveredContract, setHoveredContract] = useState<string | null>(null);

    const getCrewMemberName = (crewMemberId: string) => {
        const member = crewMembers?.find((m: any) => m.id === crewMemberId);
        return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
    };

    const getCrewInitials = (crewMemberId: string) => {
        const member = crewMembers?.find((m: any) => m.id === crewMemberId);
        if (!member) return '??';
        return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
    };

    const getVesselName = (vesselId: string) => {
        const vessel = vessels?.find((v: any) => v.id === vesselId);
        return vessel ? vessel.name : 'Unknown';
    };

    // Process contracts for timeline
    const timelineContracts: TimelineContract[] = (contracts || [])
        .map((contract: any) => {
            const endDate = new Date(contract.endDate);
            const startDate = new Date(contract.startDate);
            // Use the first day of the current month being viewed for status calculation
            const monthStart = startOfMonth(currentDate);
            const daysRemaining = differenceInDays(endDate, monthStart);

            let status: 'active' | 'due_soon' | 'expired' = 'active';
            if (daysRemaining < 0) status = 'expired';
            else if (daysRemaining <= 60) status = 'due_soon'; // 60 days (2 months) for better planning

            return {
                id: contract.id,
                crewMemberId: contract.crewMemberId,
                crewName: getCrewMemberName(contract.crewMemberId),
                vesselId: contract.vesselId,
                vesselName: getVesselName(contract.vesselId),
                startDate: startDate,
                endDate: endDate,
                daysRemaining,
                status,
            };
        })
        .filter((contract) => {
            // Only show contracts that overlap with current month
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            return contract.endDate >= monthStart && contract.startDate <= monthEnd;
        });

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'expired':
                return {
                    gradient: 'from-red-500 via-rose-500 to-pink-500',
                    bgGlow: 'bg-red-500/10',
                    borderColor: 'border-red-300 dark:border-red-700',
                    textColor: 'text-red-700 dark:text-red-300',
                    icon: AlertTriangle,
                    label: 'Expired',
                    badgeClass: 'bg-red-500',
                };
            case 'due_soon':
                return {
                    gradient: 'from-amber-400 via-orange-500 to-red-500',
                    bgGlow: 'bg-amber-500/10',
                    borderColor: 'border-amber-300 dark:border-amber-700',
                    textColor: 'text-amber-700 dark:text-amber-300',
                    icon: Clock,
                    label: 'Due Soon',
                    badgeClass: 'bg-amber-500',
                };
            default:
                return {
                    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
                    bgGlow: 'bg-blue-500/10',
                    borderColor: 'border-blue-300 dark:border-blue-700',
                    textColor: 'text-blue-700 dark:text-blue-300',
                    icon: TrendingUp,
                    label: 'Active',
                    badgeClass: 'bg-blue-500',
                };
        }
    };

    // Group contracts by vessel for swimlanes
    const contractsByVessel = timelineContracts.reduce((acc, contract) => {
        const vesselId = contract.vesselId;
        if (!acc[vesselId]) {
            acc[vesselId] = {
                vesselName: contract.vesselName,
                contracts: [],
            };
        }
        acc[vesselId].contracts.push(contract);
        return acc;
    }, {} as Record<string, { vesselName: string; contracts: TimelineContract[] }>);

    const vessels_with_contracts = Object.entries(contractsByVessel);

    return (
        <div className="space-y-6">
            {/* Month Header with Stats */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 border border-slate-200 dark:border-slate-700">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {format(currentDate, 'MMMM yyyy')} Contracts
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {timelineContracts.length} active {timelineContracts.length === 1 ? 'contract' : 'contracts'} across {vessels_with_contracts.length} {vessels_with_contracts.length === 1 ? 'vessel' : 'vessels'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {timelineContracts.filter(c => c.status === 'active').length} Active
                        </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {timelineContracts.filter(c => c.status === 'due_soon').length} Due Soon
                        </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {timelineContracts.filter(c => c.status === 'expired').length} Expired
                        </span>
                    </div>
                </div>
            </div>

            {/* Vertical Swimlanes */}
            {vessels_with_contracts.length === 0 ? (
                <div className="text-center py-16 px-4">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center mb-4">
                        <Calendar className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Contracts This Month</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        There are no active contracts for {format(currentDate, 'MMMM yyyy')}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {vessels_with_contracts.map(([vesselId, { vesselName, contracts }]) => (
                        <div key={vesselId} className="relative">
                            {/* Vessel Swimlane Header */}
                            <div className="sticky top-0 z-10 flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                                    <Ship className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{vesselName}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {contracts.length} {contracts.length === 1 ? 'contract' : 'contracts'}
                                    </p>
                                </div>
                            </div>

                            {/* Contract Cards in Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                                {contracts.map((contract) => {
                                    const config = getStatusConfig(contract.status);
                                    const Icon = config.icon;
                                    const isHovered = hoveredContract === contract.id;
                                    const totalDays = differenceInDays(contract.endDate, contract.startDate);
                                    const daysElapsed = differenceInDays(new Date(), contract.startDate);
                                    const progress = Math.min(Math.max((daysElapsed / totalDays) * 100, 0), 100);

                                    return (
                                        <div
                                            key={contract.id}
                                            onMouseEnter={() => setHoveredContract(contract.id)}
                                            onMouseLeave={() => setHoveredContract(null)}
                                            className={cn(
                                                'group relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer',
                                                config.borderColor,
                                                config.bgGlow,
                                                isHovered && 'scale-105 shadow-2xl -translate-y-1'
                                            )}
                                        >
                                            {/* Gradient Border Glow */}
                                            <div className={cn(
                                                'absolute inset-0 rounded-xl bg-gradient-to-r opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl',
                                                config.gradient
                                            )} />

                                            {/* Content */}
                                            <div className="relative space-y-3">
                                                {/* Crew Info */}
                                                <div className="flex items-center gap-3">
                                                    <Avatar className={cn('h-12 w-12 bg-gradient-to-br shadow-lg ring-2 ring-white/50 dark:ring-slate-700/50', config.gradient)}>
                                                        <AvatarFallback className="text-white text-sm font-bold bg-transparent">
                                                            {getCrewInitials(contract.crewMemberId)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                            {contract.crewName}
                                                        </h5>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <User className="h-3 w-3 text-slate-400" />
                                                            <span className="text-xs text-slate-600 dark:text-slate-400">Crew Member</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                <div className="flex items-center justify-between">
                                                    <Badge className={cn('text-white text-xs font-semibold', config.badgeClass)}>
                                                        <Icon className="h-3 w-3 mr-1" />
                                                        {config.label}
                                                    </Badge>
                                                    {contract.status !== 'expired' && (
                                                        <span className={cn('text-sm font-bold', config.textColor)}>
                                                            {contract.daysRemaining} days
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                                                        <span>{format(contract.startDate, 'MMM d, yyyy')}</span>
                                                        <span>{format(contract.endDate, 'MMM d, yyyy')}</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn('h-full bg-gradient-to-r transition-all duration-500', config.gradient)}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Warning for Expired */}
                                                {contract.status === 'expired' && (
                                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                        <span className="text-xs font-medium text-red-700 dark:text-red-300">
                                                            Contract expired
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

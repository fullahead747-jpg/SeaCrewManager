
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Users, Ship, UserCheck, Clock, AlertTriangle, FileWarning, Search, Download } from "lucide-react";

interface StatItemProps {
    label: string;
    value: number | string;
    icon: any;
    color: string;
    description?: string;
    onClick?: () => void;
}

function StatItem({ label, value, icon: Icon, color, description, onClick }: StatItemProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-3 py-1 first:pl-0 last:pr-0 border-r border-border/40 last:border-0 min-w-max",
                onClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-lg transition-colors group"
            )}
        >
            <div className={cn(
                "p-1.5 rounded-md bg-opacity-10 transition-transform",
                color.replace('text-', 'bg-'),
                onClick && "group-hover:scale-110"
            )}>
                <Icon className={cn("h-4 w-4", color)} />
            </div>
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold tracking-tight text-foreground leading-none">{value}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight leading-none group-hover:text-primary transition-colors">{label}</span>
                </div>
                {description && (
                    <p className="text-[9px] text-muted-foreground/60 font-medium leading-none mt-1">{description}</p>
                )}
            </div>
        </div>
    );
}

interface MinimalHealthRowProps {
    stats: any;
    className?: string;
    onSearchClick?: () => void;
    onDownloadClick?: () => void;
}

export default function MinimalHealthRow({ stats, className, onSearchClick, onDownloadClick }: MinimalHealthRowProps) {
    if (!stats) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex flex-wrap items-center gap-1.5 py-2 mb-2", className)}
        >
            <StatItem
                label="On Board"
                value={stats.activeCrew}
                icon={Users}
                color="text-blue-500"
                description="Active personnel"
            />

            <StatItem
                label="Vessels"
                value={stats.activeVessels}
                icon={Ship}
                color="text-indigo-500"
                description="Fleet operational"
            />
            <StatItem
                label="Critical"
                value={stats.signOffDue30Days || 0}
                icon={AlertTriangle}
                color="text-red-500"
                description="< 30 Days"
            />
            <StatItem
                label="Overdue"
                value={stats.contractHealth?.overdue || 0}
                icon={FileWarning}
                color="text-rose-600"
                description="Expired contracts"
            />

            <StatItem
                label="Search"
                value="Global"
                icon={Search}
                color="text-emerald-500"
                description="Find crew member"
                onClick={onSearchClick}
            />

            <StatItem
                label="Download"
                value="Full"
                icon={Download}
                color="text-purple-500"
                description="Export Excel"
                onClick={onDownloadClick}
            />

        </motion.div>
    );
}

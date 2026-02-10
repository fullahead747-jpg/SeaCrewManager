
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Users, Ship, UserCheck, Clock } from "lucide-react";

interface StatItemProps {
    label: string;
    value: number | string;
    icon: any;
    color: string;
    description?: string;
}

function StatItem({ label, value, icon: Icon, color, description }: StatItemProps) {
    return (
        <div className="flex items-center gap-3 px-3 py-1 first:pl-0 last:pr-0 border-r border-border/40 last:border-0 min-w-max">
            <div className={cn("p-1.5 rounded-md bg-opacity-10", color.replace('text-', 'bg-'))}>
                <Icon className={cn("h-4 w-4", color)} />
            </div>
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold tracking-tight text-foreground leading-none">{value}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight leading-none">{label}</span>
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
}

export default function MinimalHealthRow({ stats, className }: MinimalHealthRowProps) {
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
                label="Available"
                value={stats.crewOnShore}
                icon={UserCheck}
                color="text-emerald-500"
                description="Shore standby"
            />
            <StatItem
                label="Vessels"
                value={stats.activeVessels}
                icon={Ship}
                color="text-indigo-500"
                description="Fleet operational"
            />
            <StatItem
                label="Sign Off Due"
                value={stats.signOffDue}
                icon={Clock}
                color="text-amber-500"
                description={`${stats.signOffDue30Days || 0} critical cases`}
            />
        </motion.div>
    );
}

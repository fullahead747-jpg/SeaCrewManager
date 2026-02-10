
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Clock, CheckCircle2, ShieldAlert, Zap } from 'lucide-react';

export interface HealthDataPoint {
    name: string;
    value: number;
    color: string;
    key: string; // The identifier for drill-down (e.g., 'expired', 'critical')
}

interface InteractiveHealthCardProps {
    title: string;
    description: string;
    data: HealthDataPoint[];
    total: number;
    totalLabel: string;
    isLoading: boolean;
    onSegmentClick: (key: string, name: string) => void;
    className?: string;
}

export default function InteractiveHealthCard({
    title,
    description,
    data,
    total,
    totalLabel,
    isLoading,
    onSegmentClick,
    className
}: InteractiveHealthCardProps) {
    if (isLoading) {
        return (
            <Card className={cn("shadow-lg border-border/50 bg-card/60 backdrop-blur-sm h-full min-h-[350px]", className)}>
                <CardHeader>
                    <div className="h-6 w-48 bg-muted rounded animate-pulse mb-2"></div>
                    <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-8 items-center h-full justify-center">
                        <div className="w-full h-48 bg-muted rounded animate-pulse"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const normalizedTotal = total > 0 ? total : 1;

    return (
        <Card className={cn("shadow-lg border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden group transition-all duration-300 hover:shadow-xl", className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center tracking-tight">
                    {title}
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground/70">
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8 py-2">

                    {/* Legend / Stats List - Left Side */}
                    <div className="w-full md:w-1/2 space-y-3">
                        {data.map((item, index) => {
                            const percentage = Math.round((item.value / normalizedTotal) * 100);

                            // Map keys to icons
                            const getIcon = (key: string) => {
                                if (key.includes('overdue') || key.includes('expired')) return <AlertCircle className="w-3 h-3" />;
                                if (key.includes('critical')) return <AlertTriangle className="w-3 h-3" />;
                                if (key.includes('upcoming') || key.includes('warning') || key.includes('soon')) return <Clock className="w-3 h-3" />;
                                if (key.includes('stable') || key.includes('valid')) return <CheckCircle2 className="w-3 h-3" />;
                                return <ShieldAlert className="w-3 h-3" />;
                            };

                            const isImportant = item.key.includes('overdue') || item.key.includes('expired') || item.key.includes('critical');

                            return (
                                <motion.div
                                    key={item.key}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="space-y-1.5 cursor-pointer group/item relative"
                                    onClick={() => onSegmentClick(item.key, item.name)}
                                >
                                    <div className="flex justify-between text-[12px] font-medium items-center">
                                        <div className="flex items-center">
                                            <div className="relative mr-2">
                                                <span className="w-2.5 h-2.5 rounded-full flex items-center justify-center transition-transform group-hover/item:scale-125 shadow-sm" style={{ backgroundColor: item.color }}>
                                                    {isImportant && (
                                                        <span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ backgroundColor: item.color }}></span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-muted-foreground/40 group-hover/item:text-foreground transition-colors">
                                                    {getIcon(item.key)}
                                                </span>
                                                <span className="text-muted-foreground group-hover/item:text-foreground transition-colors translate-y-[0.5px]">{item.name}</span>
                                            </div>
                                        </div>
                                        <span className="text-foreground flex items-baseline gap-1 bg-secondary/30 px-1.5 py-0.5 rounded-md group-hover/item:bg-secondary/60 transition-colors">
                                            {item.value}
                                            <span className="text-muted-foreground/50 text-[9px] font-normal uppercase tracking-wider">({percentage}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/5 dark:border-white/5">
                                        <motion.div
                                            className="h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                                            style={{
                                                backgroundColor: item.color,
                                                boxShadow: `0 0 12px ${item.color}40`
                                            }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 + index * 0.05 }}
                                        />
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Donut Chart - Right Side */}
                    <div className="w-full md:w-1/2 h-[240px] relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                    onClick={(entry) => onSegmentClick(entry.key, entry.name)}
                                    className="cursor-pointer"
                                >
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            className="transition-all duration-300 hover:opacity-80 focus:outline-none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [value, 'Count']}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '8px 12px'
                                    }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 600, fontSize: '13px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <motion.span
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-3xl font-bold text-foreground tracking-tighter"
                            >
                                {total}
                            </motion.span>
                            <span className="text-[9px] text-muted-foreground/70 uppercase tracking-[0.15em] font-semibold">
                                {totalLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


import { useMemo, useRef, useEffect, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface HealthDataPoint {
    name: string;
    value: number;
    color: string;
    key: string;
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

/**
 * Custom SVG Donut Segment that draws in a circle
 */
const DonutSegment = ({
    startAngle,
    endAngle,
    color,
    innerRadius,
    outerRadius,
    onClick
}: {
    startAngle: number;
    endAngle: number;
    color: string;
    innerRadius: number;
    outerRadius: number;
    onClick?: () => void;
}) => {
    // Generate SVG path for a donut segment
    const getPath = (start: number, end: number) => {
        // Handle zero-length or full-circle edge cases
        if (end - start < 0.1) return "";

        const startRad = (start - 90) * (Math.PI / 180);
        const endRad = (end - 90) * (Math.PI / 180);

        const x1 = 100 + outerRadius * Math.cos(startRad);
        const y1 = 100 + outerRadius * Math.sin(startRad);
        const x2 = 100 + outerRadius * Math.cos(endRad);
        const y2 = 100 + outerRadius * Math.sin(endRad);

        const x3 = 100 + innerRadius * Math.cos(endRad);
        const y3 = 100 + innerRadius * Math.sin(endRad);
        const x4 = 100 + innerRadius * Math.cos(startRad);
        const y4 = 100 + innerRadius * Math.sin(startRad);

        const largeArc = end - start <= 180 ? 0 : 1;

        return `
            M ${x1} ${y1}
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
            L ${x3} ${y3}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
            Z
        `;
    };

    return (
        <motion.path
            d={getPath(startAngle, endAngle)}
            fill={color}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ opacity: 0.8, scale: 1.02 }}
            onClick={onClick}
            className="cursor-pointer focus:outline-none transition-opacity duration-200"
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
    );
};

const InteractiveHealthCard = memo(function InteractiveHealthCard({
    title,
    description,
    data,
    total,
    totalLabel,
    isLoading,
    onSegmentClick,
    className
}: InteractiveHealthCardProps) {
    const isFirstRender = useRef(true);

    useEffect(() => {
        isFirstRender.current = false;
    }, []);

    // Memoize the data to prevent re-calculations
    const memoizedData = useMemo(() => data, [data]);

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

    // Calculate angles for segments
    let currentAngle = 0;
    const segments = memoizedData.map(item => {
        const angleSize = (item.value / normalizedTotal) * 360;
        const segment = {
            ...item,
            startAngle: currentAngle,
            endAngle: currentAngle + angleSize
        };
        currentAngle += angleSize;
        return segment;
    });

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
                        {memoizedData.map((item, index) => {
                            const percentage = Math.round((item.value / normalizedTotal) * 100);

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
                                    initial={isFirstRender.current ? { opacity: 0, x: -20 } : false}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: isFirstRender.current ? index * 0.05 : 0 }}
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
                                            initial={isFirstRender.current ? { width: 0 } : false}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 0.8, ease: "circOut", delay: isFirstRender.current ? 0.2 + index * 0.03 : 0 }}
                                        />
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Custom SVG Donut - Right Side */}
                    <div className="w-full md:w-1/2 h-[240px] relative flex items-center justify-center">
                        <svg width="220" height="220" viewBox="0 0 200 200" className="transform -rotate-90">
                            {/* Background Circle */}
                            <circle
                                cx="100" cy="100" r="82.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="25"
                                className="text-secondary/20"
                            />

                            {/* Animated Segments */}
                            {segments.map((segment) => (
                                <DonutSegment
                                    key={segment.key}
                                    startAngle={segment.startAngle}
                                    endAngle={segment.endAngle}
                                    color={segment.color}
                                    innerRadius={70}
                                    outerRadius={95}
                                    onClick={() => onSegmentClick(segment.key, segment.name)}
                                />
                            ))}
                        </svg>

                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <AnimatePresence mode="popLayout">
                                <motion.span
                                    key={total}
                                    initial={{ opacity: 0, scale: 0.8, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.1, y: -5 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="text-3xl font-bold text-foreground tracking-tighter"
                                >
                                    {total}
                                </motion.span>
                            </AnimatePresence>
                            <span className="text-[9px] text-muted-foreground/70 uppercase tracking-[0.15em] font-semibold">
                                {totalLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}, (prevProps, nextProps) => {
    // Custom comparison to avoid re-renders if data values are identical
    if (prevProps.total !== nextProps.total) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.data.length !== nextProps.data.length) return false;
    for (let i = 0; i < prevProps.data.length; i++) {
        if (prevProps.data[i].value !== nextProps.data[i].value) return false;
        if (prevProps.data[i].key !== nextProps.data[i].key) return false;
    }
    return true;
});

export default InteractiveHealthCard;


import { useMemo, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

/**
 * High-performance Donut Segment for Vessel Cards with rounded ends and gaps
 */
const SimpleDonutSegment = ({
    startAngle,
    endAngle,
    color,
    radius,
    strokeWidth,
    onClick
}: {
    startAngle: number;
    endAngle: number;
    color: string;
    radius: number;
    strokeWidth: number;
    onClick?: () => void;
}) => {
    const getPath = (start: number, end: number) => {
        const padding = 4; // Larger relative padding for smaller charts
        const s = start + padding;
        const e = end - padding;

        if (e - s <= 0) return "";

        const startRad = (s - 90) * (Math.PI / 180);
        const endRad = (e - 90) * (Math.PI / 180);
        const x1 = 60 + radius * Math.cos(startRad);
        const y1 = 60 + radius * Math.sin(startRad);
        const x2 = 60 + radius * Math.cos(endRad);
        const y2 = 60 + radius * Math.sin(endRad);
        const largeArc = e - s <= 180 ? 0 : 1;

        return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    return (
        <motion.path
            d={getPath(startAngle, endAngle)}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            onClick={onClick}
            className={onClick ? "cursor-pointer hover:brightness-110 transition-all" : ""}
            whileHover={onClick ? { strokeWidth: strokeWidth + 2 } : {}}
        />
    );
};

const ContractStatusDonut = memo(function ContractStatusDonut({
    vesselId,
    onSegmentClick
}: {
    vesselId: string;
    onSegmentClick?: (key: string, name: string) => void;
}) {
    const isFirstRender = useRef(true);

    useEffect(() => {
        isFirstRender.current = false;
    }, []);

    const { data: stats, isLoading } = useQuery({
        queryKey: ['/api/vessels', vesselId, 'contract-stats'],
        queryFn: async () => {
            const response = await fetch(`/api/vessels/${vesselId}/contract-stats`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) return { active: 0, expiringSoon: 0, expired: 0 };
            return response.json();
        },
        refetchInterval: 15000,
        retry: 1
    });

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <div className="animate-pulse h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
        );
    }

    const safeStats = stats || { active: 0, expiringSoon: 0, expired: 0 };
    const total = (safeStats.active || 0) + (safeStats.expiringSoon || 0) + (safeStats.expired || 0);
    const normalizedTotal = total > 0 ? total : 1;

    const data = [
        { key: 'stable', name: 'Valid', value: safeStats.active || 0, color: '#10b981' },
        { key: 'upcoming', name: 'Due Soon', value: safeStats.expiringSoon || 0, color: '#f59e0b' },
        { key: 'overdue', name: 'Expired', value: safeStats.expired || 0, color: '#ef4444' },
    ].filter(d => d.value > 0);

    if (data.length === 0) {
        data.push({ key: 'none', name: 'No Crew', value: 1, color: '#e2e8f0' });
    }

    let currentAngle = 0;
    const segments = data.map(item => {
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
        <div className="relative h-full w-full flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
                {/* Background circle removed for clarity */}

                {/* Data segments */}
                {segments.map((segment, i) => (
                    <SimpleDonutSegment
                        key={i}
                        startAngle={segment.startAngle}
                        endAngle={segment.endAngle}
                        color={segment.color}
                        radius={48}
                        strokeWidth={8}
                        onClick={() => onSegmentClick?.(segment.key, segment.name)}
                    />
                ))}
            </svg>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <AnimatePresence mode="popLayout">
                    <motion.span
                        key={total}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                        className="text-xl font-bold text-slate-700 dark:text-slate-100 tracking-tight leading-none"
                    >
                        {total}
                    </motion.span>
                </AnimatePresence>
                <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                    Crew
                </span>
            </div>
        </div>
    );
});

export default ContractStatusDonut;

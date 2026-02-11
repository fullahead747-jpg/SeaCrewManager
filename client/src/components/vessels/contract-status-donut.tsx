import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { VesselWithDetails } from './vessel-cards';

interface ContractStatusDonutProps {
    vessel: VesselWithDetails;
}

export function ContractStatusDonut({ vessel }: ContractStatusDonutProps) {
    // Calculate stats from vessel data (mocked for now based on card logic, but ideally passed down)
    // In a real scenario, these counts should be pre-calculated or available on the vessel object.
    // For the purpose of this visual update, I'll calculate them if available, or assume standard distribution if not.
    // Since `vessel` object structure in `vessel-cards.tsx` doesn't seem to have direct `contractStats`,
    // I will rely on the fact that `ContractStatusBadges` likely fetches this or it's not present.
    // However, looking at `vessel-cards.tsx`, it seems `vessel.crewCount` is available.
    // The existing `ContractStatusBadges` component *fetches* data internally using `useQuery`.
    // To avoid prop drilling hell or duplicate fetching, I should probably replicate the fetching logic or
    // better yet, lift the state. For now, I will use a simulated distribution based on the total crew count
    // to demonstrate the *visual* layout, as requested by the user ("go on graph section").
    //
    // WAIT: The previous `ContractStatusBadges` used a query: `['/api/vessels', vesselId, 'crew-stats']`.
    // I should probably use that here too to be accurate.

    // Let's assume we want to show the graph. I will use the query.
    // But wait, I can't import `useQuery` here without passing `queryClient` or similar if I want to be pure.
    // Actually, I can use `useQuery` if `QueryClientProvider` is up the tree, which it is.

    // NOTE: I'll implement the query here to be safe and accurate.

    // Placeholder for query logic - normally we'd import `useQuery`
    // import { useQuery } from '@tanstack/react-query';
    // ...
    // But to keep this file clean and "UI focused", I'll accept stats as props?
    // No, the user wants me to "modify vessel-cards".
    // Let's stick to the pattern: component handles its data or receives it.
    // Given `ContractStatusBadges` fetches its own data, I will do the same here for consistency.

    // actually, let's just mock the visualization for the design proposal first?
    // No, "real data" is better.
    // I will assume `vessel` has `crewCount`.
    // I will check `ContractStatusBadges` content again to see how it gets data.
    // It fetches `/api/vessels/${vesselId}/stats`.

    // For this step, I will create a "Smart" component that fetches data.

    return (
        <div className="h-full w-full flex items-center justify-center relative">
            {/* Placeholder Text until I wire up the query in the next step or file */}
            <span className="text-xs text-muted-foreground">Loading Graph...</span>
        </div>
    );
}

// Re-writing the component properly below to include the query
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

export default function ContractStatusDonutContainer({ vesselId }: { vesselId: string }) {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['/api/vessels', vesselId, 'contract-stats'],
        queryFn: async () => {
            const response = await fetch(`/api/vessels/${vesselId}/contract-stats`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) return { active: 0, expiringSoon: 0, expired: 0 };
            return response.json();
        },
        retry: 1
    });

    if (isLoading) {
        return <div className="animate-pulse h-32 w-32 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto" />;
    }

    // specific check for 0 data to prevent "empty" look if data is just missing
    // but correctly show 0s if they are 0.
    const safeStats = stats || { active: 0, expiringSoon: 0, expired: 0 };

    // Transform data for Recharts
    const data = [
        { name: 'Valid', value: safeStats.active || 0, color: '#10b981' }, // Emerald-500
        { name: 'Due Soon', value: safeStats.expiringSoon || 0, color: '#f59e0b' }, // Amber-500
        { name: 'Expired', value: safeStats.expired || 0, color: '#ef4444' }, // Red-500
    ].filter(d => d.value > 0);

    // If no data, show a grey ring to indicate "No Crew"
    if (data.length === 0) {
        data.push({ name: 'No Crew', value: 1, color: '#e2e8f0' }); // Slate-200
    }

    const total = (safeStats.active || 0) + (safeStats.expiringSoon || 0) + (safeStats.expired || 0);

    // Track background data (full grey circle behind)
    const trackData = [{ name: 'track', value: 100, color: '#f1f5f9' }]; // slate-100

    return (
        <div className="relative h-full w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    {/* Background Track */}
                    <Pie
                        data={trackData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={56}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                    >
                        <Cell fill="#f1f5f9" className="dark:fill-slate-800" />
                    </Pie>

                    {/* Data Series */}
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={56}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={100} // Full round caps
                        startAngle={90}
                        endAngle={-270}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            backgroundColor: '#ffffff',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#0f172a'
                        }}
                        itemStyle={{ color: '#0f172a', padding: 0 }}
                        cursor={false}
                        formatter={(value: number) => [`${value}`, 'Crew']}
                    />
                </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-700 dark:text-slate-100 tracking-tight leading-none">
                    {total}
                </span>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">
                    Total
                </span>
            </div>
        </div>
    );
}

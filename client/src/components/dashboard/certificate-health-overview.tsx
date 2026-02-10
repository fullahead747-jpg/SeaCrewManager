
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardStats } from '@/types';
import { motion } from 'framer-motion';

interface CertificateHealthOverviewProps {
    stats: DashboardStats | undefined;
    isLoading: boolean;
}

export default function CertificateHealthOverview({ stats, isLoading }: CertificateHealthOverviewProps) {
    if (isLoading || !stats?.documentHealth) {
        return (
            <Card className="col-span-1 lg:col-span-2 shadow-sm border-border h-full min-h-[300px]">
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

    const { documentHealth } = stats;

    const data = [
        { name: 'Expired', value: documentHealth.expired, color: '#ef4444' }, // Red-500
        { name: 'Critical (< 30 Days)', value: documentHealth.critical, color: '#f97316' }, // Orange-500
        { name: 'Warning (< 90 Days)', value: documentHealth.warning, color: '#eab308' }, // Yellow-500
        { name: 'Attention (< 180 Days)', value: documentHealth.attention, color: '#3b82f6' }, // Blue-500
        { name: 'Valid / Permanent', value: documentHealth.valid, color: '#10b981' }, // Emerald-500
    ];

    // Calculate percentages
    const total = documentHealth.total > 0 ? documentHealth.total : 1;

    return (
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold flex items-center">
                    Certificate Health Overview
                </CardTitle>
                <CardDescription>
                    Real-time compliance status of all crew documents
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8 py-4">

                    {/* Legend / Stats List - Left Side */}
                    <div className="w-full md:w-1/2 space-y-4">
                        {data.map((item, index) => {
                            const percentage = Math.round((item.value / total) * 100);
                            return (
                                <motion.div
                                    key={item.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="space-y-1"
                                >
                                    <div className="flex justify-between text-sm font-medium">
                                        <div className="flex items-center">
                                            <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                            <span className="text-muted-foreground">{item.name}</span>
                                        </div>
                                        <span className="text-foreground">{item.value} <span className="text-muted-foreground text-xs font-normal">({percentage}%)</span></span>
                                    </div>
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: item.color }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 1, delay: 0.2 }}
                                        />
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Donut Chart - Right Side */}
                    <div className="w-full md:w-1/2 h-[220px] relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [value, 'Documents']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-foreground">{documentHealth.total}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Certificates</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

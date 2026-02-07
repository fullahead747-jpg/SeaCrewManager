import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Ship, Clock, CheckCircle, UserCheck, Home, Anchor, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: 'users' | 'ship' | 'clock' | 'check' | 'user-check' | 'home' | 'anchor' | 'alert-circle';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  color: 'ocean-blue' | 'maritime-navy' | 'warning-amber' | 'compliance-green' | 'contract-purple' | 'expiry-red';
  href?: string;
}

const iconMap = {
  users: Users,
  ship: Ship,
  clock: Clock,
  check: CheckCircle,
  'user-check': UserCheck,
  home: Home,
  anchor: Anchor,
  'alert-circle': AlertCircle,
};

// Modern gradient backgrounds with glassmorphism
const colorStyles = {
  'ocean-blue': {
    gradient: 'from-blue-500/10 via-cyan-500/10 to-blue-600/10',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    iconGlow: 'shadow-lg shadow-blue-500/50',
    border: 'border-blue-500/20',
    textAccent: 'text-blue-600 dark:text-blue-400'
  },
  'maritime-navy': {
    gradient: 'from-indigo-500/10 via-blue-500/10 to-indigo-600/10',
    iconBg: 'bg-gradient-to-br from-indigo-600 to-blue-700',
    iconGlow: 'shadow-lg shadow-indigo-500/50',
    border: 'border-indigo-500/20',
    textAccent: 'text-indigo-600 dark:text-indigo-400'
  },
  'warning-amber': {
    gradient: 'from-amber-500/10 via-orange-500/10 to-amber-600/10',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconGlow: 'shadow-lg shadow-amber-500/50',
    border: 'border-amber-500/20',
    textAccent: 'text-amber-600 dark:text-amber-400'
  },
  'compliance-green': {
    gradient: 'from-emerald-500/10 via-green-500/10 to-emerald-600/10',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    iconGlow: 'shadow-lg shadow-emerald-500/50',
    border: 'border-emerald-500/20',
    textAccent: 'text-emerald-600 dark:text-emerald-400'
  },
  'contract-purple': {
    gradient: 'from-purple-500/10 via-violet-500/10 to-purple-600/10',
    iconBg: 'bg-gradient-to-br from-purple-500 to-violet-600',
    iconGlow: 'shadow-lg shadow-purple-500/50',
    border: 'border-purple-500/20',
    textAccent: 'text-purple-600 dark:text-purple-400'
  },
  'expiry-red': {
    gradient: 'from-red-500/10 via-rose-500/10 to-red-600/10',
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-600',
    iconGlow: 'shadow-lg shadow-red-500/50',
    border: 'border-red-500/20',
    textAccent: 'text-red-600 dark:text-red-400'
  },
};

export default function StatsCard({ title, value, icon, trend, description, color, href }: StatsCardProps) {
  const Icon = iconMap[icon];
  const styles = colorStyles[color];

  const cardContent = (
    <CardContent className="p-0 overflow-hidden">
      {/* Gradient Background Layer */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50',
        styles.gradient
      )} />

      {/* Glass Effect Overlay */}
      <div className="absolute inset-0 backdrop-blur-3xl bg-white/40 dark:bg-gray-900/40" />

      {/* Content Layer */}
      <div className="relative p-3">
        {/* Header with Floating Icon */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <p className="text-[9px] sm:text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1" data-testid="stats-title">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent" data-testid="stats-value">
                {typeof value === 'string' && value.length > 8 ?
                  <span className="text-lg sm:text-xl">{value}</span> : value
                }
              </p>
            </div>
          </div>

          {/* Floating Icon with Glow */}
          <div className={cn(
            'relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center',
            'transform transition-all duration-300 hover:scale-110 hover:rotate-6',
            styles.iconBg,
            styles.iconGlow
          )}>
            {/* Icon Shimmer Effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-white/0 via-white/20 to-white/0 animate-pulse" />
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white relative z-10" strokeWidth={2.5} />
          </div>
        </div>

        {/* Trend or Description */}
        <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
          {trend && (
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold',
                trend.isPositive
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} />
                )}
                <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              </div>
              <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">vs last month</span>
            </div>
          )}

          {description && !trend && (
            <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Decorative Corner Accent */}
      <div className={cn(
        'absolute -bottom-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20',
        styles.iconBg
      )} />
    </CardContent>
  );

  const cardClasses = cn(
    'group relative overflow-hidden border-2 transition-all duration-300',
    'hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1',
    'bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl',
    styles.border,
    href && 'cursor-pointer'
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className={cardClasses} data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card className={cardClasses} data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {cardContent}
    </Card>
  );
}

import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

export type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'critically_expired';

interface DocumentStatusBadgeProps {
    status: DocumentStatus;
    daysRemaining?: number;
    showCountdown?: boolean;
    className?: string;
}

export function DocumentStatusBadge({
    status,
    daysRemaining,
    showCountdown = true,
    className = ''
}: DocumentStatusBadgeProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'valid':
                return {
                    label: 'Valid',
                    icon: CheckCircle,
                    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
                };
            case 'expiring':
                return {
                    label: 'Expiring Soon',
                    icon: Clock,
                    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200',
                };
            case 'expired':
                return {
                    label: 'Expired',
                    icon: AlertCircle,
                    className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
                };
            case 'critically_expired':
                return {
                    label: 'Critically Expired',
                    icon: XCircle,
                    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 animate-pulse',
                };
            default:
                return {
                    label: 'Unknown',
                    icon: AlertCircle,
                    className: 'bg-gray-100 text-gray-800 border-gray-200',
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const formatDaysRemaining = (days: number | undefined) => {
        if (days === undefined) return '';

        if (days > 0) {
            return ` (${days}d)`;
        } else if (days === 0) {
            return ' (Today)';
        } else {
            return ` (${Math.abs(days)}d ago)`;
        }
    };

    return (
        <Badge
            variant="outline"
            className={`${config.className} ${className} flex items-center gap-1.5 font-semibold`}
        >
            <Icon className="h-3.5 w-3.5" />
            <span>
                {config.label}
                {showCountdown && daysRemaining !== undefined && formatDaysRemaining(daysRemaining)}
            </span>
        </Badge>
    );
}

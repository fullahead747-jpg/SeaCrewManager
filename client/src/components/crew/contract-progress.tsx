import { Progress } from '@/components/ui/progress';

interface ContractProgressProps {
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  crewStatus?: string;
  memberId: string;
  compact?: boolean;
}

interface ContractState {
  percent: number;
  remainingDays: number;
  elapsedDays: number;
  totalDays: number;
  state: 'upcoming' | 'active' | 'expired' | 'no-contract';
}

export function ContractProgress({ startDate, endDate, status, crewStatus, memberId, compact = false }: ContractProgressProps) {

  const calculateContractState = (): ContractState => {
    if (!startDate || !endDate || status !== 'active' || crewStatus === 'onShore') {
      return {
        percent: 0,
        remainingDays: 0,
        elapsedDays: 0,
        totalDays: 0,
        state: 'no-contract'
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return {
        percent: 0,
        remainingDays: 0,
        elapsedDays: 0,
        totalDays: 0,
        state: 'no-contract'
      };
    }

    const msPerDay = 86_400_000;
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));

    // Calculate elapsed time with proper clamping
    const elapsedMs = Math.max(0, Math.min(end.getTime() - start.getTime(), now.getTime() - start.getTime()));
    const elapsedDays = Math.floor(elapsedMs / msPerDay);
    const percent = Math.round((elapsedDays / totalDays) * 100);
    const remainingDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay));

    let state: ContractState['state'];
    if (now < start) {
      state = 'upcoming';
    } else if (now > end) {
      state = 'expired';
    } else {
      state = 'active';
    }

    return {
      percent: Math.min(100, Math.max(0, percent)),
      remainingDays,
      elapsedDays,
      totalDays,
      state
    };
  };

  const contractState = calculateContractState();

  const getProgressColor = () => {
    switch (contractState.state) {
      case 'upcoming':
        return 'bg-blue-500 dark:bg-blue-400';
      case 'expired':
        return 'bg-red-500 dark:bg-red-400';
      case 'active':
        if (contractState.remainingDays > 30) return 'bg-green-500 dark:bg-green-400';
        if (contractState.remainingDays >= 7) return 'bg-amber-500 dark:bg-amber-400';
        return 'bg-red-500 dark:bg-red-400';
      default:
        return 'bg-gray-400 dark:bg-gray-500';
    }
  };

  const getTextColor = () => {
    switch (contractState.state) {
      case 'upcoming':
        return 'text-blue-700 dark:text-blue-300';
      case 'expired':
        return 'text-red-700 dark:text-red-300';
      case 'active':
        if (contractState.remainingDays > 30) return 'text-green-700 dark:text-green-300';
        if (contractState.remainingDays >= 7) return 'text-amber-700 dark:text-amber-300';
        return 'text-red-700 dark:text-red-300';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getRemainingText = () => {
    switch (contractState.state) {
      case 'upcoming':
        return `Starts in ${Math.abs(contractState.remainingDays)}d`;
      case 'expired':
        return 'Expired';
      case 'active':
        return `${contractState.remainingDays}d left`;
      default:
        return 'No contract';
    }
  };

  const getRemainingNumber = () => {
    switch (contractState.state) {
      case 'upcoming':
        return Math.abs(contractState.remainingDays);
      case 'expired':
        return 0;
      case 'active':
        return contractState.remainingDays;
      default:
        return 0;
    }
  };

  const formatDate = (date: string | Date) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short'
      });
    } catch {
      return '';
    }
  };

  // Get progress bar style with animations based on urgency
  const getProgressStyle = () => {
    const baseStyle: React.CSSProperties = {
      width: `${contractState.percent}%`,
      transition: 'all 1s ease-out',
    };

    if (contractState.state !== 'active') {
      return baseStyle;
    }

    // Critical: <15 days - Fast pulse with red
    if (contractState.remainingDays < 15) {
      return {
        ...baseStyle,
        background: 'linear-gradient(90deg, #ef4444, #f97316)',
        animation: 'pulse-fast 1.5s ease-in-out infinite',
      };
    }

    // Warning: 15-30 days - Slow pulse with orange
    if (contractState.remainingDays < 30) {
      return {
        ...baseStyle,
        background: 'linear-gradient(90deg, #f97316, #eab308)',
        animation: 'pulse-slow 3s ease-in-out infinite',
      };
    }

    // Normal: >30 days - Shimmer with blue
    return {
      ...baseStyle,
      background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
      backgroundSize: '200% 100%',
      backgroundImage: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 50%, rgba(255, 255, 255, 0.3) 50%, #3b82f6 100%)',
      animation: 'shimmer 3s ease-in-out infinite',
    };
  };

  if (contractState.state === 'no-contract') {
    return (
      <div className={`flex items-center ${compact ? 'justify-center' : 'space-x-2'}`}>
        <div className={`w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full ${compact ? '' : 'shrink-0'}`} />
        <span className={`text-xs text-gray-600 dark:text-gray-400 ${compact ? 'ml-1' : ''}`}>
          No active contract
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes pulse-slow {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.4); }
            50% { opacity: 0.9; box-shadow: 0 0 8px 2px rgba(251, 146, 60, 0.6); }
          }
          @keyframes pulse-fast {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { opacity: 0.85; box-shadow: 0 0 12px 3px rgba(239, 68, 68, 0.7); }
          }
        `}</style>
        <div className="w-full min-w-0">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground truncate">
              {formatDate(startDate)}
            </span>
            <span className={`font-medium ${getTextColor()}`}>
              {contractState.state === 'active' ? `${contractState.remainingDays} days` : ''}
            </span>
            <span className="text-muted-foreground truncate">
              {formatDate(endDate)}
            </span>
          </div>
          <div className="relative h-2 bg-slate-200/60 dark:bg-slate-700/50 rounded-full overflow-hidden print:hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={getProgressStyle()}
              data-testid={`progress-contract-${memberId}`}
              role="progressbar"
              aria-valuenow={contractState.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Contract progress: ${contractState.percent}% complete, ${getRemainingText()}`}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.4); }
          50% { opacity: 0.9; box-shadow: 0 0 8px 2px rgba(251, 146, 60, 0.6); }
        }
        @keyframes pulse-fast {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { opacity: 0.85; box-shadow: 0 0 12px 3px rgba(239, 68, 68, 0.7); }
        }
      `}</style>
      <div className="w-full min-w-0">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground truncate">
            {formatDate(startDate)}
          </span>
          <span className={`font-medium ${getTextColor()}`} data-testid={`label-remaining-${memberId}`}>
            {contractState.state === 'active' ? `${contractState.remainingDays} days` : ''}
          </span>
          <span className="text-muted-foreground truncate">
            {formatDate(endDate)}
          </span>
        </div>
        <div className="relative h-2 bg-slate-200/60 dark:bg-slate-700/50 rounded-full overflow-hidden print:hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={getProgressStyle()}
            data-testid={`progress-contract-${memberId}`}
            role="progressbar"
            aria-valuenow={contractState.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Contract progress: ${contractState.percent}% complete, ${getRemainingText()}`}
          />
        </div>
      </div>
    </>
  );
}
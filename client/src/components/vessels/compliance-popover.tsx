import { Link } from 'wouter';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { User, AlertCircle, CheckCircle2, Clock, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";

interface DocumentIssue {
    type: string;
    label: string;
    daysRemaining: number;
    status: 'expired' | 'expiring_soon' | 'missing';
}

interface CrewWithIssues {
    id: string;
    firstName: string;
    lastName: string;
    rank: string;
    issues: DocumentIssue[];
}

interface CompliancePopoverProps {
    children: React.ReactNode;
    type: 'OK' | 'EX';
    crew: CrewWithIssues[] | any[]; // any[] to support non-compliant list from parent
    vesselName: string;
}

export function CompliancePopover({ children, type, crew, vesselName }: CompliancePopoverProps) {
    const isEx = type === 'EX';

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-xl border-slate-200 dark:border-slate-800" side="right" sideOffset={10}>
                <div className={cn(
                    "px-4 py-3 border-b flex items-center justify-between",
                    isEx ? "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30" : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
                )}>
                    <div className="flex items-center gap-2">
                        {isEx ? (
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            {isEx ? "Compliance Issues" : "Compliant Crew"}
                        </h4>
                    </div>
                    <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        isEx ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    )}>
                        {crew.length}
                    </span>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                    {crew.length === 0 ? (
                        <div className="py-8 text-center text-slate-400">
                            <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs">No crew members to show</p>
                        </div>
                    ) : (
                        crew.map((member) => (
                            <div key={member.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                    <Link href={`/documents?crew=${member.id}`} className="group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                                <User className="h-3.5 w-3.5 text-slate-500" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {member.firstName} {member.lastName}
                                                </span>
                                                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-tight">
                                                    {member.rank}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </div>

                                {isEx && member.issues && member.issues.length > 0 && (
                                    <div className="space-y-1.5 ml-9">
                                        {member.issues.map((issue: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    {issue.status === 'expired' ? (
                                                        <XCircle className="h-3 w-3 text-red-500" />
                                                    ) : issue.status === 'missing' ? (
                                                        <AlertCircle className="h-3 w-3 text-red-400" />
                                                    ) : (
                                                        <Clock className="h-3 w-3 text-amber-500" />
                                                    )}
                                                    <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                                        {issue.label}
                                                    </span>
                                                </div>
                                                <span className={cn(
                                                    "text-[9px] font-bold",
                                                    issue.status === 'expired' ? "text-red-600" : issue.status === 'missing' ? "text-red-400" : "text-amber-600"
                                                )}>
                                                    {issue.status === 'expired' ? "Expired" : issue.status === 'missing' ? "Missing" : `In ${issue.daysRemaining} days`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 text-center italic">
                        Click on a seafarer to view their full profile
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}

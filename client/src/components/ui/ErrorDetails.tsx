import React from 'react';
import { AlertCircle, FileWarning, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorDetailsProps {
    error: any;
    className?: string;
}

export function ErrorDetails({ error, className }: ErrorDetailsProps) {
    if (!error) return null;

    // Handle ApiError info or raw error object
    const info = error.info || error;
    const message = typeof error === 'string' ? error : (error.message || info.message || 'An unexpected error occurred');
    const isValidationError = info.isValidationError;
    const details = info.details;
    const zodErrors = info.errors; // Standard Zod errors from backend

    return (
        <div className={cn("space-y-4 py-1", className)}>
            {/* Primary Message */}
            <div className="flex items-start gap-3">
                <div className="mt-0.5">
                    {isValidationError ? (
                        <FileWarning className="h-5 w-5 text-amber-500" />
                    ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold leading-none">{message}</p>
                    {!isValidationError && !zodErrors && (
                        <p className="text-xs text-muted-foreground">
                            Please try again or contact support if the issue persists.
                        </p>
                    )}
                </div>
            </div>

            {/* OCR Validation Errors (Premium Display) */}
            {isValidationError && details && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {details.criticalErrors && details.criticalErrors.length > 0 && (
                        <div className="bg-muted/40 rounded-lg border border-border overflow-hidden">
                            <div className="bg-muted/80 px-3 py-2 border-b border-border flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verification Mismatch</span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                    Score: {details.matchScore}%
                                </span>
                            </div>
                            <div className="p-3 space-y-2">
                                {details.criticalErrors.map((err: string, i: number) => {
                                    // Parse "Field: Expected 'X', OCR found 'Y'"
                                    const parts = err.match(/(.+): Expected '(.+)', OCR found '(.+)'/);
                                    if (parts) {
                                        const [, field, expected, found] = parts;
                                        return (
                                            <div key={i} className="grid grid-cols-12 gap-2 text-xs items-center">
                                                <div className="col-span-4 font-medium text-muted-foreground truncate" title={field}>
                                                    {field}
                                                </div>
                                                <div className="col-span-8 flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-100 dark:border-green-900/30 truncate max-w-[100px]" title={expected}>
                                                        {expected}
                                                    </span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-100 dark:border-red-900/30 truncate max-w-[100px]" title={found}>
                                                        {found}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return <div key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                                        <div className="h-1 w-1 rounded-full bg-red-400" />
                                        {err}
                                    </div>;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Doctor Approval Number Context */}
                    {details.isDoctorApprovalNumber && (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-2.5 rounded-lg flex gap-2.5 items-start">
                            <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                                <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">Doctor Approval Number Detected</p>
                                <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                                    These numbers are often shared by seafarers visiting the same medical center. Verify the document carefully.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Guidance */}
                    <div className="pt-1">
                        <p className="text-xs font-medium text-foreground">How to fix this?</p>
                        <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                            <li className="flex gap-1.5 items-start text-left">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">1</span>
                                <span>Check if the document number and dates match the physical file.</span>
                            </li>
                            <li className="flex gap-1.5 items-start text-left">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">2</span>
                                <span>Update the form fields if there was a typo.</span>
                            </li>
                            <li className="flex gap-1.5 items-start text-left">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">3</span>
                                <span>If the data is correct, you can choose to "Force Upload".</span>
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Field Validation Errors (Zod) */}
            {zodErrors && Array.isArray(zodErrors) && (
                <div className="bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase tracking-tight">Configuration Issues:</p>
                    <div className="grid gap-1.5">
                        {zodErrors.map((err: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] text-red-700 dark:text-red-400">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span className="font-medium capitalize">{err.path?.join(' ') || 'Field'}:</span>
                                <span>{err.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

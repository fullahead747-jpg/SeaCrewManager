import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle, Edit3, RotateCcw, Shield, ShieldAlert, Target } from "lucide-react";

export interface FieldComparison {
    field: string;
    existingValue: string | null;
    extractedValue: string | null;
    matches: boolean;
    similarity: number; // 0-100
    displayName: string;
    isEditable: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
}

export interface ProfileComparison {
    personal: FieldComparison[];
    nok: FieldComparison[];
    hasChanges: boolean;
}

export interface VerificationResult {
    isValid: boolean;
    matchScore: number;
    fieldComparisons: FieldComparison[];
    warnings: string[];
    extractedData: any;
    profileComparison?: ProfileComparison;
    allowManualCorrection: boolean;
    ocrConfidence: number;
    // Phase 3: Advanced Features
    forgeryAnalysis?: {
        riskScore: number;
        riskLevel: 'low' | 'medium' | 'high';
        warnings: string[];
    };
    fieldAlignment?: {
        overallConfidence: number;
        alignmentScore: number;
        lowConfidenceFields: string[];
        suggestions: string[];
    };
}

interface VerificationResultsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    verificationResult: VerificationResult | null;
    onProceed: (manualCorrections?: Record<string, string>) => void;
    onCancel: () => void;
}

export function VerificationResultsDialog({
    open,
    onOpenChange,
    verificationResult,
    onProceed,
    onCancel
}: VerificationResultsDialogProps) {
    const [editedValues, setEditedValues] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (open) {
            setEditedValues({});
            setIsEditing({});
        }
    }, [open]);

    if (!verificationResult) return null;

    const handleFieldEdit = (field: string, value: string) => {
        setEditedValues(prev => ({ ...prev, [field]: value }));
    };

    const toggleEditing = (field: string) => {
        setIsEditing(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const resetField = (field: string) => {
        const newEdited = { ...editedValues };
        delete newEdited[field];
        setEditedValues(newEdited);
        setIsEditing(prev => ({ ...prev, [field]: false }));
    };

    const hasEdits = Object.keys(editedValues).length > 0;

    const getMatchIcon = (similarity: number) => {
        if (similarity >= 90) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
        if (similarity >= 70) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
        return <XCircle className="h-4 w-4 text-red-600" />;
    };

    const getMatchColor = (similarity: number) => {
        if (similarity >= 90) return "text-green-700 bg-green-50";
        if (similarity >= 70) return "text-yellow-700 bg-yellow-50";
        return "text-red-700 bg-red-50";
    };

    const getConfidenceBadge = (level: string) => {
        switch (level) {
            case 'high': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">High Confidence</Badge>;
            case 'medium': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">Medium Confidence</Badge>;
            case 'low': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Low Confidence</Badge>;
            default: return null;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return "bg-gradient-to-r from-green-500 to-green-600 text-white";
        if (score >= 70) return "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white";
        return "bg-gradient-to-r from-red-500 to-red-600 text-white";
    };

    const renderComparisonSection = (title: string, comparisons: FieldComparison[]) => {
        if (!comparisons || comparisons.length === 0) return null;

        const hasAnyChange = comparisons.some(c => !c.matches && c.extractedValue && c.extractedValue !== 'NONE');

        return (
            <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                    {!hasAnyChange ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            No Changes
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 font-medium">
                            Update Detected
                        </Badge>
                    )}
                </div>
                <div className="space-y-3">
                    {comparisons.map((comparison, index) => {
                        const isNone = !comparison.extractedValue || comparison.extractedValue === 'NONE';
                        const showMismatch = !comparison.matches && !isNone;

                        return (
                            <div
                                key={index}
                                className={`px-4 py-3 rounded-xl border transition-all ${showMismatch ? 'border-blue-200 bg-blue-50/20 ring-1 ring-blue-100' : 'border-gray-100 bg-gray-50/30'}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        {comparison.displayName}
                                    </span>
                                    {comparison.matches ? (
                                        <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">
                                            No Change
                                        </span>
                                    ) : isNone ? (
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                                            Not Found
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase animate-pulse">
                                            New Data Available
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-6 items-center">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-gray-400 font-medium">Current Record</p>
                                        <p className="text-sm text-gray-600 truncate font-medium">
                                            {comparison.existingValue || '---'}
                                        </p>
                                    </div>
                                    <div className={`space-y-1 ${showMismatch ? 'scale-105 transform origin-left transition-all' : ''}`}>
                                        <p className="text-[10px] text-gray-400 font-medium">Scanned Value</p>
                                        <p className={`text-sm font-bold truncate ${showMismatch ? 'text-blue-700' : 'text-gray-600'}`}>
                                            {comparison.extractedValue || '---'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        {verificationResult.isValid ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : (
                            <AlertCircle className="h-6 w-6 text-orange-600" />
                        )}
                        <span>Document Verification Results</span>
                    </DialogTitle>
                    <DialogDescription>
                        {verificationResult.isValid
                            ? "The uploaded document matches the existing record."
                            : "Some fields in the uploaded document do not match the existing record."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Overall Match Score */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Overall Match Score</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Based on weighted comparison of all fields
                            </p>
                        </div>
                        <Badge className={`${getScoreColor(verificationResult.matchScore)} px-4 py-2 text-lg font-bold rounded-full shadow-sm`}>
                            {verificationResult.matchScore}%
                        </Badge>
                    </div>

                    {/* Phase 3: Forgery Detection */}
                    {verificationResult.forgeryAnalysis && (
                        <div className={`p-4 rounded-lg border-2 ${verificationResult.forgeryAnalysis.riskLevel === 'low'
                                ? 'bg-green-50 border-green-200'
                                : verificationResult.forgeryAnalysis.riskLevel === 'medium'
                                    ? 'bg-yellow-50 border-yellow-200'
                                    : 'bg-red-50 border-red-200'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    {verificationResult.forgeryAnalysis.riskLevel === 'low' ? (
                                        <Shield className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <ShieldAlert className="h-5 w-5 text-red-600" />
                                    )}
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Security Analysis</p>
                                        <p className="text-xs text-gray-600 mt-0.5">
                                            Document authenticity verification
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge className={`${verificationResult.forgeryAnalysis.riskLevel === 'low'
                                            ? 'bg-green-600'
                                            : verificationResult.forgeryAnalysis.riskLevel === 'medium'
                                                ? 'bg-yellow-600'
                                                : 'bg-red-600'
                                        } text-white px-3 py-1 text-xs font-bold uppercase`}>
                                        {verificationResult.forgeryAnalysis.riskLevel} Risk
                                    </Badge>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Score: {verificationResult.forgeryAnalysis.riskScore}/100
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Phase 3: Field Alignment */}
                    {verificationResult.fieldAlignment && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <Target className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">Field Confidence Analysis</p>
                                        <p className="text-xs text-gray-600 mt-0.5">
                                            Multi-engine OCR agreement
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Overall Confidence</p>
                                        <p className="text-lg font-bold text-blue-700">
                                            {verificationResult.fieldAlignment.overallConfidence}%
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Alignment Score</p>
                                        <p className="text-lg font-bold text-blue-700">
                                            {verificationResult.fieldAlignment.alignmentScore}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {verificationResult.fieldAlignment.suggestions.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                    <p className="text-xs font-semibold text-blue-900 mb-2">Recommendations:</p>
                                    <ul className="space-y-1">
                                        {verificationResult.fieldAlignment.suggestions.slice(0, 3).map((suggestion, idx) => (
                                            <li key={idx} className="text-xs text-blue-800">
                                                • {suggestion}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Field Comparisons */}
                    {verificationResult.fieldComparisons.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-900 font-inter">Field Comparison</h4>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    OCR Confidence: {verificationResult.ocrConfidence}%
                                </Badge>
                            </div>
                            <div className="space-y-3">
                                {verificationResult.fieldComparisons.map((comparison, index) => {
                                    const isEdited = editedValues[comparison.field] !== undefined;
                                    const currentValue = isEdited ? editedValues[comparison.field] : (comparison.extractedValue || '');
                                    const matchesAfterEdit = isEdited ? (currentValue === (comparison.existingValue || '')) : comparison.matches;

                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 rounded-xl border transition-all ${matchesAfterEdit ? 'border-green-100 bg-green-50/20' : 'border-orange-100 bg-orange-50/20'} ${isEdited ? 'ring-2 ring-blue-400 border-blue-200 shadow-md' : 'shadow-sm'}`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center space-x-2">
                                                    {getMatchIcon(comparison.similarity)}
                                                    <span className="font-bold text-sm text-gray-900 tracking-tight">
                                                        {comparison.displayName}
                                                    </span>
                                                    {getConfidenceBadge(comparison.confidenceLevel)}
                                                    {isEdited && (
                                                        <Badge className="bg-blue-600 text-white animate-pulse shadow-sm">
                                                            Manually Corrected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Badge className={`${getMatchColor(comparison.similarity)} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider`}>
                                                        {comparison.similarity}% match
                                                    </Badge>
                                                    {comparison.isEditable && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`h-7 w-7 rounded-full ${isEdited ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-blue-600'}`}
                                                            onClick={() => toggleEditing(comparison.field)}
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {isEdited && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 rounded-full text-orange-600 bg-orange-50 hover:bg-orange-100"
                                                            onClick={() => resetField(comparison.field)}
                                                            title="Reset to original"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6 text-sm">
                                                <div className="space-y-1.5 opacity-80">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Database Record</p>
                                                    <p className="font-mono text-gray-700 bg-white/60 px-3 py-2 rounded-lg border border-gray-100 shadow-inner truncate">
                                                        {comparison.existingValue || '---'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Scanned Value</p>
                                                    {isEditing[comparison.field] ? (
                                                        <Input
                                                            value={currentValue}
                                                            onChange={(e) => handleFieldEdit(comparison.field, e.target.value)}
                                                            className="h-9 text-sm font-mono border-blue-300 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                                            autoFocus
                                                            onBlur={() => toggleEditing(comparison.field)}
                                                            onKeyDown={(e) => e.key === 'Enter' && toggleEditing(comparison.field)}
                                                        />
                                                    ) : (
                                                        <p
                                                            className={`font-mono px-3 py-2 rounded-lg border shadow-inner truncate flex items-center justify-between group cursor-pointer ${isEdited ? 'bg-blue-50 border-blue-200 text-blue-900 font-extrabold' : 'bg-white border-gray-100 text-gray-900'}`}
                                                            onClick={() => comparison.isEditable && toggleEditing(comparison.field)}
                                                        >
                                                            <span>{currentValue || '---'}</span>
                                                            {comparison.isEditable && (
                                                                <Edit3 className="h-3 w-3 text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            )}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Profile Comparison */}
                    {verificationResult.profileComparison && (
                        <>
                            {renderComparisonSection("Seafarer Profile Review", verificationResult.profileComparison.personal)}
                            {renderComparisonSection("Next of Kin (NOK) Review", verificationResult.profileComparison.nok)}
                        </>
                    )}

                    {/* Warnings */}
                    {verificationResult.warnings.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
                            <div className="flex items-start space-x-2">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-orange-900 mb-2">Warnings</h4>
                                    <ul className="space-y-1">
                                        {verificationResult.warnings.map((warning, index) => (
                                            <li key={index} className="text-sm text-orange-800">
                                                • {warning}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex space-x-2">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="flex-1"
                    >
                        Cancel Upload
                    </Button>
                    <Button
                        onClick={() => onProceed(editedValues)}
                        disabled={!verificationResult.isValid && !verificationResult.allowManualCorrection && !hasEdits}
                        className={`flex-1 h-14 text-lg font-black shadow-xl rounded-2xl transition-all active:scale-95 ${hasEdits
                            ? 'bg-blue-600 hover:bg-blue-700 ring-4 ring-blue-100'
                            : (verificationResult.isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600')
                            } text-white`}
                    >
                        {hasEdits
                            ? `Approve with ${Object.keys(editedValues).length} Correction${Object.keys(editedValues).length > 1 ? 's' : ''}`
                            : (verificationResult.isValid
                                ? (verificationResult.profileComparison?.hasChanges ? 'Approve & Update Profile' : 'Confirm & Proceed')
                                : 'Proceed with Warnings')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

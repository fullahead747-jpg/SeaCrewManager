import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera, Upload, FileText, CheckCircle, AlertCircle, Sparkles, X, Scan, Users, Trash2, Eye, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useExtractedRecords, ExtractedCrewRecord } from "@/contexts/extracted-records-context";

interface ExtractedCrewData {
  name?: string;
  position?: string;
  nationality?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  seamansBookNumber?: string;
  cdcNumber?: string;
  phoneNumber?: string;
  email?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  joinDate?: string;
  leaveDate?: string;
  vessel?: string;
  salary?: string;
  shipOwnerName?: string;
  shipOwnerContactPerson?: string;
  shipOwnerPostalAddress?: string;
  seafarerName?: string;
  seafarerRank?: string;
  capacityRankEmployed?: string;
  seafarerNationality?: string;
  seafarerDatePlaceOfBirth?: string;
  seafarerIndosNumber?: string;
  seafarerPostalAddress?: string;
  seafarerEmail?: string;
  seafarerMobile?: string;
  cdcPlaceOfIssue?: string;
  cdcIssueDate?: string;
  cdcExpiryDate?: string;
  passportPlaceOfIssue?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  nokName?: string;
  nokRelationship?: string;
  nokEmail?: string;
  nokTelephone?: string;
  nokPostalAddress?: string;
  cocGradeNo?: string;
  cocPlaceOfIssue?: string;
  cocIssueDate?: string;
  cocExpiryDate?: string;
  medicalIssuingAuthority?: string;
  medicalApprovalNo?: string;
  medicalIssueDate?: string;
  medicalExpiryDate?: string;
  shipName?: string;
  engagementPeriodMonths?: number;
  recordId?: string;
  displayName?: string;
  scannedFile?: File;
}

interface OCRDocumentScannerProps {
  onDataExtracted: (data: ExtractedCrewData) => void;
  className?: string;
  mode?: 'crew' | 'shipOwner' | 'seafarer';
}

export function OCRDocumentScanner({ onDataExtracted, className, mode = 'crew' }: OCRDocumentScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCrewData | null>(null);
  const [editableData, setEditableData] = useState<ExtractedCrewData | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRecordSelector, setShowRecordSelector] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { records, addRecord, getRecord, removeRecord, isRecordUsed, markRecordAsUsed } = useExtractedRecords();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError("Please select an image file (JPG, PNG) or PDF document.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB.");
      return;
    }

    await processDocument(file);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError("Please select an image file (JPG, PNG) or PDF document.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB.");
      return;
    }

    await processDocument(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processDocument = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setExtractedData(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScannedFile(file);

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch('/api/ocr/extract-crew-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          image: base64,
          filename: file.name
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const data = await response.json();
      const record = addRecord(data);
      const fullData = { ...data, recordId: record.recordId, displayName: record.displayName, scannedFile: file };
      setExtractedData(fullData);
      setEditableData(fullData); // Initialize editable data

      toast({
        title: "Document Scanned Successfully",
        description: `Extracted data for ${record.displayName}. Please review and confirm.`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process document";
      setError(errorMessage);
      setPreviewUrl(null);
      setScannedFile(null);
      toast({
        title: "Processing Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleConfirmData = () => {
    if (editableData) {
      if (editableData.recordId) {
        markRecordAsUsed(editableData.recordId);
      }
      onDataExtracted(editableData); // Use edited data
      resetDialog();

      toast({
        title: "Data Confirmed",
        description: "Extracted information has been saved to the system.",
        duration: 3000,
      });
    }
  };

  const handleSelectSavedRecord = () => {
    if (selectedRecordId) {
      const record = getRecord(selectedRecordId);
      if (record) {
        markRecordAsUsed(record.recordId);
        onDataExtracted({ ...record.data, recordId: record.recordId, displayName: record.displayName });
        resetDialog();

        toast({
          title: "Data Applied",
          description: `Applied data for ${record.displayName}.`,
        });
      }
    }
  };

  const handleRemoveRecord = (recordId: string) => {
    removeRecord(recordId);
    if (selectedRecordId === recordId) {
      setSelectedRecordId('');
    }
    toast({
      title: "Record Removed",
      description: "The extracted record has been removed.",
    });
  };

  const availableRecords = records.filter(r => !isRecordUsed(r.recordId));

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'shipOwner':
        return 'Scan Ship Owner Document';
      case 'seafarer':
        return 'Scan Seafarer Document';
      default:
        return 'Scan Crew Document';
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'shipOwner':
        return 'ship owner';
      case 'seafarer':
        return 'seafarer';
      default:
        return 'crew';
    }
  };

  const getDemoData = (): ExtractedCrewData => {
    switch (mode) {
      case 'shipOwner':
        return {
          shipOwnerName: "GLOBAL CAMBAYMARINE SERVICES PVT. LTD",
          shipOwnerContactPerson: "MR. ZOHAR A MALAMPATTIWALA",
          shipOwnerPostalAddress: "3/684, HUSSAINI VILLA, NAVAPURAKARWA ROAD, SURAT, SURAT-395003, GUJRAT, INDIA - GCMSPL@GMAIL.COM"
        };
      case 'seafarer':
        return {
          seafarerName: "VINEET KUMAR",
          seafarerNationality: "INDIAN",
          seafarerDatePlaceOfBirth: "09-MAR-1982 & ROHTAS-BIHAR",
          seafarerIndosNumber: "07NL1441",
          seafarerPostalAddress: "FLT. NO. 105 MAURA ENCLAVE VIJAY VIHAR COLONY, NEAR RPS LAW COLLAGE",
          seafarerEmail: "vineetkmr65@gmail.com",
          seafarerMobile: "09987291454",
          cdcNumber: "MUM 132798",
          cdcPlaceOfIssue: "MUMBAI",
          cdcIssueDate: "28-MAR-2025",
          cdcExpiryDate: "27-MAR-2035",
          passportNumber: "R2826385",
          passportPlaceOfIssue: "PATNA",
          passportIssueDate: "04-JUL-2017",
          passportExpiryDate: "03-JUL-2027",
          nokName: "MRS. BINITA KUMARI",
          nokRelationship: "WIFE",
          nokTelephone: "8538955893",
          nokPostalAddress: "102, MOURA ENCLAVE, VIJAY VIHAR COLONY, NEAR RPS LAW COLLAGE PATNA, BIHAR, PIN-801503",
          cocGradeNo: "MASTER (F.G.) / 23-MUM-2024",
          cocPlaceOfIssue: "MUMBAI",
          cocIssueDate: "15-JAN-2024",
          cocExpiryDate: "14-JAN-2029",
          medicalIssuingAuthority: "DR. DIWAKAR TIWARI (GLOBUS MEDICARE)",
          medicalApprovalNo: "MAH/NM/22/2015",
          medicalIssueDate: "15-JAN-2025",
          medicalExpiryDate: "14-JAN-2027",
          shipName: "AQUA TOW"
        };
      default:
        return {
          name: "Maria Santos",
          position: "Second Officer",
          nationality: "Philippines",
          dateOfBirth: "12/08/1990",
          phoneNumber: "+63 917 123 4567",
          contractStartDate: "15/01/2024",
          contractEndDate: "15/01/2025",
          shipOwnerName: "Offing Marine Services Ltd",
          shipOwnerContactPerson: "John Smith",
          shipOwnerPostalAddress: "123 Harbor Street, Singapore 048693"
        };
    }
  };

  const filterExtractedData = (data: ExtractedCrewData): { key: string; value: string }[] => {
    const entries = Object.entries(data).filter(([key, value]) => {
      if (!value) return false;
      if (key === 'shipOwnerPostalAddress') return false;
      if (key === 'scannedFile') return false;
      if (key === 'recordId') return false;
      if (key === 'displayName') return false;

      switch (mode) {
        case 'shipOwner':
          return key.startsWith('shipOwner');
        case 'seafarer':
          return key.startsWith('seafarer') || key.startsWith('cdc') || key.startsWith('passport') || key.startsWith('nok') || key.startsWith('coc') || key.startsWith('medical') || key.startsWith('ship') || key === 'capacityRankEmployed';
        default:
          return true;
      }
    });

    const result = entries.map(([key, value]) => ({
      key,
      value: value as string
    }));

    result.sort((a, b) => {
      const priorityOrder = ['seafarerName', 'seafarerRank', 'capacityRankEmployed', 'seafarerNationality'];
      const aIndex = priorityOrder.indexOf(a.key);
      const bIndex = priorityOrder.indexOf(b.key);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });

    return result;
  };

  const formatFieldLabel = (key: string): string => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const resetDialog = () => {
    setIsOpen(false);
    setExtractedData(null);
    setEditableData(null);
    setScannedFile(null);
    setPreviewUrl(null);
    setError(null);
    setZoomLevel(1);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`group relative overflow-hidden border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all duration-300 ${className}`}
          data-testid="ocr-scan-button"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <Scan className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
          <span className="relative">Scan Document</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-7xl max-h-[90vh] p-0 flex flex-col bg-gradient-to-br from-background via-background to-muted/20 border-0 shadow-2xl">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

        <DialogHeader className="relative px-6 pt-6 pb-4 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <FileText className="h-5 w-5 text-primary" />
              </motion.div>
              <div>
                <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  {getModeTitle()}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  AI-powered document extraction with preview
                </p>
              </div>
            </div>
            {previewUrl && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                  disabled={zoomLevel <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
                  disabled={zoomLevel >= 2}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Upload/Results */}
          <div className={`${previewUrl ? 'w-1/2 border-r border-border/50' : 'w-full'} flex flex-col transition-all duration-300`}>
            <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">
              {availableRecords.length > 0 && !isProcessing && !extractedData && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 border border-blue-500/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-1">
                        Saved Crew Records ({availableRecords.length})
                      </h4>
                      <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mb-3">
                        Previously scanned records are available. Select one to apply or scan a new document.
                      </p>
                      <div className="space-y-2">
                        <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
                          <SelectTrigger className="bg-background" data-testid="saved-record-select">
                            <SelectValue placeholder="Choose a saved record..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRecords.map((record) => (
                              <SelectItem key={record.recordId} value={record.recordId}>
                                {record.displayName} - {new Date(record.extractedAt).toLocaleTimeString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!selectedRecordId}
                            onClick={handleSelectSavedRecord}
                            className="flex-1"
                            data-testid="apply-saved-record-btn"
                          >
                            Apply Selected Record
                          </Button>
                          {selectedRecordId && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveRecord(selectedRecordId)}
                              data-testid="remove-saved-record-btn"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {!isProcessing && !extractedData && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <motion.div
                      className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 ${isDragging
                        ? 'border-primary bg-primary/5 scale-[1.02]'
                        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="p-8 text-center">
                        <motion.div
                          className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 border border-primary/20"
                          animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          <Upload className={`h-7 w-7 transition-colors ${isDragging ? 'text-primary' : 'text-primary/70'}`} />
                        </motion.div>

                        <h3 className="font-medium text-lg mb-1">Drop your document here</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          or click to browse files
                        </p>

                        <div className="flex items-center justify-center gap-3">
                          <Button
                            variant="default"
                            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
                            onClick={() => fileInputRef.current?.click()}
                            data-testid="upload-option"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Browse Files
                          </Button>
                          <Button
                            variant="outline"
                            className="border-2"
                            onClick={handleTakePhoto}
                            data-testid="camera-option"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Take Photo
                          </Button>
                        </div>

                        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                          <span className="px-2 py-1 rounded-full bg-muted/50">JPG</span>
                          <span className="px-2 py-1 rounded-full bg-muted/50">PNG</span>
                          <span className="px-2 py-1 rounded-full bg-muted/50">PDF</span>
                          <span className="text-muted-foreground/50">•</span>
                          <span>Max 10MB</span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      className="relative p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200 mb-1">
                            Demo Mode Available
                          </h4>
                          <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mb-3">
                            Test the AI extraction with sample {getModeDescription()} data
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            onClick={() => {
                              const demoData = getDemoData();
                              setExtractedData(demoData);
                              setEditableData(demoData); // Initialize editable data for demo mode
                              toast({
                                title: "Demo Data Generated",
                                description: `Sample ${getModeDescription()} details loaded for testing.`,
                              });
                            }}
                            data-testid="demo-mode-button"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Try Demo Mode
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {isProcessing && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="py-12 text-center"
                  >
                    <div className="relative mx-auto w-20 h-20 mb-6">
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-primary/20"
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Scan className="h-8 w-8 text-primary" />
                      </div>
                    </div>

                    <h3 className="font-medium text-lg mb-2">Analyzing Document</h3>
                    <p className="text-sm text-muted-foreground">
                      AI is extracting information from your document...
                    </p>

                    <motion.div
                      className="mt-6 flex items-center justify-center gap-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-primary"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20"
                    data-testid="error-alert"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-destructive mb-1">Processing Failed</h4>
                        <p className="text-sm text-destructive/80">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {extractedData && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <motion.div
                      className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/10 border border-emerald-500/20"
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      data-testid="success-alert"
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2 rounded-lg bg-emerald-500/20"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, delay: 0.1 }}
                        >
                          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </motion.div>
                        <div>
                          <h4 className="font-medium text-emerald-800 dark:text-emerald-200">
                            Extraction Complete
                          </h4>
                          <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80">
                            Successfully extracted {getModeDescription()} details - Please review and confirm
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {extractedData && !extractedData.name && !extractedData.seafarerName && Object.keys(extractedData).length > 0 && mode === 'crew' && (
                      <motion.div
                        className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <span className="font-medium text-amber-700 dark:text-amber-300">Note:</span>
                        <span className="text-amber-600 dark:text-amber-400 ml-1">
                          Employee name was not detected. You'll need to enter it manually.
                        </span>
                      </motion.div>
                    )}

                    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50">
                      <div className="px-4 py-3 bg-muted/30 border-b border-border/50">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Extracted Information
                        </h4>
                      </div>

                      <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
                        {filterExtractedData(extractedData).map(({ key, value }, index) => (
                          <motion.div
                            key={key}
                            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <label className="text-sm font-medium text-muted-foreground min-w-[180px]">
                              {formatFieldLabel(key)}
                            </label>
                            <input
                              type="text"
                              value={editableData?.[key as keyof ExtractedCrewData] as string || ''}
                              onChange={(e) => {
                                if (editableData) {
                                  setEditableData({
                                    ...editableData,
                                    [key]: e.target.value
                                  });
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-sm bg-background border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                              placeholder={`Enter ${formatFieldLabel(key).toLowerCase()}`}
                            />
                          </motion.div>
                        ))}
                      </div>

                      {filterExtractedData(extractedData).length === 0 && (
                        <div className="p-6 text-center text-muted-foreground">
                          <p className="text-sm">
                            No information could be extracted. Please try a clearer image.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="file-input"
              />
            </div>
          </div>

          {/* Right Panel - Document Preview */}
          <AnimatePresence>
            {previewUrl && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="w-1/2 flex flex-col bg-muted/10"
              >
                <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">Document Preview</h4>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={scannedFile?.name}>
                    {scannedFile?.name}
                  </p>
                </div>
                <div className="flex-1 overflow-hidden relative bg-muted/5">
                  <div className="absolute inset-0 overflow-auto p-4 custom-scrollbar">
                    <motion.div
                      className="relative rounded-lg shadow-2xl border border-border/50 bg-white mx-auto origin-top"
                      style={{
                        width: scannedFile?.type === 'application/pdf' ? '100%' : 'auto',
                        height: scannedFile?.type === 'application/pdf' ? 'calc(100% - 4px)' : 'auto',
                        transform: scannedFile?.type === 'application/pdf' ? 'none' : `scale(${zoomLevel})`
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      {scannedFile?.type === 'application/pdf' ? (
                        <iframe
                          src={`${previewUrl}#toolbar=1&view=FitH`}
                          className="w-full h-full min-h-[700px] border-0"
                          title="PDF Preview"
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Scanned document"
                          className="max-w-full h-auto"
                        />
                      )}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {extractedData && filterExtractedData(extractedData).length > 0 && (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                {filterExtractedData(extractedData).length} fields extracted
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={resetDialog}
              data-testid="cancel-ocr"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <AnimatePresence>
              {extractedData && filterExtractedData(extractedData).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Button
                    onClick={handleConfirmData}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-500/20 text-white"
                    data-testid="confirm-extracted-data"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Save
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

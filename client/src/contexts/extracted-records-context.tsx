import { createContext, useContext, useState, useCallback } from 'react';

export interface ExtractedCrewRecord {
  recordId: string;
  displayName: string;
  extractedAt: Date;
  data: {
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
  };
}

interface ExtractedRecordsContextType {
  records: ExtractedCrewRecord[];
  addRecord: (data: any) => ExtractedCrewRecord;
  getRecord: (recordId: string) => ExtractedCrewRecord | undefined;
  removeRecord: (recordId: string) => void;
  clearRecords: () => void;
  usedRecordIds: Set<string>;
  markRecordAsUsed: (recordId: string) => void;
  isRecordUsed: (recordId: string) => boolean;
}

const ExtractedRecordsContext = createContext<ExtractedRecordsContextType | null>(null);

export function ExtractedRecordsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<ExtractedCrewRecord[]>([]);
  const [usedRecordIds, setUsedRecordIds] = useState<Set<string>>(new Set());

  const addRecord = useCallback((data: any): ExtractedCrewRecord => {
    const recordId = data.recordId || `crew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const displayName = data.displayName || data.seafarerName || data.name || 'Unknown Crew Member';
    
    const newRecord: ExtractedCrewRecord = {
      recordId,
      displayName,
      extractedAt: new Date(),
      data: { ...data }
    };

    setRecords(prev => {
      const existing = prev.find(r => r.recordId === recordId);
      if (existing) {
        return prev.map(r => r.recordId === recordId ? newRecord : r);
      }
      return [...prev, newRecord];
    });

    return newRecord;
  }, []);

  const getRecord = useCallback((recordId: string): ExtractedCrewRecord | undefined => {
    return records.find(r => r.recordId === recordId);
  }, [records]);

  const removeRecord = useCallback((recordId: string) => {
    setRecords(prev => prev.filter(r => r.recordId !== recordId));
    setUsedRecordIds(prev => {
      const next = new Set(prev);
      next.delete(recordId);
      return next;
    });
  }, []);

  const clearRecords = useCallback(() => {
    setRecords([]);
    setUsedRecordIds(new Set());
  }, []);

  const markRecordAsUsed = useCallback((recordId: string) => {
    setUsedRecordIds(prev => new Set(prev).add(recordId));
  }, []);

  const isRecordUsed = useCallback((recordId: string): boolean => {
    return usedRecordIds.has(recordId);
  }, [usedRecordIds]);

  return (
    <ExtractedRecordsContext.Provider value={{
      records,
      addRecord,
      getRecord,
      removeRecord,
      clearRecords,
      usedRecordIds,
      markRecordAsUsed,
      isRecordUsed
    }}>
      {children}
    </ExtractedRecordsContext.Provider>
  );
}

export function useExtractedRecords() {
  const context = useContext(ExtractedRecordsContext);
  if (!context) {
    throw new Error('useExtractedRecords must be used within an ExtractedRecordsProvider');
  }
  return context;
}

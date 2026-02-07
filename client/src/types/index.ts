export interface DashboardStats {
  activeCrew: number;
  activeVessels: number;
  pendingActions: number;
  crewOnShore: number;
  complianceRate: number;
  totalContracts: number;
  totalDocuments: number;
  signOffDue: number;
  signOffDue30Days: number;
  signOffDue15Days: number;
}

export interface UpcomingEvent {
  id: string;
  type: 'contract_renewal' | 'crew_change' | 'training' | 'document_expiry';
  title: string;
  description: string;
  date: Date;
  severity: 'low' | 'medium' | 'high';
  crewMemberId?: string;
  vesselId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'join' | 'leave' | 'training' | 'other';
  crewMemberId: string;
  vesselId: string;
  description?: string;
}

export interface FileUploadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

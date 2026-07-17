import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Ship, Printer, AlertTriangle, Clock, User, Mail, Loader2, LayoutGrid, LayoutList, Eye, FileDown, PenLine, Download, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { CrewDetailCard } from '@/components/crew/crew-detail-card';
import EditCrewForm from '@/components/crew/edit-crew-form';
import { CrewMemberWithDetails, Document } from '@shared/schema';
import { downloadFileFromResponse } from '@/lib/file-utils';

interface ContractEvent {
  id: string;
  status: 'overdue' | 'critical' | 'upcoming' | 'attention' | 'stable';
  date: Date | null;
  crewMemberId: string;
  crewMemberName: string;
  crewRank: string;
  vesselId: string | null;
  vesselName: string;
  contractId: string | null;
  contractEndDate: Date | null;
  daysUntilExpiry: number | null;
  hasNoContract: boolean;
}

export default function Scheduling() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ContractEvent[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendToAdditional, setSendToAdditional] = useState(false);
  const [additionalEmail, setAdditionalEmail] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('grid');

  // Logic for the 4 action buttons
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMemberWithDetails | null>(null);

  // Delete crew state
  const [deleteCrewDialogOpen, setDeleteCrewDialogOpen] = useState(false);
  const [selectedCrewForDelete, setSelectedCrewForDelete] = useState<CrewMemberWithDetails | null>(null);

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    }
  });

  const sendCrewEmailMutation = useMutation({
    mutationFn: async (member: CrewMemberWithDetails) => {
      const response = await fetch('/api/email/send-crew-details', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewMemberId: member.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to send email' }));
        throw new Error(errorData.message || 'Failed to send email');
      }
      return response.json();
    },
    onSuccess: () => toast({ title: 'Email Sent', description: 'Crew update email has been sent successfully.' }),
    onError: (error: any) => toast({ title: 'Email Failed', description: error.message, variant: 'destructive' }),
  });

  const deleteCrewMutation = useMutation({
    mutationFn: async (crewId: string) => {
      const response = await fetch(`/api/crew/${crewId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete crew member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setDeleteCrewDialogOpen(false);
      setSelectedCrewForDelete(null);
      toast({ title: 'Crew Member Deleted', description: 'The crew member has been permanently removed.' });
    },
    onError: (error: any) => toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' }),
  });

  const handleDeleteCrewClick = (member: CrewMemberWithDetails) => {
    setSelectedCrewForDelete(member);
    setDeleteCrewDialogOpen(true);
  };

  const handleDownloadCrewDocuments = async (crewId: string, crewName: string) => {
    try {
      const response = await fetch(`/api/crew/${crewId}/documents/download`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Download failed');
      await downloadFileFromResponse(response, `Documents_${crewName.replace(/\s+/g, '_')}.zip`);
    } catch (error) {
      toast({ title: 'Download Failed', description: 'Could not download documents zip.', variant: 'destructive' });
    }
  };

  const handleViewAction = (crewId: string) => {
    const member = crewMembers?.find((m: any) => m.id === crewId);
    if (member) {
      setSelectedCrewMember(member);
      setShowViewDialog(true);
    }
  };

  const handleEditAction = (crewId: string) => {
    const member = crewMembers?.find((m: any) => m.id === crewId);
    if (member) {
      setSelectedCrewMember(member);
      setShowEditDialog(true);
    }
  };

  const sendCalendarEmailMutation = useMutation({
    mutationFn: async (data: { month: string; events: ContractEvent[]; additionalEmail?: string }) => {
      const response = await apiRequest('POST', '/api/email/send-calendar-summary', data);
      return response.json();
    },
    onSuccess: (data) => {
      setEmailDialogOpen(false);
      setAdditionalEmail('');
      setSendToAdditional(false);
      toast({
        title: "Email Sent",
        description: data.message || "Calendar summary sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send calendar summary.",
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = () => {
    const monthStr = format(currentDate, 'MMMM yyyy');
    sendCalendarEmailMutation.mutate({
      month: monthStr,
      events: monthEvents.map(e => ({
        ...e,
        date: e.date!.toISOString(),
        contractEndDate: e.contractEndDate!.toISOString(),
      })) as any,
      additionalEmail: sendToAdditional && additionalEmail ? additionalEmail : undefined
    });
  };

  // Fetch crew for view/edit/delete dialogs (separate from scheduling events)
  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
    refetchInterval: 15000,
  });

  // Single source of truth: backend endpoint uses IDENTICAL logic as Fleet Dashboard getDashboardStats
  const { data: rawContractEvents = [], isLoading: contractsLoading } = useQuery<ContractEvent[]>({
    queryKey: ['/api/scheduling/contract-events'],
    queryFn: async () => {
      const response = await fetch('/api/scheduling/contract-events', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch scheduling events');
      const data = await response.json();
      // Parse ISO date strings to Date objects
      return data.map((e: any) => ({
        ...e,
        date: e.date ? new Date(e.date) : null,
        contractEndDate: e.contractEndDate ? new Date(e.contractEndDate) : null,
      }));
    },
    refetchInterval: 15000,
  });

  if (user?.role === 'crew') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-6">
            Crew members can view their schedule information on the dashboard.
          </p>
          <Button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-primary hover:bg-primary/90"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // contractEvents is now directly from the backend with dashboard-identical logic
  const contractEvents = rawContractEvents;



  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventsForDate = (date: Date) => {
    return contractEvents.filter(event => event.date && isSameDay(event.date, date));
  };

  const getEventColor = (status: string) => {
    switch (status) {
      case 'overdue': return 'bg-red-500';
      case 'critical': return 'bg-orange-500';
      case 'upcoming': return 'bg-yellow-500';
      case 'attention': return 'bg-blue-400';
      case 'stable': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'stable') return 'Not Due';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleDateClick = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setSelectedEvents(dayEvents);
    }
  };

  const previousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  // Get events for current month — overdue events with no date are always shown in the overdue bucket
  const monthEvents = contractEvents.filter(event => {
    if (!event.date) return true; // No-contract crew are always 'overdue', show in all months
    return isSameMonth(event.date, currentDate);
  });

  // Count stats matching dashboard thresholds exactly
  // Total overdue count across all time (not month-filtered) to match dashboard
  const totalOverdueCount = contractEvents.filter(e => e.status === 'overdue').length;
  const monthCriticalCount = monthEvents.filter(e => e.status === 'critical').length;
  const monthUpcomingCount = monthEvents.filter(e => e.status === 'upcoming').length;
  const monthAttentionCount = monthEvents.filter(e => e.status === 'attention').length;
  const thisMonthCount = monthEvents.length;

  return (
    <div className="space-y-6 px-4 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1" data-testid="scheduling-title">
            Contract Calendar
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            View upcoming contract due dates and expirations. Data displayed in this section pertains to the current month only.
          </p>
        </div>

        <div className="flex gap-2 print:hidden">
          {/* View Toggle removed: Only Grid view is used now */}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            className="h-9 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700"
            data-testid="mail-calendar-button"
          >
            <Mail className="h-4 w-4 mr-2" />
            Mail
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700"
            data-testid="print-calendar-button"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Quick Stats — synchronized with Fleet Dashboard thresholds */}
      <div className="flex flex-wrap items-center gap-y-4 py-2 print:hidden">
        <div className="flex items-center gap-4 pr-4 md:pr-8 border-r border-slate-100 dark:border-slate-800 last:border-0 grow md:grow-0">
          <div className="p-3 rounded-2xl bg-red-500/10 dark:bg-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-bold text-foreground leading-none">{totalOverdueCount}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overdue</span>
            </div>
            <div className="text-[11px] text-muted-foreground/80 font-medium mt-0.5">No/Expired Contract</div>
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 md:px-8 border-r border-slate-100 dark:border-slate-800 last:border-0 grow md:grow-0">
          <div className="p-3 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20">
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-bold text-foreground leading-none">{monthCriticalCount}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Critical</span>
            </div>
            <div className="text-[11px] text-muted-foreground/80 font-medium mt-0.5">&le; 15 Days Left</div>
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 md:px-8 border-r border-slate-100 dark:border-slate-800 last:border-0 grow md:grow-0">
          <div className="p-3 rounded-2xl bg-yellow-500/10 dark:bg-yellow-500/20">
            <Calendar className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-bold text-foreground leading-none">{monthUpcomingCount}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Upcoming</span>
            </div>
            <div className="text-[11px] text-muted-foreground/80 font-medium mt-0.5">16 - 30 Days Left</div>
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 md:px-8 border-r border-slate-100 dark:border-slate-800 last:border-0 grow md:grow-0">
          <div className="p-3 rounded-2xl bg-blue-400/10 dark:bg-blue-400/20">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-bold text-foreground leading-none">{monthAttentionCount}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attention</span>
            </div>
            <div className="text-[11px] text-muted-foreground/80 font-medium mt-0.5">31 - 45 Days Left</div>
          </div>
        </div>
      </div>

      {/* Legend — matching dashboard thresholds */}
      <div className="flex flex-wrap items-center gap-6 text-[11px] mb-2 print:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-red-500/20"></div>
          <span className="text-muted-foreground/80 font-medium">Overdue (No/Expired Contract)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-orange-500/20"></div>
          <span className="text-muted-foreground/80 font-medium">Critical (&le; 15 Days)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full ring-2 ring-yellow-500/20"></div>
          <span className="text-muted-foreground/80 font-medium">Upcoming (16-30 Days)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-blue-400 rounded-full ring-2 ring-blue-400/20"></div>
          <span className="text-muted-foreground/80 font-medium">Attention (31-45 Days)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-emerald-500/20"></div>
          <span className="text-muted-foreground/80 font-medium">Not Due (&gt; 45 Days)</span>
        </div>
      </div>

      {/* Content */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="flex flex-row items-center justify-between print:hidden">
          <CardTitle className="text-foreground">Contract Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {contractsLoading ? (
            <div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <div className="space-y-4 print-calendar-container">
              {/* Print Styles */}
              <style>{`
                @media print {
                  @page {
                    margin: 0.5in;
                    size: portrait;
                  }
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  /* Hide sidebar and navigation */
                  aside, nav, header, .sidebar, [class*="sidebar"], [class*="nav-"] {
                    display: none !important;
                  }
                  /* Reset main layout to full width centered */
                  main, .main-content, [class*="main"] {
                    margin-left: 0 !important;
                    padding-left: 0 !important;
                    width: 100% !important;
                  }
                  body > div {
                    display: block !important;
                  }
                  .print-calendar-container {
                    position: absolute !important;
                    left: 0 !important;
                    right: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                  }
                  .print-hide-btn {
                    display: none !important;
                  }
                  .print-report {
                    display: block !important;
                    margin-top: 200px;
                    padding-top: 100px;
                    clear: both;
                    position: relative;
                  }
                  .print-report .print-table {
                    page-break-inside: auto;
                  }
                  .print-report .print-table tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                  }
                  .print-report .print-section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1a365d;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e2e8f0;
                    background: white;
                  }
                  .print-report .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                  }
                  .print-report .print-table th {
                    background-color: #f7fafc;
                    font-weight: 600;
                    text-align: left;
                    padding: 8px 12px;
                    border: 1px solid #e2e8f0;
                    color: #1a365d;
                  }
                  .print-report .print-table td {
                    padding: 6px 12px;
                    border: 1px solid #e2e8f0;
                    color: #2d3748;
                  }
                  .print-report .print-table tr:nth-child(even) td {
                    background-color: #f7fafc;
                  }
                  .print-report .event-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 500;
                  }
                  .print-report .event-badge.overdue {
                    background-color: #fee2e2;
                    color: #991b1b;
                  }
                  .print-report .event-badge.critical {
                    background-color: #ffedd5;
                    color: #9a3412;
                  }
                  .print-report .event-badge.upcoming {
                    background-color: #fef9c3;
                    color: #854d0e;
                  }
                  .print-report .event-badge.attention {
                    background-color: #dbeafe;
                    color: #1e40af;
                  }
                  .print-footer {
                    margin-top: 20px;
                    padding-top: 8px;
                    border-top: 1px solid #e2e8f0;
                    font-size: 9px;
                    color: #718096;
                    text-align: center;
                  }
                  .print-no-events {
                    text-align: center;
                    padding: 20px;
                    color: #718096;
                    font-style: italic;
                    font-size: 12px;
                  }
                }
              `}</style>

              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm" onClick={previousMonth} data-testid="prev-month-button" className="print-hide-btn">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </Button>
                  <h3 className="text-base font-bold text-foreground" data-testid="current-month">
                    {format(currentDate, 'MMMM yyyy')}
                  </h3>
                  <Button variant="outline" size="sm" onClick={nextMonth} data-testid="next-month-button" className="print-hide-btn">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Button>
                </div>
              </div>

              {/* Conditional View Rendering */}
              <div className="bg-card rounded-lg border border-border">
                {/* Week Headers */}
                <div className="grid grid-cols-7 border-b border-border">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/30"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dayEvents = getEventsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toString()}
                        className={cn(
                          'min-h-[80px] p-2 border-r border-b border-border hover:bg-muted/50 cursor-pointer transition-colors',
                          !isCurrentMonth && 'bg-muted/10 text-muted-foreground/40',
                          isToday && 'bg-primary/5 text-primary'
                        )}
                        onClick={() => handleDateClick(day)}
                        data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                      >
                        <div className={cn(
                          'text-[11px] font-semibold mb-1 text-muted-foreground/80',
                          isToday && 'text-primary font-bold',
                          !isCurrentMonth && 'text-muted-foreground/30'
                        )}>
                          {format(day, 'd')}
                        </div>

                        {/* Event Indicators */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full shadow-sm',
                                getEventColor(event.status)
                              )}
                              title={`${event.status.charAt(0).toUpperCase() + event.status.slice(1)} Contract (${event.daysUntilExpiry} days left)`}
                              data-testid={`event-indicator-${event.id}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Crew Details for Print - Only shows when there are events */}
              {monthEvents.length > 0 && (
                <div className="hidden print:block print-report">
                  <h4 className="print-section-title">
                    Crew Contract Events - {format(currentDate, 'MMMM yyyy')}
                  </h4>

                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Crew Member</th>
                        <th>Rank</th>
                        <th>Vessel</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthEvents]
                        .sort((a, b) => {
                          // Null dates (no contract) go to the top
                          if (!a.date && !b.date) return 0;
                          if (!a.date) return -1;
                          if (!b.date) return 1;
                          return a.date.getTime() - b.date.getTime();
                        })
                        .map((event) => (
                        <tr key={event.id}>
                          <td>{event.crewMemberName}</td>
                          <td>{event.crewRank}</td>
                          <td>{event.vesselName}</td>
                          <td>
                            <span className={`event-badge ${event.status}`}>
                              {getStatusLabel(event.status)}
                            </span>
                          </td>
                          <td>{event.date ? format(event.date, 'MMM d, yyyy') : 'No Contract'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="print-footer">
                    Generated on {format(new Date(), 'MMMM d, yyyy')} | Total Events: {monthEvents.length}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Modal */}
      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 font-medium">
              <Calendar className="h-5 w-5 text-primary" />
              <span>
                Events — {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
              </span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Showing events falling within {format(currentDate, 'MMMM yyyy')} only.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No events on this date</p>
            ) : (
              selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "p-4 pr-3 border rounded-xl shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 border-border"
                  )}
                  data-testid={`modal-event-${event.id}`}
                >
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1.5",
                    event.status === 'overdue' ? "bg-red-500" :
                      event.status === 'critical' ? "bg-orange-500" :
                        event.status === 'upcoming' ? "bg-yellow-500" : "bg-blue-500"
                  )} />
                  <div className="pl-1.5">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-foreground text-base">
                        {event.hasNoContract ? 'No Active Contract' : `${getStatusLabel(event.status)} Contract`}
                      </h4>
                      <Badge className={cn(
                        "text-white text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border-0",
                        event.status === 'overdue' ? "bg-red-500 hover:bg-red-600" :
                          event.status === 'critical' ? "bg-orange-500 hover:bg-orange-600" :
                            event.status === 'upcoming' ? "bg-yellow-500 hover:bg-yellow-600" :
                              event.status === 'attention' ? "bg-blue-400 hover:bg-blue-500" : "bg-emerald-500 hover:bg-emerald-600"
                      )}>
                        {getStatusLabel(event.status).toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex flex-col space-y-3 mt-2">
                      <div className="space-y-2 text-sm text-muted-foreground/90 font-medium">
                        <div className="flex items-center space-x-2.5">
                          <User className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                          <span className="break-words">Crew: {event.crewMemberName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())}</span>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <Ship className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                          <span className="break-words">Vessel: {event.vesselName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())}</span>
                        </div>
                        <div className="flex items-center space-x-2.5">
                          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                          {event.hasNoContract ? (
                            <span className="text-red-500 font-semibold">No active contract assigned</span>
                          ) : event.contractEndDate ? (
                            <span>Contract End: {format(event.contractEndDate, 'MMM dd, yyyy')}</span>
                          ) : (
                            <span className="text-red-500">Contract expired</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-start mt-2 -ml-2">
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            onClick={() => handleViewAction(event.crewMemberId)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            onClick={() => {
                              const member = crewMembers?.find((m: any) => m.id === event.crewMemberId);
                              if (member) sendCrewEmailMutation.mutate(member);
                            }}
                            disabled={sendCrewEmailMutation.isPending}
                            title="Send Mail"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            onClick={() => handleEditAction(event.crewMemberId)}
                            title="Edit Contract"
                          >
                            <PenLine className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                            onClick={() => handleDownloadCrewDocuments(event.crewMemberId, event.crewMemberName)}
                            title="Download Documents"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Send Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Calendar Summary
            </DialogTitle>
            <DialogDescription>
              Send the contract calendar summary for {format(currentDate, 'MMMM yyyy')} via email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-additional"
                checked={sendToAdditional}
                onCheckedChange={(checked) => setSendToAdditional(checked === true)}
                data-testid="checkbox-additional-email"
              />
              <Label htmlFor="send-additional" className="text-sm font-medium cursor-pointer">
                Also send to an additional email address
              </Label>
            </div>

            {sendToAdditional && (
              <div className="space-y-2">
                <Label htmlFor="additional-email">Additional Email Addresses</Label>
                <Input
                  id="additional-email"
                  type="text"
                  placeholder="Enter email addresses (separate with commas)"
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                  data-testid="input-additional-email"
                />
                <p className="text-xs text-muted-foreground">You can add multiple emails separated by commas</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmailDialogOpen(false);
                setAdditionalEmail('');
                setSendToAdditional(false);
              }}
              data-testid="button-cancel-email"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendCalendarEmailMutation.isPending || (sendToAdditional && !additionalEmail)}
              data-testid="button-send-email"
            >
              {sendCalendarEmailMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Crew Member Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog} >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-50 p-6 rounded-[2rem]">
          <DialogTitle className="sr-only">Crew Member Details</DialogTitle>
          {selectedCrewMember && (
            <CrewDetailCard
              member={selectedCrewMember}
              documents={documents}
              onView={() => { }}
              onEdit={() => { setShowViewDialog(false); setShowEditDialog(true); }}
              onVesselHistory={() => { }}
              onSendMail={(m) => sendCrewEmailMutation.mutate(m)}
              onDownload={(id, name) => handleDownloadCrewDocuments(id, name)}
              onViewAOA={async (m) => {
                if (m.activeContract?.filePath) {
                  try {
                    const response = await fetch(`/api/contracts/${m.activeContract.id}/view`, {
                      headers: getAuthHeaders(),
                    });
                    if (!response.ok) throw new Error('Failed to fetch document');
                    await downloadFileFromResponse(response, `AOA_${m.firstName}_${m.lastName}.pdf`);
                  } catch (error) {
                    toast({ title: 'Error', description: 'Failed to open AOA document', variant: 'destructive' });
                  }
                } else {
                  toast({ title: 'Not Available', description: 'No AOA document file found for this contract.' });
                }
              }}
              isMailPending={sendCrewEmailMutation.isPending}
              onDelete={handleDeleteCrewClick}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Crew Member Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog} >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Crew Member Details</DialogTitle>
          </DialogHeader>
          {selectedCrewMember && (
            <EditCrewForm
              crewMember={selectedCrewMember}
              onSuccess={() => {
                setShowEditDialog(false);
                queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Crew Member Confirmation Dialog */}
      <Dialog open={deleteCrewDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteCrewDialogOpen(false); setSelectedCrewForDelete(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Crew Member
            </DialogTitle>
            <DialogDescription>
              {selectedCrewForDelete && (
                <>
                  You are about to permanently delete{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedCrewForDelete.firstName} {selectedCrewForDelete.lastName}
                  </span>.
                  This will remove all their contracts, documents, and history. This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteCrewDialogOpen(false); setSelectedCrewForDelete(null); }}
              disabled={deleteCrewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => selectedCrewForDelete && deleteCrewMutation.mutate(selectedCrewForDelete.id)}
              disabled={deleteCrewMutation.isPending}
            >
              {deleteCrewMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}

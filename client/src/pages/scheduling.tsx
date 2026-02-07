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
import { Calendar, Ship, Printer, AlertTriangle, Clock, User, Mail, Loader2, LayoutGrid, LayoutList } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import ContractTimeline from '@/components/calendar/contract-timeline';

interface ContractEvent {
  id: string;
  type: 'contract_due' | 'contract_expired';
  date: Date;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  vesselName: string;
  contractId: string;
  contractEndDate: Date;
  daysUntilExpiry: number;
}

export default function Scheduling() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ContractEvent[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendToAdditional, setSendToAdditional] = useState(false);
  const [additionalEmail, setAdditionalEmail] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

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
        date: e.date.toISOString(),
        contractEndDate: e.contractEndDate.toISOString(),
      })) as any,
      additionalEmail: sendToAdditional && additionalEmail ? additionalEmail : undefined
    });
  };

  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/contracts'],
    queryFn: async () => {
      const response = await fetch('/api/contracts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch contracts');
      return response.json();
    },
  });

  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew'],
    queryFn: async () => {
      const response = await fetch('/api/crew', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew');
      return response.json();
    },
  });

  const { data: vessels } = useQuery({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
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

  const getCrewMemberName = (crewMemberId: string) => {
    const member = crewMembers?.find((m: any) => m.id === crewMemberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  const getVesselName = (vesselId: string) => {
    const vessel = vessels?.find((v: any) => v.id === vesselId);
    return vessel ? vessel.name : 'Unknown';
  };

  // Generate contract events from contracts data
  // Contract Due = 45 days before end date
  // Contract Expired = end date
  const contractEvents: ContractEvent[] = (contracts || []).flatMap((contract: any) => {
    const events: ContractEvent[] = [];
    const endDate = new Date(contract.endDate);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(endDate, today);

    // Contract Due date (45 days before end date)
    const dueDate = addDays(endDate, -45);

    // Add Contract Due event for all contracts
    events.push({
      id: `${contract.id}-due`,
      type: 'contract_due',
      date: dueDate,
      crewMemberId: contract.crewMemberId,
      crewMemberName: getCrewMemberName(contract.crewMemberId),
      vesselId: contract.vesselId,
      vesselName: getVesselName(contract.vesselId),
      contractId: contract.id,
      contractEndDate: endDate,
      daysUntilExpiry: daysUntilExpiry,
    });

    // Add Contract Expired event for all contracts
    events.push({
      id: `${contract.id}-expired`,
      type: 'contract_expired',
      date: endDate,
      crewMemberId: contract.crewMemberId,
      crewMemberName: getCrewMemberName(contract.crewMemberId),
      vesselId: contract.vesselId,
      vesselName: getVesselName(contract.vesselId),
      contractId: contract.id,
      contractEndDate: endDate,
      daysUntilExpiry: daysUntilExpiry,
    });

    return events;
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventsForDate = (date: Date) => {
    return contractEvents.filter(event => isSameDay(event.date, date));
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'contract_due': return 'bg-warning-amber';
      case 'contract_expired': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
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

  // Get events for current month
  const monthEvents = contractEvents.filter(event => isSameMonth(event.date, currentDate));

  // Count stats for current month view
  const monthDueCount = monthEvents.filter(e => e.type === 'contract_due').length;
  const monthExpiredCount = monthEvents.filter(e => e.type === 'contract_expired').length;
  const thisMonthCount = monthEvents.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="scheduling-title">
            Contract Calendar
          </h2>
          <p className="text-muted-foreground">
            View upcoming contract due dates and expirations
          </p>
        </div>

        <div className="flex gap-2 print:hidden">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              )}
            >
              <LayoutList className="h-4 w-4 inline mr-1.5" />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              )}
            >
              <LayoutGrid className="h-4 w-4 inline mr-1.5" />
              Grid
            </button>
          </div>

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contracts Due Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-warning-amber" />
              <span className="text-2xl font-bold text-foreground" data-testid="contracts-due-count">
                {monthDueCount}
              </span>
              <span className="text-sm text-muted-foreground">this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contract Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-foreground" data-testid="contracts-expired-count">
                {monthExpiredCount}
              </span>
              <span className="text-sm text-muted-foreground">this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground" data-testid="month-events-count">
                {thisMonthCount}
              </span>
              <span className="text-sm text-muted-foreground">this month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-warning-amber rounded-full"></div>
          <span className="text-muted-foreground">Sign Off Due (45 days before expiry)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-muted-foreground">Contract Expired</span>
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
                  .print-report .event-badge.due {
                    background-color: #fef3c7;
                    color: #92400e;
                  }
                  .print-report .event-badge.expired {
                    background-color: #fee2e2;
                    color: #991b1b;
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
                  <h3 className="text-xl font-semibold text-foreground" data-testid="current-month">
                    {format(currentDate, 'MMMM yyyy')}
                  </h3>
                  <Button variant="outline" size="sm" onClick={nextMonth} data-testid="next-month-button" className="print-hide-btn">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Button>
                </div>
              </div>

              {/* Conditional View Rendering */}
              {viewMode === 'timeline' ? (
                <ContractTimeline
                  contracts={contracts || []}
                  crewMembers={crewMembers || []}
                  vessels={vessels || []}
                  currentDate={currentDate}
                />
              ) : (
                <div className="bg-card rounded-lg border border-border">
                  {/* Week Headers */}
                  <div className="grid grid-cols-7 border-b border-border">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="p-3 text-center text-sm font-medium text-muted-foreground bg-muted"
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
                            'min-h-24 p-2 border-r border-b border-border hover:bg-muted cursor-pointer transition-colors',
                            !isCurrentMonth && 'bg-muted text-muted-foreground',
                            isToday && 'bg-primary/10 text-primary'
                          )}
                          onClick={() => handleDateClick(day)}
                          data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                        >
                          <div className={cn(
                            'text-sm font-medium mb-1 text-foreground',
                            isToday && 'font-bold',
                            !isCurrentMonth && 'text-muted-foreground'
                          )}>
                            {format(day, 'd')}
                          </div>

                          {/* Event Indicators */}
                          <div className="space-y-1">
                            {dayEvents.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  'w-full h-1.5 rounded-full',
                                  getEventColor(event.type)
                                )}
                                title={event.type === 'contract_due' ? 'Sign Off Due' : 'Contract Expired'}
                                data-testid={`event-indicator-${event.id}`}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayEvents.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                        <th>Vessel</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{event.crewMemberName}</td>
                          <td>{event.vesselName}</td>
                          <td>
                            <span className={`event-badge ${event.type === 'contract_due' ? 'due' : 'expired'}`}>
                              {event.type === 'contract_due' ? 'Due Soon' : 'Expired'}
                            </span>
                          </td>
                          <td>{format(event.date, 'MMM d, yyyy')}</td>
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
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>
                Events for {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No events on this date</p>
            ) : (
              selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "p-3 border rounded-lg",
                    event.type === 'contract_expired'
                      ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                      : "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                  )}
                  data-testid={`modal-event-${event.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-foreground">
                      {event.type === 'contract_due' ? 'Sign Off Due' : 'Contract Expired'}
                    </h4>
                    <Badge className={cn(
                      "text-white",
                      event.type === 'contract_expired' ? "bg-red-500" : "bg-warning-amber"
                    )}>
                      {event.type === 'contract_due' ? 'SIGN OFF DUE' : 'CONTRACT EXPIRED'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="break-words">Crew Member: {event.crewMemberName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Ship className="h-3 w-3 shrink-0" />
                      <span className="break-words">Vessel: {event.vesselName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>Contract End: {format(event.contractEndDate, 'MMM dd, yyyy')}</span>
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
    </div >
  );
}

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Calendar, Users, Ship, Edit, Trash2 } from 'lucide-react';
import { CrewRotation } from '@shared/schema';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface CrewCalendarProps {
  rotations: CrewRotation[];
}

interface CalendarEvent {
  id: string;
  title: string;
  type: 'join' | 'leave' | 'rotation';
  date: Date;
  crewMemberId: string;
  vesselId: string;
  rotationId: string;
}

export default function CrewCalendar({ rotations }: CrewCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [editingRotation, setEditingRotation] = useState<CrewRotation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch crew members
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

  // Fetch vessels
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

  // Helper functions to get names from IDs
  const getCrewMemberName = (crewMemberId: string) => {
    const member = crewMembers?.find((m: any) => m.id === crewMemberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  const getVesselName = (vesselId: string) => {
    const vessel = vessels?.find((v: any) => v.id === vesselId);
    return vessel ? vessel.name : 'Unknown';
  };

  // Convert rotations to calendar events
  const events: CalendarEvent[] = rotations.flatMap((rotation) => {
    const events = [];
    
    if (rotation.joinDate) {
      events.push({
        id: `${rotation.id}-join`,
        title: 'Crew Join',
        type: 'join' as const,
        date: new Date(rotation.joinDate),
        crewMemberId: rotation.crewMemberId,
        vesselId: rotation.vesselId,
        rotationId: rotation.id,
      });
    }
    
    if (rotation.leaveDate) {
      events.push({
        id: `${rotation.id}-leave`,
        title: 'Crew Leave',
        type: 'leave' as const,
        date: new Date(rotation.leaveDate),
        crewMemberId: rotation.crewMemberId,
        vesselId: rotation.vesselId,
        rotationId: rotation.id,
      });
    }
    
    return events;
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'join': return 'bg-ocean-blue';
      case 'leave': return 'bg-warning-amber';
      case 'rotation': return 'bg-compliance-green';
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

  // Delete rotation mutation
  const deleteRotationMutation = useMutation({
    mutationFn: async (rotationId: string) => {
      const response = await fetch(`/api/rotations/${rotationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete rotation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotations'] });
      toast({
        title: 'Success',
        description: 'Rotation deleted successfully',
      });
      setSelectedDate(null);
      setSelectedEvents([]);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rotation',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteRotation = (rotationId: string) => {
    if (confirm('Are you sure you want to delete this rotation? This action cannot be undone.')) {
      deleteRotationMutation.mutate(rotationId);
    }
  };

  const handleEditRotation = (rotationId: string) => {
    const rotation = rotations.find(r => r.id === rotationId);
    if (rotation) {
      setEditingRotation(rotation);
      setIsEditModalOpen(true);
      setSelectedDate(null);
    }
  };

  // Update rotation mutation
  const updateRotationMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<CrewRotation> }) => {
      // Only send the fields that should be updated, format dates as strings
      const { id: _, createdAt, ...updateFields } = data.updates;
      const payload = {
        ...updateFields,
        joinDate: updateFields.joinDate ? format(new Date(updateFields.joinDate), 'yyyy-MM-dd') : undefined,
        leaveDate: updateFields.leaveDate ? format(new Date(updateFields.leaveDate), 'yyyy-MM-dd') : undefined,
      };

      const response = await fetch(`/api/rotations/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update rotation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotations'] });
      toast({
        title: 'Success',
        description: 'Rotation updated successfully',
      });
      setIsEditModalOpen(false);
      setEditingRotation(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rotation',
        variant: 'destructive',
      });
    },
  });

  const handleUpdateRotation = (updates: Partial<CrewRotation>) => {
    if (editingRotation) {
      updateRotationMutation.mutate({ id: editingRotation.id, updates });
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get events for current month - show all join/leave activities
  const monthEvents = events.filter(event => isSameMonth(event.date, currentDate));

  return (
    <div className="space-y-4">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-calendar-container,
          .print-calendar-container * {
            visibility: visible;
          }
          .print-calendar-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-hide {
            display: none !important;
          }
          .print-show {
            display: block !important;
          }
          .print-calendar-container .hover\\:bg-muted {
            cursor: default !important;
          }
        }
        .print-show {
          display: none;
        }
      `}</style>

      <div className="print-calendar-container">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={previousMonth} data-testid="prev-month-button" className="print-hide">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-xl font-semibold text-foreground" data-testid="current-month">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <Button variant="outline" size="sm" onClick={nextMonth} data-testid="next-month-button" className="print-hide">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-4 text-sm print-hide">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-ocean-blue rounded-full"></div>
              <span className="text-muted-foreground">Crew Join</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-warning-amber rounded-full"></div>
              <span className="text-muted-foreground">Crew Leave</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-compliance-green rounded-full"></div>
              <span className="text-muted-foreground">Training</span>
            </div>
          </div>
        </div>

      {/* Calendar Grid */}
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
                      title={event.title}
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

      {/* Event Details Modal */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
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
              <p className="text-muted-foreground text-center py-4">No events scheduled</p>
            ) : (
              selectedEvents.map((event) => {
                const rotation = rotations.find(r => r.id === event.rotationId);
                const crewName = getCrewMemberName(event.crewMemberId);
                const vesselName = getVesselName(event.vesselId);
                
                return (
                  <div
                    key={event.id}
                    className="p-3 border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid={`modal-event-${event.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">{event.title}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge className={`${getEventColor(event.type)} text-white`}>
                          {event.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center space-x-2">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="break-words">Crew Member: {crewName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Ship className="h-3 w-3 shrink-0" />
                        <span className="break-words">Vessel: {vesselName}</span>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRotation(event.rotationId)}
                        className="text-primary hover:bg-accent"
                        data-testid={`edit-rotation-${event.rotationId}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRotation(event.rotationId)}
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deleteRotationMutation.isPending}
                        data-testid={`delete-rotation-${event.rotationId}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {deleteRotationMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

        {/* Events List for Print - Only shows when printing */}
        <div className="print-show mt-8 break-before-page">
          <h4 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">
            Scheduled Activities for {format(currentDate, 'MMMM yyyy')}
          </h4>
          {monthEvents.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No activities scheduled for this month</p>
          ) : (
            <table className="w-full border-collapse border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 text-left">Crew Member</th>
                  <th className="border border-border p-2 text-left">Vessel</th>
                  <th className="border border-border p-2 text-left">Activity</th>
                  <th className="border border-border p-2 text-left">Date</th>
                  <th className="border border-border p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {monthEvents.map((event) => {
                  const rotation = rotations.find(r => r.id === event.rotationId);
                  return (
                    <tr key={event.id}>
                      <td className="border border-border p-2">{getCrewMemberName(event.crewMemberId)}</td>
                      <td className="border border-border p-2">{getVesselName(event.vesselId)}</td>
                      <td className="border border-border p-2 capitalize">{event.type}</td>
                      <td className="border border-border p-2">
                        {format(event.date, 'MMM dd, yyyy')}
                      </td>
                      <td className="border border-border p-2 capitalize">{rotation?.status || 'Scheduled'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Event Details Modal */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
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
              <p className="text-muted-foreground text-center py-4">No events scheduled</p>
            ) : (
              selectedEvents.map((event) => {
                const rotation = rotations.find(r => r.id === event.rotationId);
                const crewName = getCrewMemberName(event.crewMemberId);
                const vesselName = getVesselName(event.vesselId);
                
                return (
                  <div
                    key={event.id}
                    className="p-3 border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid={`modal-event-${event.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">{event.title}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge className={`${getEventColor(event.type)} text-white`}>
                          {event.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center space-x-2">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="break-words">Crew Member: {crewName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Ship className="h-3 w-3 shrink-0" />
                        <span className="break-words">Vessel: {vesselName}</span>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRotation(event.rotationId)}
                        className="text-primary hover:bg-accent"
                        data-testid={`edit-rotation-${event.rotationId}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRotation(event.rotationId)}
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deleteRotationMutation.isPending}
                        data-testid={`delete-rotation-${event.rotationId}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {deleteRotationMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Rotation Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5 text-primary" />
              <span>Edit Rotation</span>
            </DialogTitle>
          </DialogHeader>
          
          {editingRotation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-join-date">Join Date</Label>
                  <Input
                    id="edit-join-date"
                    type="date"
                    defaultValue={editingRotation.joinDate ? format(new Date(editingRotation.joinDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => setEditingRotation({...editingRotation, joinDate: new Date(e.target.value)})}
                    data-testid="edit-join-date"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-leave-date">Leave Date</Label>
                  <Input
                    id="edit-leave-date"
                    type="date"
                    defaultValue={editingRotation.leaveDate ? format(new Date(editingRotation.leaveDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => setEditingRotation({...editingRotation, leaveDate: e.target.value ? new Date(e.target.value) : null})}
                    data-testid="edit-leave-date"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-rotation-type">Rotation Type</Label>
                <Select 
                  defaultValue={editingRotation.rotationType}
                  onValueChange={(value) => setEditingRotation({...editingRotation, rotationType: value})}
                >
                  <SelectTrigger data-testid="edit-rotation-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="join">Join</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="rotation">Rotation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select 
                  defaultValue={editingRotation.status}
                  onValueChange={(value) => setEditingRotation({...editingRotation, status: value})}
                >
                  <SelectTrigger data-testid="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  defaultValue={editingRotation.notes || ''}
                  onChange={(e) => setEditingRotation({...editingRotation, notes: e.target.value})}
                  placeholder="Additional notes..."
                  data-testid="edit-notes"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  data-testid="cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleUpdateRotation(editingRotation)}
                  disabled={updateRotationMutation.isPending}
                  data-testid="save-edit"
                >
                  {updateRotationMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

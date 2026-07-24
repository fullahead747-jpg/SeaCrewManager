import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { CrewMemberWithDetails } from '@shared/schema';

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  crewMember: CrewMemberWithDetails | null;
}

export const RemarksModal: React.FC<RemarksModalProps> = ({ isOpen, onClose, crewMember }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [remarksText, setRemarksText] = useState('');

  useEffect(() => {
    if (crewMember) {
      setRemarksText(crewMember.remarks || '');
    }
  }, [crewMember]);

  const updateRemarksMutation = useMutation({
    mutationFn: async (remarks: string) => {
      if (!crewMember) throw new Error('No crew member selected');
      const response = await fetch(`/api/crew/${crewMember.id}/remarks`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remarks }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update remarks');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/drilldown'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
      toast({
        title: 'Remarks Saved',
        description: `Updated remarks for ${crewMember?.firstName} ${crewMember?.lastName}`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error Saving Remarks',
        description: error.message || 'Could not save remarks. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateRemarksMutation.mutate(remarksText);
  };

  if (!crewMember) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Crew Remarks - {crewMember.firstName} {crewMember.lastName}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Add or edit operational notes and contract remarks. Saved remarks will be retained and displayed on exported PDF reports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="remarks-text" className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Remarks / Operational Notes
            </Label>
            <Textarea
              id="remarks-text"
              placeholder="e.g. 2 months contract extended today as approved today..."
              value={remarksText}
              onChange={(e) => setRemarksText(e.target.value)}
              rows={5}
              className="resize-none font-sans text-sm leading-relaxed border-slate-300 focus:border-blue-500"
            />
          </div>
          {crewMember.remarks && (
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs text-slate-600">
              <span className="font-bold text-slate-700">Current Remark: </span>
              <span className="italic text-red-600">{crewMember.remarks}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={updateRemarksMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateRemarksMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
            {updateRemarksMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" /> Save Remark
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

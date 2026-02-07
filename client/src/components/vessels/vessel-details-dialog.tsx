import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ship, Users, Flag, Hash, Edit } from 'lucide-react';
import { VesselWithDetails } from './vessel-cards';
import EditVesselForm from './edit-vessel-form';
import { formatDate } from '@/lib/utils';

interface VesselDetailsDialogProps {
  vessel: VesselWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageCrew?: (vessel: VesselWithDetails) => void;
}

export default function VesselDetailsDialog({ vessel, open, onOpenChange, onManageCrew }: VesselDetailsDialogProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const queryClient = useQueryClient();

  if (!vessel) return null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'harbour-mining': return 'bg-gray-600 text-white';
      case 'coastal-mining': return 'bg-blue-600 text-white';
      case 'world-wide': return 'bg-purple-600 text-white';
      case 'oil-field': return 'bg-yellow-600 text-white';
      case 'line-up-mining': return 'bg-gray-500 text-white';
      case 'active': return 'bg-green-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'harbour-mining': return 'Harbour Manning';
      case 'coastal-mining': return 'Coastal Manning';
      case 'world-wide': return 'World Wide';
      case 'oil-field': return 'Oil Field';
      case 'line-up-mining': return 'Laid Up';
      case 'active': return 'Active';
      default: return status.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
  };

  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    return formatDate(dateString);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-white" aria-describedby="vessel-overview-description">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Ship className="h-5 w-5" />
            {vessel.name}
            <Badge className={`${getStatusColor(vessel.status)} px-3 py-1 text-sm font-medium ml-4`}>
              {formatStatus(vessel.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Content - Overview Only */}
        <div className="px-6 pb-6 space-y-6" id="vessel-overview-description">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vessel Information */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Ship className="h-4 w-4 mr-2" />
                Vessel Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Type:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{vessel.type}</span>
                </div>
                {vessel.imoNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">IMO Number:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                      <Hash className="h-3 w-3 mr-1" />
                      {vessel.imoNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Flag State:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                    <Flag className="h-3 w-3 mr-1" />
                    {vessel.flag}
                  </span>
                </div>
              </div>
            </div>

            {/* Crew Information */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Crew Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Crew:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {vessel.crewCount || 0} members
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowEditForm(true)}
                data-testid="edit-vessel-button"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Vessel
              </Button>
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-gray-50"
                onClick={() => onOpenChange(false)}
                data-testid="close-vessel-button"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Edit Vessel Form */}
      <EditVesselForm
        vessel={vessel}
        open={showEditForm}
        onOpenChange={(open) => {
          setShowEditForm(open);
          if (!open) {
            // Refresh the vessel data when edit form closes
            queryClient.invalidateQueries({ queryKey: ['/api/vessels'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
            // Close the details dialog to force fresh data on reopening
            onOpenChange(false);
          }
        }}
      />
    </Dialog>
  );
}
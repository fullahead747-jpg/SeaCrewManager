import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ship, Users, Flag, Hash, X } from 'lucide-react';
import { VesselWithDetails } from './vessel-cards';
import EditVesselForm from './edit-vessel-form';

interface SimpleVesselDetailsDialogProps {
  vessel: VesselWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageCrew?: (vessel: VesselWithDetails) => void;
}

export default function SimpleVesselDetailsDialog({
  vessel,
  open,
  onOpenChange,
  onManageCrew
}: SimpleVesselDetailsDialogProps) {
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
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 bg-white" aria-describedby="vessel-details-description">
          {/* Header */}
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              <Ship className="h-5 w-5" />
              {vessel.name}
            </DialogTitle>
          </DialogHeader>

          {/* Content */}
          <div className="px-6 pb-6 space-y-6" id="vessel-details-description">
            {/* Vessel Type */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Vessel Type</h3>
              <p className="text-base text-gray-900">{vessel.type}</p>
            </div>

            {/* IMO Number */}
            {vessel.imoNumber && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">IMO Number</h3>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <p className="text-base text-gray-900">{vessel.imoNumber}</p>
                </div>
              </div>
            )}

            {/* Flag State */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Flag State</h3>
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-gray-400" />
                <p className="text-base text-gray-900">{vessel.flag}</p>
              </div>
            </div>

            {/* Status */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
              <Badge className={`${getStatusColor(vessel.status)} px-3 py-1 text-sm font-medium rounded-full`}>
                {formatStatus(vessel.status)}
              </Badge>
            </div>

            {/* Current Crew */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Crew</h3>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <p className="text-base text-gray-900">
                  {vessel.crewCount || 0} members
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 pt-0 border-t border-gray-100">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowEditForm(true)}
                data-testid="edit-vessel-button"
              >
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
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (onManageCrew) {
                  onManageCrew(vessel);
                  onOpenChange(false);
                }
              }}
              data-testid="manage-crew-button"
            >
              <Users className="h-4 w-4 mr-2" />
              View Crew
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
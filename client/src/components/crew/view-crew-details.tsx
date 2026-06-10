import { useState } from 'react';
import { CrewMemberWithDetails, Vessel } from '@shared/schema';
import { CrewFormSidebar } from './crew-form-sidebar';
import { CrewViewContent } from './crew-view-content';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import EditCrewForm from './edit-crew-form';
import { Pencil } from 'lucide-react';

interface ViewCrewDetailsProps {
  crewMember: CrewMemberWithDetails;
  onClose: () => void;
}

export default function ViewCrewDetails({ crewMember, onClose }: ViewCrewDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);

  const { data: currentCrewMember = crewMember } = useQuery<CrewMemberWithDetails>({
    queryKey: ['/api/crew', crewMember.id],
    queryFn: async () => {
      const response = await fetch(`/api/crew/${crewMember.id}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch crew member');
      return response.json();
    },
    initialData: crewMember,
  });

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/api/vessels', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
  });

  // When editing, render EditCrewForm directly — same sidebar/tab chrome
  if (isEditing) {
    return (
      <EditCrewForm
        crewMember={currentCrewMember}
        onSuccess={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-[80vh] w-full max-w-5xl mx-auto bg-white dark:bg-gray-950 rounded-lg overflow-hidden shadow-xl">
      <div className="flex flex-1 overflow-hidden">
        <CrewFormSidebar activeTab={activeTab} setActiveTab={setActiveTab} title="View Crew Member" />
        <CrewViewContent activeTab={activeTab} crewMember={currentCrewMember} vessels={vessels} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end items-center gap-2 bg-gray-50 dark:bg-gray-900/50">
        <Button type="button" variant="outline" onClick={onClose} className="bg-white dark:bg-gray-800">
          Close
        </Button>
        <Button
          type="button"
          onClick={() => setIsEditing(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    </div>
  );
}

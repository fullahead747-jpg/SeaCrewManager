import { useState } from 'react';
import { CrewMemberWithDetails, Vessel } from '@shared/schema';
import { CrewFormSidebar } from './crew-form-sidebar';
import { CrewViewContent } from './crew-view-content';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';

interface ViewCrewDetailsProps {
  crewMember: CrewMemberWithDetails;
  onClose: () => void;
}

export default function ViewCrewDetails({ crewMember, onClose }: ViewCrewDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');

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

  return (
    <div className="flex flex-col h-[80vh] w-full max-w-5xl mx-auto bg-white dark:bg-gray-950 rounded-lg overflow-hidden shadow-xl">
      <div className="flex flex-1 overflow-hidden">
        <CrewFormSidebar activeTab={activeTab} setActiveTab={setActiveTab} title="View Crew Member" />
        <CrewViewContent activeTab={activeTab} crewMember={crewMember} vessels={vessels} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end items-center bg-gray-50 dark:bg-gray-900/50">
        <Button type="button" variant="outline" onClick={onClose} className="bg-white dark:bg-gray-800">
          Close
        </Button>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { CrewKanbanBoard } from '@/components/crew/crew-kanban-board';
import type { CrewMemberWithDetails, Document } from '@shared/schema';

export default function CrewDocumentsKanban() {
    const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
        queryKey: ['/api/documents'],
        queryFn: async () => {
            const response = await fetch('/api/documents', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch documents');
            return response.json();
        },
    });

    const { data: crewMembers, isLoading: crewLoading } = useQuery<CrewMemberWithDetails[]>({
        queryKey: ['/api/crew'],
        queryFn: async () => {
            const response = await fetch('/api/crew', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch crew');
            return response.json();
        },
    });

    if (documentsLoading || crewLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maritime-navy"></div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            <CrewKanbanBoard
                crewMembers={crewMembers || []}
                documents={documents || []}
            />
        </div>
    );
}

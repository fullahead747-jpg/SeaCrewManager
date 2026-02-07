import { useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { CrewKanbanCard } from './crew-kanban-card';
import type { CrewMember, Document } from '@shared/schema';
import type { CrewStatus, CrewDocumentStatus } from '@/lib/crew-status-calculator';
import { getStatusLabel } from '@/lib/crew-status-calculator';

interface CrewKanbanColumnProps {
    status: CrewStatus;
    crew: Array<{
        member: CrewMember;
        documents: Document[];
        statusInfo: CrewDocumentStatus;
    }>;
    onCrewClick: (crewId: string) => void;
}

const statusColors: Record<CrewStatus, { bg: string; border: string; text: string }> = {
    'all-valid': {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
    },
    'expiring-soon': {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
    },
    'action-required': {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
    },
    'new-crew': {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
    },
};

export function CrewKanbanColumn({ status, crew, onCrewClick }: CrewKanbanColumnProps) {
    const { setNodeRef } = useDroppable({
        id: status,
    });

    const colors = statusColors[status];

    return (
        <div className="flex flex-col h-full">
            {/* Column Header */}
            <div className={`${colors.bg} ${colors.border} border-2 rounded-t-lg p-4 sticky top-0 z-10`}>
                <div className="flex items-center justify-between">
                    <h2 className={`font-semibold text-lg ${colors.text}`}>
                        {getStatusLabel(status)}
                    </h2>
                    <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                        {crew.length}
                    </Badge>
                </div>
            </div>

            {/* Column Content */}
            <div
                ref={setNodeRef}
                className="flex-1 bg-gray-50 border-2 border-t-0 border-gray-200 rounded-b-lg p-4 overflow-y-auto min-h-[400px]"
            >
                <SortableContext
                    items={crew.map(c => c.member.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-3">
                        {crew.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                                <p className="text-sm">No crew members</p>
                            </div>
                        ) : (
                            crew.map(({ member, documents, statusInfo }) => (
                                <CrewKanbanCard
                                    key={member.id}
                                    crew={member}
                                    documents={documents}
                                    statusInfo={statusInfo}
                                    onClick={() => onCrewClick(member.id)}
                                />
                            ))
                        )}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
}

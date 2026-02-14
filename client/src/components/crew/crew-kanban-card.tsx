import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DocumentStatusGrid } from './document-status-grid';
import type { CrewMember, Document } from '@shared/schema';
import type { CrewDocumentStatus } from '@/lib/crew-status-calculator';

interface CrewKanbanCardProps {
    crew: CrewMember;
    documents: Document[];
    statusInfo: CrewDocumentStatus;
    onClick: () => void;
}

export function CrewKanbanCard({ crew, documents, statusInfo, onClick }: CrewKanbanCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: crew.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Get initials for avatar
    const initials = `${crew.firstName?.[0] || ''}${crew.lastName?.[0] || ''}`.toUpperCase();

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="p-4 cursor-move hover:shadow-lg transition-shadow bg-white"
            onClick={onClick}
        >
            {/* Header with Avatar and Name */}
            <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-10 h-10 bg-blue-500 rounded-full flex-shrink-0">
                    {documents.find(d => d.crewMemberId === crew.id && d.type === 'photo' && d.filePath) && (
                        <AvatarImage
                            src={`/${documents.find(d => d.crewMemberId === crew.id && d.type === 'photo' && d.filePath)?.filePath}`}
                            alt={`${crew.firstName} ${crew.lastName}`}
                            className="object-cover"
                        />
                    )}
                    <AvatarFallback className="text-white font-semibold flex items-center justify-center">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                        {crew.firstName} {crew.lastName}
                    </h3>
                    <p className="text-xs text-gray-500">{crew.rank}</p>
                </div>
            </div>

            {/* Status Badge */}
            <div className="mb-3">
                {crew.status === 'on-board' && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        On Board
                    </Badge>
                )}
                {crew.status === 'on-leave' && (
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                        On Leave
                    </Badge>
                )}
            </div>

            {/* Document Status Grid */}
            <DocumentStatusGrid documents={documents} />

            {/* Footer with Days Until Expiry */}
            <div className="mt-3 pt-3 border-t border-gray-100">
                {statusInfo.daysUntilNextExpiry !== null && (
                    <div className="text-xs text-center">
                        {statusInfo.daysUntilNextExpiry > 0 ? (
                            <span className="text-gray-600">
                                Next expiry in <span className="font-semibold">{statusInfo.daysUntilNextExpiry}</span> days
                                {statusInfo.criticalDocument && (
                                    <span className="text-gray-500"> ({statusInfo.criticalDocument})</span>
                                )}
                            </span>
                        ) : (
                            <span className="text-red-600 font-semibold">
                                {statusInfo.criticalDocument} expired
                            </span>
                        )}
                    </div>
                )}
                {statusInfo.missingCount > 0 && (
                    <div className="text-xs text-center text-red-600 font-semibold">
                        {statusInfo.missingCount} document{statusInfo.missingCount > 1 ? 's' : ''} missing
                    </div>
                )}
            </div>
        </Card>
    );
}

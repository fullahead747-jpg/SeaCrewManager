import { useState, useMemo } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Users } from 'lucide-react';
import { CrewKanbanColumn } from './crew-kanban-column';
import { calculateCrewStatus } from '@/lib/crew-status-calculator';
import type { CrewMember, Document } from '@shared/schema';
import type { CrewStatus } from '@/lib/crew-status-calculator';

interface CrewKanbanBoardProps {
    crewMembers: CrewMember[];
    documents: Document[];
}

export function CrewKanbanBoard({ crewMembers, documents }: CrewKanbanBoardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [onBoardOnly, setOnBoardOnly] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Group crew by status
    const crewByStatus = useMemo(() => {
        // Filter crew based on search and filters
        let filteredCrew = crewMembers;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredCrew = filteredCrew.filter(
                crew =>
                    crew.firstName?.toLowerCase().includes(query) ||
                    crew.lastName?.toLowerCase().includes(query)
            );
        }

        if (onBoardOnly) {
            filteredCrew = filteredCrew.filter(crew => crew.status === 'on-board');
        }

        // Calculate status for each crew member
        const crewWithStatus = filteredCrew.map(crew => {
            const crewDocs = documents.filter(d => d.crewMemberId === crew.id);
            const statusInfo = calculateCrewStatus(crewDocs, crew.createdAt || new Date());

            return {
                member: crew,
                documents: crewDocs,
                statusInfo,
            };
        });

        // Group by status
        const grouped: Record<CrewStatus, typeof crewWithStatus> = {
            'all-valid': [],
            'expiring-soon': [],
            'action-required': [],
            'new-crew': [],
        };

        crewWithStatus.forEach(item => {
            grouped[item.statusInfo.status].push(item);
        });

        return grouped;
    }, [crewMembers, documents, searchQuery, onBoardOnly]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = crewMembers.length;
        const valid = crewByStatus['all-valid'].length;
        const expiring = crewByStatus['expiring-soon'].length;
        const actionNeeded = crewByStatus['action-required'].length;
        const newCrew = crewByStatus['new-crew'].length;

        return { total, valid, expiring, actionNeeded, newCrew };
    }, [crewByStatus, crewMembers.length]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        // Note: We're not updating any data here - drag & drop is visual only
        // The crew will return to their correct column based on actual document status
    };

    const handleCrewClick = (crewId: string) => {
        window.location.href = `/documents?crew=${crewId}`;
    };

    return (
        <div className="flex flex-col h-full">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 p-4 space-y-4">
                {/* Search and Filters */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            type="text"
                            placeholder="Search crew members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Button
                        variant={onBoardOnly ? 'default' : 'outline'}
                        onClick={() => setOnBoardOnly(!onBoardOnly)}
                        className="whitespace-nowrap"
                    >
                        <Users className="w-4 h-4 mr-2" />
                        On Board Only
                    </Button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">{stats.total}</span>
                        <span className="text-gray-500">Total</span>
                    </div>
                    <div className="w-px h-4 bg-gray-300" />
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-green-600">{stats.valid}</span>
                        <span className="text-gray-500">Valid</span>
                    </div>
                    <div className="w-px h-4 bg-gray-300" />
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-orange-600">{stats.expiring}</span>
                        <span className="text-gray-500">Expiring</span>
                    </div>
                    <div className="w-px h-4 bg-gray-300" />
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-600">{stats.actionNeeded}</span>
                        <span className="text-gray-500">Action Needed</span>
                    </div>
                    {stats.newCrew > 0 && (
                        <>
                            <div className="w-px h-4 bg-gray-300" />
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-blue-600">{stats.newCrew}</span>
                                <span className="text-gray-500">New</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-hidden p-4">
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-4 gap-4 h-full">
                        <CrewKanbanColumn
                            status="all-valid"
                            crew={crewByStatus['all-valid']}
                            onCrewClick={handleCrewClick}
                        />
                        <CrewKanbanColumn
                            status="expiring-soon"
                            crew={crewByStatus['expiring-soon']}
                            onCrewClick={handleCrewClick}
                        />
                        <CrewKanbanColumn
                            status="action-required"
                            crew={crewByStatus['action-required']}
                            onCrewClick={handleCrewClick}
                        />
                        <CrewKanbanColumn
                            status="new-crew"
                            crew={crewByStatus['new-crew']}
                            onCrewClick={handleCrewClick}
                        />
                    </div>

                    <DragOverlay>
                        {activeId ? <div className="opacity-50">Dragging...</div> : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}

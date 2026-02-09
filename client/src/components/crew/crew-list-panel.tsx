import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import type { CrewMember, Document } from '@shared/schema';
import { calculateCrewStatus } from '@/lib/crew-status-calculator';

interface CrewListPanelProps {
    crewMembers: CrewMember[];
    documents: Document[];
    selectedCrewId: string | null;
    onSelectCrew: (crewId: string) => void;
}

type FilterTab = 'all' | 'on-board' | 'critical' | 'valid';

export function CrewListPanel({ crewMembers, documents, selectedCrewId, onSelectCrew }: CrewListPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

    // Filter crew based on search and active filter
    const filteredCrew = crewMembers.filter(crew => {
        // Search filter
        const matchesSearch = searchQuery === '' ||
            crew.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            crew.lastName?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Tab filter
        const crewDocs = documents.filter(d => d.crewMemberId === crew.id);
        const statusInfo = calculateCrewStatus(crewDocs, crew.createdAt || new Date());

        switch (activeFilter) {
            case 'on-board':
                return crew.status === 'onBoard';
            case 'critical':
                return statusInfo.status === 'action-required';
            case 'valid':
                return statusInfo.status === 'all-valid';
            default:
                return true;
        }
    });

    const getCrewStatusDot = (crew: CrewMember) => {
        const crewDocs = documents.filter(d => d.crewMemberId === crew.id);
        const statusInfo = calculateCrewStatus(crewDocs, crew.createdAt || new Date());

        switch (statusInfo.status) {
            case 'all-valid':
            case 'new-crew':
                return 'bg-green-500';
            case 'expiring-soon':
                return 'bg-orange-500';
            case 'action-required':
                return 'bg-red-500';
            default:
                return 'bg-gray-400';
        }
    };

    const getStatusText = (crew: CrewMember) => {
        const crewDocs = documents.filter(d => d.crewMemberId === crew.id);
        const statusInfo = calculateCrewStatus(crewDocs, crew.createdAt || new Date());

        switch (statusInfo.status) {
            case 'action-required':
                if (statusInfo.missingDocuments.length > 0) {
                    const missing = statusInfo.missingDocuments
                        .map(d => d.toUpperCase())
                        .join(', ');
                    return `Missing: ${missing}`;
                }
                return 'Action Required';
            case 'expiring-soon':
                if (statusInfo.daysUntilNextExpiry !== null) {
                    return `Expiring in ${statusInfo.daysUntilNextExpiry} days`;
                }
                return 'Expiring Soon';
            case 'all-valid':
                const count = crewDocs.filter(d => d.filePath).length;
                return `${count} Documents OK`;
            case 'new-crew':
                return 'New Crew Member';
            default:
                return 'Unknown Status';
        }
    };

    const getInitials = (crew: CrewMember) => {
        return `${crew.firstName?.[0] || ''}${crew.lastName?.[0] || ''}`.toUpperCase();
    };

    return (
        <div className="h-full flex flex-col bg-white border-r border-gray-200">
            {/* Search Bar */}
            <div className="p-4 pt-6 border-b border-gray-200 bg-white">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Search Crew..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Filter Pills */}
            <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex gap-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-2.5 py-2 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${activeFilter === 'all'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        All Crew
                    </button>
                    <button
                        onClick={() => setActiveFilter('on-board')}
                        className={`px-2.5 py-2 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${activeFilter === 'on-board'
                            ? 'bg-green-600 text-white shadow-lg shadow-green-200'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        🚢 On Board
                    </button>
                    <button
                        onClick={() => setActiveFilter('critical')}
                        className={`px-2.5 py-2 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${activeFilter === 'critical'
                            ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        ⚠️ Critical
                    </button>
                    <button
                        onClick={() => setActiveFilter('valid')}
                        className={`px-2.5 py-2 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${activeFilter === 'valid'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        ✓ All Valid
                    </button>
                </div>
            </div>

            {/* Crew List */}
            <div className="flex-1 overflow-y-auto">
                {filteredCrew.map((crew) => (
                    <div
                        key={crew.id}
                        onClick={() => onSelectCrew(crew.id)}
                        className={`flex items-center gap-3 p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedCrewId === crew.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                            }`}
                    >
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {getInitials(crew)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-gray-900 truncate">
                                {crew.firstName} {crew.lastName}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                                {crew.rank || 'No rank assigned'}
                            </p>
                        </div>

                        {/* Status & Count */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {((new Date().getTime() - new Date(crew.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)) <= 7 && (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 mb-1">
                                    🆕 New
                                </Badge>
                            )}
                            <Badge
                                className={`${getCrewStatusDot(crew)} text-white hover:opacity-90 whitespace-nowrap`}
                            >
                                {calculateCrewStatus(documents.filter(d => d.crewMemberId === crew.id), crew.createdAt || new Date()).status === 'action-required' ? '⚠️ Action Required' :
                                    calculateCrewStatus(documents.filter(d => d.crewMemberId === crew.id), crew.createdAt || new Date()).status === 'expiring-soon' ? '⏳ Expiring' :
                                        '✓ All Valid'}
                            </Badge>
                            <span className={`text-[10px] font-medium ${calculateCrewStatus(documents.filter(d => d.crewMemberId === crew.id), crew.createdAt || new Date()).status === 'action-required' ? 'text-red-600' :
                                calculateCrewStatus(documents.filter(d => d.crewMemberId === crew.id), crew.createdAt || new Date()).status === 'expiring-soon' ? 'text-orange-600' : 'text-gray-500'
                                }`}>
                                {getStatusText(crew)}
                            </span>
                        </div>
                    </div>
                ))}

                {filteredCrew.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                        No crew members found
                    </div>
                )}
            </div>
        </div>
    );
}

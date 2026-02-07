import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertCircle, Upload, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { CrewMemberWithDetails, Document } from '@shared/schema';

// Required document types for all crew members
const REQUIRED_DOCUMENTS = [
    { type: 'passport', label: 'Passport' },
    { type: 'cdc', label: 'CDC' },
    { type: 'coc', label: 'COC' },
    { type: 'medical', label: 'Medical' }
];

export default function DashboardNotifications() {
    const { data: crewMembers } = useQuery<CrewMemberWithDetails[]>({
        queryKey: ['/api/crew'],
        queryFn: async () => {
            const response = await fetch('/api/crew', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch crew');
            return response.json();
        },
    });

    const { data: documents } = useQuery<Document[]>({
        queryKey: ['/api/documents'],
        queryFn: async () => {
            const response = await fetch('/api/documents', {
                headers: getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to fetch documents');
            return response.json();
        },
    });

    if (!crewMembers || !documents) {
        return null;
    }

    // Calculate missing documents for each crew member
    const crewWithMissingDocs = crewMembers
        .map(member => {
            const memberDocs = documents.filter(d => d.crewMemberId === member.id && d.status !== 'expired');

            const missingDocs = REQUIRED_DOCUMENTS.filter(reqDoc => {
                const hasDoc = memberDocs.some(d =>
                    d.type.toLowerCase() === reqDoc.type.toLowerCase() ||
                    (reqDoc.type === 'stcw' && d.type.toLowerCase().includes('coc'))
                );
                return !hasDoc;
            });

            return {
                member,
                missingDocs,
                missingCount: missingDocs.length
            };
        })
        .filter(item => item.missingCount > 0)
        .sort((a, b) => b.missingCount - a.missingCount)
        .slice(0, 3); // Show top 3

    const totalMissingDocs = crewWithMissingDocs.reduce((sum, item) => sum + item.missingCount, 0);

    if (crewWithMissingDocs.length === 0) {
        return null;
    }

    return (
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Bell className="h-4 w-4 text-orange-600" />
                        </div>
                        <CardTitle className="text-base font-semibold text-orange-900">
                            Notifications
                        </CardTitle>
                    </div>
                    <Badge variant="destructive" className="bg-orange-600">
                        {totalMissingDocs}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {crewWithMissingDocs.map(({ member, missingDocs, missingCount }) => (
                    <div
                        key={member.id}
                        className="bg-white rounded-lg p-3 border border-orange-100 hover:border-orange-200 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertCircle className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {member.firstName} {member.lastName}
                                    </p>
                                </div>
                                <p className="text-xs text-gray-600 ml-5">
                                    Missing {missingCount} document{missingCount > 1 ? 's' : ''}: {' '}
                                    <span className="font-medium text-orange-700">
                                        {missingDocs.map(d => d.label).join(', ')}
                                    </span>
                                </p>
                            </div>
                            <Link href="/documents">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-orange-700 hover:text-orange-800 hover:bg-orange-100 flex-shrink-0"
                                >
                                    <Upload className="h-3 w-3 mr-1" />
                                    Upload
                                </Button>
                            </Link>
                        </div>
                    </div>
                ))}

                <Link href="/documents">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-300"
                    >
                        View All Missing Documents
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}


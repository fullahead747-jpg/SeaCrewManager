import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    User,
    Briefcase,
    Users,
    FileText,
    Plane,
    Award,
    Activity,
    FileSignature,
    GraduationCap
} from 'lucide-react';

interface CrewFormSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    title?: string;
}

export function CrewFormSidebar({ activeTab, setActiveTab, title = "Crew Member" }: CrewFormSidebarProps) {
    const menuItems = [
        { id: 'overview', label: 'Crew Overview', icon: User },
        { id: 'professional', label: 'Professional Info', icon: Briefcase },
        { id: 'nok', label: 'Next of Kin', icon: Users },
        { id: 'passport', label: 'Passport', icon: FileText },
        { id: 'cdc', label: 'CDC', icon: Plane }, // Plane icon for CDC (Seaman's Book)
        { id: 'coc', label: 'COC', icon: Award },
        { id: 'medical', label: 'Medical', icon: Activity },
        { id: 'stcw', label: 'STCW Course', icon: GraduationCap },
        { id: 'contract', label: 'Contract', icon: FileSignature },
    ];

    return (
        <div className="w-64 bg-gray-50/50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                </h2>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                            )}
                        >
                            <Icon className={cn("h-4 w-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500")} />
                            {item.label}
                            {isActive && (
                                <div className="ml-auto w-1 h-4 bg-blue-600 dark:bg-blue-400 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

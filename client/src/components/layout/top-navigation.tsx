import { useLocation } from 'wouter';
import { LayoutDashboard, Calendar, FileText, History, Settings, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/scheduling', label: 'Scheduling', icon: Calendar },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/status-history', label: 'Status History', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export default function TopNavigation() {
    const [location, setLocation] = useLocation();

    const isActive = (path: string) => {
        if (path === '/dashboard') {
            return location === '/' || location === '/dashboard';
        }
        return location === path || location.startsWith(path + '/');
    };

    return (
        <nav className="z-40">
            <div className="px-4">
                <div className="flex items-center justify-start gap-1">
                    {navItems.map((item, index) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);

                        return (
                            <>
                                <button
                                    key={item.path}
                                    onClick={() => setLocation(item.path)}
                                    className={cn(
                                        'flex items-center gap-2 px-4 py-2 text-[13px] font-medium transition-all duration-300',
                                        'rounded-t-lg relative group',
                                        active
                                            ? 'text-blue-600 bg-gradient-to-b from-blue-50 to-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    )}
                                >
                                    <Icon className={cn(
                                        "w-4 h-4 transition-transform duration-300",
                                        active ? "scale-110" : "group-hover:scale-105"
                                    )} />
                                    <span>{item.label}</span>
                                    {active && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 rounded-full" />
                                    )}
                                </button>
                                {index < navItems.length - 1 && (
                                    <div className="h-6 w-px bg-gray-300" />
                                )}
                            </>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}

import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Ship,
  Calendar,
  FileText,
  Settings,
  Mail,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'office_staff'] },
  { href: '/scheduling', label: 'Scheduling', icon: Calendar, roles: ['admin', 'office_staff'] },
  { href: '/documents', label: 'Document Center', icon: FileText, roles: ['admin', 'office_staff'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { href: '/notifications', label: 'Email Notifications', icon: Mail, roles: ['admin'] },
];

export default function Sidebar({ isOpen, onClose, isMobile }: SidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  const sidebarClasses = cn(
    'bg-card border-r border-border shadow-sm fixed left-0 top-20 bottom-0 overflow-y-auto transition-transform duration-200 z-40',
    isMobile ? 'w-64' : 'w-64',
    isOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'
  );

  return (
    <aside className={sidebarClasses}>
      <nav className="p-6">
        <div className="space-y-2">
          {/* Fleet Management Section */}
          {(user?.role === 'admin' || user?.role === 'office_staff') && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Fleet Management
              </h3>
              <ul className="space-y-1">
                {filteredNavItems.filter(item => 
                  ['/', '/scheduling'].includes(item.href)
                ).map((item) => {
                  const isActive = location === item.href || (item.href === '/' && location === '/dashboard');
                  return (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <span
                          className={cn(
                            'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors cursor-pointer',
                            isActive 
                              ? 'bg-maritime-navy text-white' 
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                          onClick={isMobile ? onClose : undefined}
                          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Compliance Section */}
          {(user?.role === 'admin' || user?.role === 'office_staff') && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Compliance
              </h3>
              <ul className="space-y-1">
                {filteredNavItems.filter(item => 
                  ['/documents'].includes(item.href)
                ).map((item) => {
                  const isActive = location === item.href;
                  return (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <span
                          className={cn(
                            'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors cursor-pointer',
                            isActive 
                              ? 'bg-maritime-navy text-white' 
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                          onClick={isMobile ? onClose : undefined}
                          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* System Section (Admin Only) */}
          {user?.role === 'admin' && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                System
              </h3>
              <ul className="space-y-1">
                {filteredNavItems.filter(item => 
                  ['/settings', '/notifications'].includes(item.href)
                ).map((item) => {
                  const isActive = location === item.href;
                  return (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <span
                          className={cn(
                            'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors cursor-pointer',
                            isActive 
                              ? 'bg-maritime-navy text-white' 
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                          onClick={isMobile ? onClose : undefined}
                          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}

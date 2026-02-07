import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Ship,
  Calendar,
  FileText,
  Settings,
  Bell,
  History
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'office_staff']
  },
  {
    label: 'Scheduling',
    href: '/scheduling',
    icon: Calendar,
    roles: ['admin', 'office_staff']
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: FileText,
    roles: ['admin', 'office_staff']
  },
  {
    label: 'Status History',
    href: '/status-history',
    icon: History,
    roles: ['admin', 'office_staff']
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin']
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
    roles: ['admin']
  }
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
          <motion.ul
            className="space-y-1"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.05
                }
              }
            }}
          >
            {filteredNavItems.map((item) => {
              const isActive = location === item.href || (item.href === '/' && location === '/dashboard');
              return (
                <motion.li
                  key={item.href}
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <Link href={item.href}>
                    <span
                      className={cn(
                        'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors cursor-pointer',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={isMobile ? onClose : undefined}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </nav>
    </aside>
  );
}
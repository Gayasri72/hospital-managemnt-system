import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  CalendarDays, 
  Clock, 
  CreditCard, 
  FileText, 
  BarChart3, 
  ShieldCheck,
  LogOut,
  Hospital
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';
import { ROLE_ACCESS } from '@/lib/permissions';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  if (!mounted || !user) return null;

  const role = user.role;

  const getNavItems = () => {
    const items = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ROLE_ACCESS.dashboard },
      { name: 'Patients', href: '/patients', icon: Users, roles: ROLE_ACCESS.patients },
      { name: 'Doctors', href: '/doctors', icon: Stethoscope, roles: ROLE_ACCESS.doctors },
      { name: 'Sessions', href: '/sessions', icon: Clock, roles: ROLE_ACCESS.sessions },
      { name: 'Appointments', href: '/appointments', icon: CalendarDays, roles: ROLE_ACCESS.appointments },
      { name: 'Payments', href: '/payments', icon: CreditCard, roles: ROLE_ACCESS.payments },
      { name: 'Medical Records', href: '/medical-records', icon: FileText, roles: ROLE_ACCESS.medicalRecords },
      { name: 'Reports', href: '/reports/revenue', icon: BarChart3, roles: ROLE_ACCESS.reports },
      { name: 'Admin', href: '/admin/users', icon: ShieldCheck, roles: ROLE_ACCESS.admin },
    ];

    return items.filter(item => (item.roles as readonly string[]).includes(role));
  };

  const navItems = getNavItems();

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 text-slate-100 transition-all duration-300">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <Hospital className="w-6 h-6 text-blue-400 mr-3" />
        <span className="text-lg font-semibold tracking-tight text-white">HMS Portal</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-slate-800 text-white" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "mr-3 flex-shrink-0 h-5 w-5",
                  isActive ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center mb-4 px-2">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {user.name.charAt(0)}
          </div>
          <div className="ml-3 truncate">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center px-3 py-2 text-sm font-medium rounded-md text-red-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

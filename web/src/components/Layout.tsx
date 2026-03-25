import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Shield,
  Users,
  SlidersHorizontal,
  Dumbbell,
  User,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admins', label: 'Admin Management', icon: Shield },
  { to: '/users', label: 'User Management', icon: Users },
  { to: '/plans-features', label: 'Feature Management', icon: SlidersHorizontal },
  { to: '/exercises', label: 'Exercise Management', icon: Dumbbell },
];

function navItemClassName(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-white/20 text-white shadow-sm'
      : 'text-white/90 hover:bg-white/10 hover:text-white',
  ].join(' ');
}

export default function Layout() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen min-h-dvh bg-slate-50">
      {/* Sidebar — pattern from talent-projects app-layout / tenant-layout: fixed rail + branded column */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/20 bg-primary text-white shadow-lg">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/15 px-6">
          <img
            src="/favicon.png"
            alt="Horizen Gym"
            className="h-9 w-9 shrink-0 brightness-0 invert"
          />
          <span className="text-lg font-semibold leading-tight tracking-tight text-white">
            Horizen Gym
          </span>
        </div>

        <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto p-4" aria-label="Main">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => navItemClassName(isActive)}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Profile block — inspired by talent-projects SideNav / app-layout dropdown footer */}
        <div className="border-t border-white/20 p-4">
          <details className="group relative">
            <summary className="flex w-full cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white"
                aria-hidden
              >
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white" title={member?.name ?? ''}>
                  {member?.name ?? 'Admin'}
                </p>
                <p className="text-xs text-white/70">View profile</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
            </summary>
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Log out
              </button>
            </div>
          </details>
        </div>
      </aside>

      <div className="ml-64 min-h-screen min-h-dvh">
        <main className="min-h-screen min-h-dvh p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

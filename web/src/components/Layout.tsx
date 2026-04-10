import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, User, ChevronDown, LogOut, Settings, KanbanSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const primaryNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/product-portal', label: 'Product Portal', icon: KanbanSquare },
];

const bottomNavItems: NavItem[] = [{ to: '/settings', label: 'Settings', icon: Settings }];

/** Highlight Settings in the rail when viewing the hub or any management screen reached from it */
const SETTINGS_HUB_PATHS = ['/settings', '/users', '/plans-features', '/admins', '/exercises'] as const;

const PRODUCT_PORTAL_PATHS = ['/product-portal'] as const;

function isSettingsAreaActive(pathname: string) {
  return SETTINGS_HUB_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProductPortalActive(pathname: string) {
  return PRODUCT_PORTAL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function Layout() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = (to: string, isActive: boolean) => {
    let active = isActive;
    if (to === '/settings') {
      active = isSettingsAreaActive(location.pathname);
    }
    if (to === '/product-portal') {
      active = isProductPortalActive(location.pathname);
    }
    return [
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary/10 font-semibold text-primary shadow-sm'
        : 'text-slate-700 hover:bg-slate-50',
    ].join(' ');
  };

  return (
    <div className="min-h-screen min-h-dvh bg-slate-50">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white text-slate-800 shadow-sm">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-slate-200 px-4">
          <img
            src="/horizen-logo-full.png"
            alt="Horizen Gym"
            className="h-9 w-auto max-w-[200px] object-contain object-center"
          />
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto p-4" aria-label="Main">
          <div className="space-y-1">
            {primaryNavItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClass(to, isActive)}>
                {({ isActive }) => {
                  const active =
                    to === '/settings'
                      ? isSettingsAreaActive(location.pathname)
                      : to === '/product-portal'
                        ? isProductPortalActive(location.pathname)
                        : isActive;
                  return (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-slate-500'}`}
                        aria-hidden
                      />
                      <span>{label}</span>
                    </>
                  );
                }}
              </NavLink>
            ))}
          </div>

          <div className="mt-auto space-y-1 pt-2">
            {bottomNavItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClass(to, isActive)}>
                {({ isActive }) => {
                  const active =
                    to === '/settings'
                      ? isSettingsAreaActive(location.pathname)
                      : to === '/product-portal'
                        ? isProductPortalActive(location.pathname)
                        : isActive;
                  return (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-slate-500'}`}
                        aria-hidden
                      />
                      <span>{label}</span>
                    </>
                  );
                }}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <details className="group relative">
            <summary className="flex w-full cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden
              >
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800" title={member?.name ?? ''}>
                  {member?.name ?? 'Admin'}
                </p>
                <p className="text-xs text-slate-500">View profile</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
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

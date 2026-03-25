import { Link } from 'react-router-dom';
import { Shield, Users, SlidersHorizontal, Dumbbell, ArrowRight } from 'lucide-react';

const tiles = [
  {
    to: '/users',
    title: 'User Management',
    subtitle: 'Members, instructors, plans, and profiles',
    description: 'Create and manage member and instructor accounts, plans, and entitlements.',
    Icon: Users,
  },
  {
    to: '/plans-features',
    title: 'Feature Management',
    subtitle: 'Plans, entitlements, and feature flags',
    description: 'Configure subscription plans and which app features each plan can access.',
    Icon: SlidersHorizontal,
  },
  {
    to: '/admins',
    title: 'Admin Management',
    subtitle: 'Back-office administrator accounts',
    description: 'Create and manage admin accounts with access to this console.',
    Icon: Shield,
  },
  {
    to: '/exercises',
    title: 'Exercise Management',
    subtitle: 'Library and logging types',
    description: 'Control how each exercise is logged in the mobile app.',
    Icon: Dumbbell,
  },
] as const;

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-slate-600">
          Manage your application settings and configurations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ to, title, subtitle, description, Icon }) => (
          <Link
            key={to}
            to={to}
            className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                  <p className="text-sm text-slate-500">{subtitle}</p>
                </div>
              </div>
              <ArrowRight
                className="h-5 w-5 shrink-0 text-slate-400"
                aria-hidden
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

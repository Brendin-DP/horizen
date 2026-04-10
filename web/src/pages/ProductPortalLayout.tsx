import { NavLink, Outlet } from 'react-router-dom';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary text-white shadow-sm'
      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  ].join(' ');

export default function ProductPortalLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Product Portal</h1>
        <p className="mt-2 text-slate-600">Feature requests and product roadmap</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <NavLink to="/product-portal/feature-requests" className={tabClass} end>
          Feature Requests
        </NavLink>
        <NavLink to="/product-portal/roadmap" className={tabClass}>
          Product Roadmap
        </NavLink>
      </div>

      <Outlet />
    </div>
  );
}

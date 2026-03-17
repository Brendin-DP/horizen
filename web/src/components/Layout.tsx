import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

export default function Layout() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: '8px 16px',
    color: isActive ? colors.primary : colors.textMuted,
    fontWeight: isActive ? 600 : 400,
    textDecoration: 'none',
    borderRadius: 8,
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          backgroundColor: colors.white,
          borderBottom: `1px solid ${colors.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavLink to="/dashboard" style={navStyle}>
            Dashboard
          </NavLink>
          <NavLink to="/members" style={navStyle}>
            Members
          </NavLink>
          <NavLink to="/plans-features" style={navStyle}>
            Plans & Features
          </NavLink>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: colors.textMuted }}>
            {member?.name}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              backgroundColor: 'transparent',
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: 24, backgroundColor: colors.backgroundDark }}>
        <Outlet />
      </main>
    </div>
  );
}

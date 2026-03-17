import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, member } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (member && member.role !== 'admin') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Access denied. Admin login required.</p>
      </div>
    );
  }

  return <>{children}</>;
}

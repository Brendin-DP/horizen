import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import Admins from './pages/Admins';
import PlansFeatures from './pages/PlansFeatures';
import Fund from './pages/Fund';
import ExerciseManagement from './pages/ExerciseManagement';
import Settings from './pages/Settings';

function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="settings" element={<Settings />} />
        <Route path="members" element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="admins" element={<Admins />} />
        <Route path="plans-features" element={<PlansFeatures />} />
        <Route path="exercises" element={<ExerciseManagement />} />
        <Route path="fund" element={<Fund />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

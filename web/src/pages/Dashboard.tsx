import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAdminMetrics, type AdminMetrics } from '../api/client';
import { colors } from '../constants/theme';

const cardStyle = {
  backgroundColor: colors.white,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

export default function Dashboard() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getAdminMetrics(token)
      .then((m) => {
        if (!cancelled) setMetrics(m);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: colors.textMuted }}>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          backgroundColor: colors.accent,
          color: colors.primary,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, color: colors.textPrimary }}>
        Dashboard
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
            Active Members
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>
            {metrics.activeMembers}
          </p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
            MRR
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>
            R{metrics.mrr.toLocaleString()}
          </p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
            ARR
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>
            R{metrics.arr.toLocaleString()}
          </p>
        </div>
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
            Stars This Month
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>
            {metrics.starsThisMonth}
          </p>
        </div>
      </div>
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: colors.textPrimary }}>
          Members by Plan
        </h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: colors.textMuted, fontSize: 14 }}>Free: </span>
            <strong>{metrics.membersByPlan.free}</strong>
          </div>
          <div>
            <span style={{ color: colors.textMuted, fontSize: 14 }}>Pro: </span>
            <strong>{metrics.membersByPlan.pro}</strong>
          </div>
          <div>
            <span style={{ color: colors.textMuted, fontSize: 14 }}>Elite: </span>
            <strong>{metrics.membersByPlan.elite}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

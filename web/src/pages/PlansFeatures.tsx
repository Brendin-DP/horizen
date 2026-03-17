import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAdminConfig,
  updatePlanFeatures,
  type AdminConfig,
  type PlanFeature,
} from '../api/client';
import { colors } from '../constants/theme';

function getPlanFeature(
  planFeatures: PlanFeature[],
  planId: string,
  featureId: string
): PlanFeature | undefined {
  return planFeatures.find((pf) => pf.planId === planId && pf.featureId === featureId);
}

export default function PlansFeatures() {
  const { token } = useAuth();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchConfig = () => {
    if (!token) return;
    setError('');
    getAdminConfig(token)
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  function toggleEnabled(planId: string, featureId: string) {
    if (!config) return;
    const pf = getPlanFeature(config.planFeatures, planId, featureId);
    const updated = config.planFeatures.map((p) =>
      p.planId === planId && p.featureId === featureId
        ? { ...p, enabled: !p.enabled }
        : p
    );
    if (!pf) {
      updated.push({
        planId,
        featureId,
        enabled: true,
        limit: null,
      });
    }
    setConfig({ ...config, planFeatures: updated });
  }

  function setLimit(planId: string, featureId: string, limit: number | null) {
    if (!config) return;
    const updated = config.planFeatures.map((p) =>
      p.planId === planId && p.featureId === featureId ? { ...p, limit } : p
    );
    const existing = updated.find((p) => p.planId === planId && p.featureId === featureId);
    if (!existing) {
      updated.push({ planId, featureId, enabled: true, limit });
    }
    setConfig({ ...config, planFeatures: updated });
  }

  async function handleSave() {
    if (!token || !config || saving) return;
    setSaving(true);
    setError('');
    try {
      await updatePlanFeatures(config.planFeatures, token);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const limitFeatures = ['exercise_history', 'max_workouts'];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: colors.textMuted }}>Loading plans & features...</p>
      </div>
    );
  }

  if (!config) return null;

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${colors.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: colors.textPrimary }}>
          Plans & Features
        </h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            backgroundColor: colors.primary,
            color: colors.white,
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            backgroundColor: colors.accent,
            color: colors.primary,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
      <table style={tableStyle}>
        <thead>
          <tr style={{ backgroundColor: colors.backgroundDark }}>
            <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Feature</th>
            {config.plans.map((p) => (
              <th key={p.id} style={{ padding: 12, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.features.map((f) => (
            <tr key={f.id} style={{ borderTop: `1px solid ${colors.border}` }}>
              <td style={{ padding: 12 }}>
                <div>
                  <strong>{f.name}</strong>
                  {f.description && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textMuted }}>
                      {f.description}
                    </p>
                  )}
                </div>
              </td>
              {config.plans.map((p) => {
                const pf = getPlanFeature(config.planFeatures, p.id, f.id);
                const enabled = pf?.enabled ?? false;
                const limit = pf?.limit ?? null;
                const hasLimit = limitFeatures.includes(f.id);
                return (
                  <td key={p.id} style={{ padding: 12, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleEnabled(p.id, f.id)}
                        />
                        Enabled
                      </label>
                      {hasLimit && (
                        <input
                          type="number"
                          placeholder="Limit"
                          value={limit ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLimit(p.id, f.id, v === '' ? null : parseInt(v, 10));
                          }}
                          min={0}
                          style={{
                            width: 80,
                            padding: 6,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            fontSize: 14,
                            textAlign: 'center',
                          }}
                        />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getMembers,
  getLeaderboard,
  updateMemberPlan,
  type Member,
} from '../api/client';
import { colors } from '../constants/theme';

interface MemberWithStars extends Member {
  starCount: number;
}

export default function Members() {
  const { token } = useAuth();
  const [members, setMembers] = useState<MemberWithStars[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [editingMember, setEditingMember] = useState<MemberWithStars | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [newExpires, setNewExpires] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const opts: { role: string; plan?: string } = { role: 'member' };
      if (planFilter) opts.plan = planFilter;
      const [participants, leaderboard] = await Promise.all([
        getMembers(token, opts),
        getLeaderboard(token),
      ]);
      const starMap = new Map<string, number>();
      for (const e of leaderboard) {
        starMap.set(e.memberId, e.starCount);
      }
      const merged: MemberWithStars[] = participants.map((m) => ({
        ...m,
        starCount: starMap.get(m.id) ?? 0,
      }));
      setMembers(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, planFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSavePlan() {
    if (!editingMember || !token || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateMemberPlan(
        editingMember.id,
        newPlan || 'free',
        newExpires.trim() || null,
        token
      );
      setEditingMember(null);
      setNewPlan('');
      setNewExpires('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(m: MemberWithStars) {
    setEditingMember(m);
    setNewPlan(m.plan || 'free');
    setNewExpires(m.planExpiresAt ? m.planExpiresAt.slice(0, 10) : '');
  }

  const formatDate = (s: string | null | undefined) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString();
  };

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
          Members
        </h1>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 14,
            minWidth: 120,
          }}
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="elite">Elite</option>
        </select>
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
      {loading ? (
        <p style={{ color: colors.textMuted }}>Loading members...</p>
      ) : members.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            backgroundColor: colors.white,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
          }}
        >
          <p style={{ color: colors.textMuted }}>No members found.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: colors.backgroundDark }}>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Name</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Email</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Plan</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Expires</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Joined</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Stars</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                <td style={{ padding: 12 }}>{m.name}</td>
                <td style={{ padding: 12, color: colors.textMuted }}>{m.email}</td>
                <td style={{ padding: 12 }}>{m.plan || 'free'}</td>
                <td style={{ padding: 12 }}>{formatDate(m.planExpiresAt)}</td>
                <td style={{ padding: 12 }}>{formatDate(m.createdAt)}</td>
                <td style={{ padding: 12 }}>{m.starCount}</td>
                <td style={{ padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      backgroundColor: colors.primary,
                      color: colors.white,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Change Plan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 100,
          }}
          onClick={() => !saving && setEditingMember(null)}
        >
          <div
            style={{
              backgroundColor: colors.white,
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '100%',
              border: `1px solid ${colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px' }}>Change plan — {editingMember.name}</h3>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Plan</label>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                marginBottom: 16,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Expires (YYYY-MM-DD, or empty)</label>
            <input
              type="date"
              value={newExpires}
              onChange={(e) => setNewExpires(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                marginBottom: 20,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  backgroundColor: colors.white,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: colors.primary,
                  color: colors.white,
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

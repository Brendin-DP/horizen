import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getMembers,
  getLeaderboard,
  createMember,
  updateMember,
  type Member,
} from '../api/client';
import { colors } from '../constants/theme';

interface MemberWithStars extends Member {
  starCount: number;
}

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState<MemberWithStars[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MemberWithStars | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'member' | 'instructor' | 'admin'>('member');
  const [formPlan, setFormPlan] = useState('free');
  const [formExpires, setFormExpires] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const opts: { role?: string } = {};
      if (roleFilter) opts.role = roleFilter;
      const [allMembers, leaderboard] = await Promise.all([
        getMembers(token, opts),
        getLeaderboard(token),
      ]);
      const starMap = new Map<string, number>();
      for (const e of leaderboard) {
        starMap.set(e.memberId, e.starCount);
      }
      const merged: MemberWithStars[] = allMembers.map((m) => ({
        ...m,
        starCount: starMap.get(m.id) ?? 0,
      }));
      setUsers(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, roleFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAddModal() {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('member');
    setFormPlan('free');
    setFormExpires('');
    setAddModalOpen(true);
    setError('');
  }

  function openEditModal(u: MemberWithStars) {
    setSelectedUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormPlan(u.plan || 'free');
    setFormExpires(u.planExpiresAt ? u.planExpiresAt.slice(0, 10) : '');
    setEditModalOpen(true);
    setError('');
  }

  async function handleCreate() {
    if (!token || saving) return;
    if (!formName.trim() || !formEmail.trim() || !formPassword) {
      setError('Name, email, and password are required');
      return;
    }
    if (formPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createMember(
        { name: formName.trim(), email: formEmail.trim(), password: formPassword, role: formRole },
        token
      );
      setAddModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!token || !selectedUser || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateMember(
        selectedUser.id,
        { role: formRole, plan: formPlan, planExpiresAt: formExpires.trim() || null },
        token
      );
      setEditModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
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

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  };

  const modalContent: React.CSSProperties = {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    border: `1px solid ${colors.border}`,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 10,
    marginBottom: 16,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 14,
  };

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, color: colors.textPrimary }}>User Management</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              minWidth: 120,
            }}
          >
            <option value="">All roles</option>
            <option value="member">Member</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            onClick={openAddModal}
            style={{
              padding: '10px 20px',
              backgroundColor: colors.primary,
              color: colors.white,
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Add User
          </button>
        </div>
      </div>
      {error && !addModalOpen && !editModalOpen && (
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
        <p style={{ color: colors.textMuted }}>Loading users...</p>
      ) : users.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            backgroundColor: colors.white,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
          }}
        >
          <p style={{ color: colors.textMuted }}>No users found.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: colors.backgroundDark }}>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Name</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Email</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Role</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Plan</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Expires</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Joined</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Stars</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                <td style={{ padding: 12 }}>{u.name}</td>
                <td style={{ padding: 12, color: colors.textMuted }}>{u.email}</td>
                <td style={{ padding: 12 }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor:
                        u.role === 'admin'
                          ? colors.accent
                          : u.role === 'instructor'
                            ? '#e0f2fe'
                            : '#f1f5f9',
                      color:
                        u.role === 'admin'
                          ? colors.primary
                          : u.role === 'instructor'
                            ? '#0369a1'
                            : colors.textSecondary,
                    }}
                  >
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: 12 }}>{u.plan || 'free'}</td>
                <td style={{ padding: 12 }}>{formatDate(u.planExpiresAt)}</td>
                <td style={{ padding: 12 }}>{formatDate(u.createdAt)}</td>
                <td style={{ padding: 12 }}>{u.starCount}</td>
                <td style={{ padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => openEditModal(u)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      backgroundColor: 'transparent',
                      color: colors.primary,
                      border: `1px solid ${colors.primary}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add User Modal */}
      {addModalOpen && (
        <div style={modalOverlay} onClick={() => !saving && setAddModalOpen(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px' }}>Add User</h3>
            {error && (
              <div
                style={{
                  padding: 10,
                  marginBottom: 16,
                  backgroundColor: colors.accent,
                  color: colors.primary,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Full name"
              style={inputStyle}
            />
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="email@example.com"
              style={inputStyle}
            />
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={inputStyle}
            />
            <label style={labelStyle}>Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as 'member' | 'instructor' | 'admin')}
              style={inputStyle}
            >
              <option value="member">Member</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
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
                onClick={handleCreate}
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
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && selectedUser && (
        <div style={modalOverlay} onClick={() => !saving && setEditModalOpen(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px' }}>Edit User — {selectedUser.name}</h3>
            {error && (
              <div
                style={{
                  padding: 10,
                  marginBottom: 16,
                  backgroundColor: colors.accent,
                  color: colors.primary,
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
            <label style={labelStyle}>Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as 'member' | 'instructor' | 'admin')}
              style={inputStyle}
            >
              <option value="member">Member</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
            <label style={labelStyle}>Plan</label>
            <select value={formPlan} onChange={(e) => setFormPlan(e.target.value)} style={inputStyle}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
            <label style={labelStyle}>Plan Expires (YYYY-MM-DD, or empty)</label>
            <input
              type="date"
              value={formExpires}
              onChange={(e) => setFormExpires(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
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
                onClick={handleUpdate}
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

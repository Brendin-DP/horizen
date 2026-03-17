import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFund, updateFund, type FundData } from '../api/client';
import { colors } from '../constants/theme';

export default function Fund() {
  const { token } = useAuth();
  const [fund, setFund] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [raisedInput, setRaisedInput] = useState('');
  const [visible, setVisible] = useState(true);

  const fetchFund = () => {
    setError('');
    getFund()
      .then((data) => {
        setFund(data);
        setRaisedInput(String(data.raised));
        setVisible(data.visible !== false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setFund({ target: 6000, raised: 0, donateUrl: '', visible: true });
        setRaisedInput('0');
        setVisible(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFund();
  }, []);

  async function handleSave() {
    if (!token || saving) return;
    const cleaned = raisedInput.replace(/\D/g, '') || '0';
    const raisedNum = parseInt(cleaned, 10);
    if (Number.isNaN(raisedNum) || raisedNum < 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateFund({ raised: raisedNum, visible }, token);
      setFund((f) => (f ? { ...f, raised: raisedNum, visible } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: colors.textMuted }}>Loading fund settings...</p>
      </div>
    );
  }

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
        <h1 style={{ margin: 0, fontSize: 24, color: colors.textPrimary }}>Fund Settings</h1>
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
          {saving ? 'Saving...' : 'Save'}
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
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: 12,
          padding: 24,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          maxWidth: 480,
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: 14, color: colors.textMuted }}>
          Target: ZAR {(fund?.target ?? 6000).toLocaleString()} per year
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            padding: '12px 0',
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <label style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary, cursor: 'pointer' }}>
            Show fundraising on Home (mobile app)
          </label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: colors.textPrimary, marginBottom: 8 }}>
            Raised (ZAR)
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={raisedInput}
            onChange={(e) => setRaisedInput(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '100%',
              maxWidth: 200,
              padding: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 16,
            }}
          />
        </div>
      </div>
    </div>
  );
}

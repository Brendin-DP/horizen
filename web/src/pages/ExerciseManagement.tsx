import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getExercises,
  updateExerciseLoggingType,
  type Exercise,
  type ExerciseLoggingType,
} from '../api/client';
import { colors } from '../constants/theme';

const LOGGING_OPTIONS: { value: ExerciseLoggingType; label: string }[] = [
  { value: 'weighted', label: 'Weighted' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'weighted_or_bodyweight', label: 'Weighted or bodyweight' },
];

function formatLoggingLabel(v: string): string {
  const o = LOGGING_OPTIONS.find((x) => x.value === v);
  return o?.label ?? v;
}

export default function ExerciseManagement() {
  const { token } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setError('');
    try {
      const data = await getExercises();
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setExercises(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleLoggingChange(exercise: Exercise, loggingType: ExerciseLoggingType) {
    if (!token || savingId) return;
    setRowError(null);
    setSavingId(exercise.id);
    try {
      const updated = await updateExerciseLoggingType(exercise.id, loggingType, token);
      setExercises((prev) =>
        prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
      );
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingId(null);
    }
  }

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((ex) => {
      const name = ex.name.toLowerCase();
      const cat = (ex.category ?? '').toLowerCase();
      const unit = (ex.unit ?? '').toLowerCase();
      return name.includes(q) || cat.includes(q) || unit.includes(q);
    });
  }, [exercises, searchQuery]);

  const tableStyle: React.CSSProperties = useMemo(
    () => ({
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: colors.white,
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${colors.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }),
    []
  );

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, color: colors.textPrimary }}>
        Exercise Management
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: colors.textMuted, maxWidth: 640 }}>
        Set how each exercise is logged in the app: pure weight, pure bodyweight, or optional weight.
        Changes apply on the next load in the mobile app.
      </p>

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
      {rowError && (
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
          {rowError}
        </div>
      )}

      {loading ? (
        <p style={{ color: colors.textMuted }}>Loading exercises...</p>
      ) : exercises.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            backgroundColor: colors.white,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
          }}
        >
          <p style={{ color: colors.textMuted }}>No exercises in the library.</p>
        </div>
      ) : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises…"
              className="hz-input w-full pl-9"
              aria-label="Search exercises"
            />
          </div>
          {filteredExercises.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                backgroundColor: colors.white,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
              }}
            >
              <p style={{ color: colors.textMuted }}>No exercises match your search.</p>
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: colors.backgroundDark }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Name</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Category</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Unit</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>
                    Logging type
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExercises.map((ex) => {
                  const lt = (ex.loggingType ?? 'weighted') as ExerciseLoggingType;
                  return (
                    <tr key={ex.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: 12, fontWeight: 500 }}>{ex.name}</td>
                      <td style={{ padding: 12, color: colors.textMuted }}>
                        {ex.category ?? '—'}
                      </td>
                      <td style={{ padding: 12, color: colors.textMuted }}>{ex.unit ?? '—'}</td>
                      <td style={{ padding: 12 }}>
                        <select
                          value={lt}
                          disabled={savingId === ex.id || !token}
                          onChange={(e) =>
                            handleLoggingChange(ex, e.target.value as ExerciseLoggingType)
                          }
                          className={`hz-select min-w-[220px] ${savingId === ex.id ? 'opacity-70' : ''}`}
                          title={formatLoggingLabel(lt)}
                        >
                          {LOGGING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {savingId === ex.id && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: colors.textMuted }}>
                            Saving…
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

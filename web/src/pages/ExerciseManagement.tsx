import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getExercises,
  getMuscleGroups,
  updateExercise,
  getExerciseRequests,
  approveExercise,
  rejectExercise,
  type Exercise,
  type ExerciseCategory,
  type ExerciseEquipment,
  type ExerciseLoggingType,
  type ExerciseRequestRow,
  type ExerciseType,
  type MuscleGroup,
  type MuscleGroupRegion,
} from '../api/client';
import { colors } from '../constants/theme';

const LOGGING_OPTIONS: { value: ExerciseLoggingType; label: string }[] = [
  { value: 'weighted', label: 'Weighted' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'weighted_or_bodyweight', label: 'Weighted or bodyweight' },
];

const CATEGORY_OPTIONS = [
  'Upper Body',
  'Lower Body',
  'Full Body',
  'Core',
  'Cardio',
  'Mobility',
] as const;

const TYPE_OPTIONS = [
  'Push',
  'Pull',
  'Squat',
  'Hinge',
  'Lunge',
  'Isolation',
  'Core',
  'Cardio',
  'Olympic',
  'Compound',
  'Carry',
  'Mobility',
  'Plyometric',
] as const;

const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Bodyweight',
  'Cable',
  'Machine',
  'Kettlebell',
] as const;

const UNIT_OPTIONS: { value: 'weight_reps' | 'time' | 'distance'; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'time', label: 'Time' },
  { value: 'distance', label: 'Distance' },
];

const REGION_ORDER: MuscleGroupRegion[] = ['Upper Body', 'Lower Body', 'Core', 'Full Body'];

function formatRequestDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function ExerciseManagement() {
  const { token } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [listTab, setListTab] = useState<'active' | 'requested'>('active');

  const [requests, setRequests] = useState<ExerciseRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  type FormModal =
    | null
    | { kind: 'approve'; row: ExerciseRequestRow }
    | { kind: 'editActive'; exercise: Exercise }
    | { kind: 'editRequest'; row: ExerciseRequestRow };
  const [formModal, setFormModal] = useState<FormModal>(null);
  const [apName, setApName] = useState('');
  const [apCategory, setApCategory] = useState<ExerciseCategory>('Upper Body');
  const [apType, setApType] = useState<ExerciseType | ''>('');
  const [apMuscleGroupIds, setApMuscleGroupIds] = useState<string[]>([]);
  const [mgCatalog, setMgCatalog] = useState<MuscleGroup[]>([]);
  const [apEquipment, setApEquipment] = useState<ExerciseEquipment | ''>('');
  const [apUnit, setApUnit] = useState<'weight_reps' | 'time' | 'distance'>('weight_reps');
  const [apLoggingType, setApLoggingType] = useState<ExerciseLoggingType>('weighted');
  const [apRequestNotes, setApRequestNotes] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

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

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setRequestsError('');
    setRequestsLoading(true);
    try {
      const data = await getExerciseRequests(token);
      setRequests(data);
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setRequestsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getMuscleGroups()
      .then((r) => setMgCatalog(r.flat))
      .catch(() => setMgCatalog([]));
  }, []);

  useEffect(() => {
    if (listTab === 'requested' && token) {
      fetchRequests();
    }
  }, [listTab, token, fetchRequests]);

  function populateFormFromRequestRow(row: ExerciseRequestRow) {
    setApName(row.name);
    setApCategory((row.category ?? 'Upper Body') as ExerciseCategory);
    setApType((row.type ?? '') as ExerciseType | '');
    setApMuscleGroupIds(row.muscleGroups?.map((m) => m.id) ?? []);
    setApEquipment((row.equipment ?? '') as ExerciseEquipment | '');
    setApUnit(row.unit ?? 'weight_reps');
    setApLoggingType(row.loggingType ?? 'weighted');
    setApRequestNotes(row.requestNotes ?? '');
  }

  function populateFormFromExercise(ex: Exercise) {
    setApName(ex.name);
    setApCategory((ex.category ?? 'Upper Body') as ExerciseCategory);
    setApType((ex.type ?? '') as ExerciseType | '');
    setApMuscleGroupIds(ex.muscleGroups?.map((m) => m.id) ?? []);
    setApEquipment((ex.equipment ?? '') as ExerciseEquipment | '');
    setApUnit(ex.unit ?? 'weight_reps');
    setApLoggingType(ex.loggingType ?? 'weighted');
    setApRequestNotes('');
  }

  function openApprove(row: ExerciseRequestRow) {
    setRequestSuccess('');
    setFormModal({ kind: 'approve', row });
    populateFormFromRequestRow(row);
  }

  function openEditActive(exercise: Exercise) {
    setFormModal({ kind: 'editActive', exercise });
    populateFormFromExercise(exercise);
  }

  function openEditRequest(row: ExerciseRequestRow) {
    setFormModal({ kind: 'editRequest', row });
    populateFormFromRequestRow(row);
  }

  function closeFormModal() {
    if (formSaving) return;
    setFormModal(null);
  }

  async function handleExerciseFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !formModal) return;
    setFormSaving(true);
    setRequestsError('');
    setRowError(null);
    const payload = {
      name: apName.trim(),
      category: apCategory,
      type: apType === '' ? null : apType,
      muscleGroupIds: apMuscleGroupIds,
      equipment: apEquipment === '' ? null : apEquipment,
      unit: apUnit,
      loggingType: apLoggingType,
    };
    try {
      if (formModal.kind === 'approve') {
        await approveExercise(formModal.row.id, {
          ...payload,
          requestNotes: apRequestNotes.trim() ? apRequestNotes.trim() : null,
        }, token);
        setRequests((prev) => prev.filter((r) => r.id !== formModal.row.id));
        setRequestSuccess('Exercise approved and added to the library.');
        fetchData();
      } else if (formModal.kind === 'editActive') {
        const updated = await updateExercise(formModal.exercise.id, payload, token);
        setExercises((prev) =>
          prev.map((ex) => (ex.id === updated.id ? { ...ex, ...updated } : ex)).sort((a, b) => a.name.localeCompare(b.name))
        );
        setRequestSuccess('Exercise updated.');
      } else {
        await updateExercise(
          formModal.row.id,
          {
            ...payload,
            requestNotes: apRequestNotes.trim() ? apRequestNotes.trim() : null,
          },
          token
        );
        setRequestSuccess('Request updated.');
        void fetchRequests();
        fetchData();
      }
      setFormModal(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      if (formModal.kind === 'approve' || formModal.kind === 'editRequest') {
        setRequestsError(msg);
      } else {
        setRowError(msg);
      }
    } finally {
      setFormSaving(false);
    }
  }

  async function handleReject(id: string) {
    if (!token || rejectingId) return;
    if (!window.confirm('Reject this exercise request?')) return;
    setRejectingId(id);
    setRequestsError('');
    try {
      await rejectExercise(id, token);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setRequestSuccess('Request rejected.');
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setRejectingId(null);
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

  const requestTableStyle: React.CSSProperties = useMemo(
    () => ({
      ...tableStyle,
      fontSize: 14,
    }),
    [tableStyle]
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, color: colors.textPrimary }}>Exercise Management</h1>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: colors.textMuted, maxWidth: 640 }}>
        Browse active exercises and pending requests. Use the edit control on a row to change name,
        category, type, muscle groups, equipment, unit, and logging type.
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

      <div
        role="tablist"
        aria-label="Exercise lists"
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          borderBottom: `1px solid ${colors.border}`,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-active"
          aria-selected={listTab === 'active'}
          onClick={() => setListTab('active')}
          style={{
            padding: '10px 16px',
            marginBottom: -1,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: listTab === 'active' ? colors.primary : colors.textMuted,
            borderBottom:
              listTab === 'active' ? `2px solid ${colors.primary}` : '2px solid transparent',
          }}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          id="tab-requested"
          aria-selected={listTab === 'requested'}
          onClick={() => setListTab('requested')}
          style={{
            padding: '10px 16px',
            marginBottom: -1,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: listTab === 'requested' ? colors.primary : colors.textMuted,
            borderBottom:
              listTab === 'requested' ? `2px solid ${colors.primary}` : '2px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Requested
          {requests.length > 0 ? (
            <span
              style={{
                backgroundColor: colors.primary,
                color: colors.white,
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {requests.length}
            </span>
          ) : null}
        </button>
      </div>

      {listTab === 'requested' ? (
        <div role="tabpanel" aria-labelledby="tab-requested">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: colors.textPrimary }}>Exercise Requests</h2>
            <span
              style={{
                backgroundColor: colors.backgroundDark,
                color: colors.textMuted,
                fontSize: 13,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {requests.length} pending
            </span>
          </div>

          {requestSuccess ? (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {requestSuccess}
            </div>
          ) : null}

          {requestsError ? (
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
              {requestsError}
            </div>
          ) : null}

          {!token ? (
            <p style={{ color: colors.textMuted }}>Sign in as an admin to view requests.</p>
          ) : requestsLoading ? (
            <p style={{ color: colors.textMuted }}>Loading requests…</p>
          ) : requests.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                backgroundColor: colors.white,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
              }}
            >
              <p style={{ margin: 0, color: colors.textMuted, fontSize: 14 }}>
                No pending exercise requests.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={requestTableStyle}>
                <thead>
                <tr style={{ backgroundColor: colors.backgroundDark }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Requested By</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Notes</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, width: 220 }}>Actions</th>
                </tr>
                </thead>
                <tbody>
                  {requests.map((row) => (
                    <tr key={row.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: 12, fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: 12, color: colors.textMuted }}>
                        {row.requestedBy ? (
                          <>
                            {row.requestedBy.name}
                            <br />
                            <span style={{ fontSize: 12 }}>{row.requestedBy.email}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: 12, color: colors.textMuted }}>{row.category ?? '—'}</td>
                      <td style={{ padding: 12, color: colors.textMuted }}>{row.type ?? '—'}</td>
                      <td style={{ padding: 12, color: colors.textMuted, maxWidth: 200 }}>
                        {row.requestNotes ?? '—'}
                      </td>
                      <td style={{ padding: 12, color: colors.textMuted, whiteSpace: 'nowrap' }}>
                        {formatRequestDate(row.createdAt)}
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="hz-btn hz-btn-primary text-sm"
                            onClick={() => openApprove(row)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="hz-btn inline-flex items-center gap-1 text-sm"
                            onClick={() => openEditRequest(row)}
                            title="Edit request"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="hz-btn text-sm"
                            disabled={rejectingId === row.id}
                            onClick={() => handleReject(row.id)}
                          >
                            {rejectingId === row.id ? '…' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <p style={{ color: colors.textMuted }}>Loading exercises...</p>
      ) : exercises.length === 0 ? (
        <div
          role="tabpanel"
          aria-labelledby="tab-active"
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
              role="tabpanel"
              aria-labelledby="tab-active"
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
            <table role="tabpanel" aria-labelledby="tab-active" style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: colors.backgroundDark }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Name</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Category</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14 }}>Unit</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, fontSize: 14, width: 120 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExercises.map((ex) => {
                  return (
                    <tr key={ex.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: 12, fontWeight: 500 }}>{ex.name}</td>
                      <td style={{ padding: 12, color: colors.textMuted }}>
                        {ex.category ?? '—'}
                      </td>
                      <td style={{ padding: 12, color: colors.textMuted }}>{ex.unit ?? '—'}</td>
                      <td style={{ padding: 12 }}>
                        <button
                          type="button"
                          className="hz-btn inline-flex items-center gap-1 text-sm"
                          onClick={() => openEditActive(ex)}
                          disabled={!token}
                          title="Edit exercise"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {formModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exercise-form-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onClick={closeFormModal}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
              backgroundColor: colors.white,
              borderRadius: 12,
              padding: 24,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="exercise-form-dialog-title" style={{ margin: '0 0 16px', fontSize: 18 }}>
              {formModal.kind === 'approve'
                ? 'Approve exercise'
                : formModal.kind === 'editActive'
                  ? 'Edit exercise'
                  : 'Edit request'}
            </h3>
            <form onSubmit={handleExerciseFormSubmit}>
              <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
              <input
                className="hz-input mb-4 w-full"
                value={apName}
                onChange={(e) => setApName(e.target.value)}
                required
              />
              <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
              <select
                className="hz-select mb-4 w-full"
                value={apCategory}
                onChange={(e) => setApCategory(e.target.value as ExerciseCategory)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
              <select
                className="hz-select mb-4 w-full"
                value={apType}
                onChange={(e) => setApType(e.target.value as ExerciseType | '')}
              >
                <option value="">—</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="mb-2 block text-sm font-medium text-slate-700">Muscle groups</span>
              <div className="mb-4 space-y-3">
                {REGION_ORDER.map((region) => {
                  const items = mgCatalog.filter((m) => m.region === region);
                  if (items.length === 0) return null;
                  return (
                    <div key={region}>
                      <div className="mb-1 text-xs font-semibold text-slate-500">{region}</div>
                      <div className="flex flex-wrap gap-2">
                        {items.map((mg) => {
                          const checked = apMuscleGroupIds.includes(mg.id);
                          return (
                            <label
                              key={mg.id}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setApMuscleGroupIds((prev) =>
                                    prev.includes(mg.id)
                                      ? prev.filter((x) => x !== mg.id)
                                      : [...prev, mg.id]
                                  );
                                }}
                              />
                              {mg.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Equipment</label>
              <select
                className="hz-select mb-4 w-full"
                value={apEquipment}
                onChange={(e) => setApEquipment(e.target.value as ExerciseEquipment | '')}
              >
                <option value="">—</option>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
              <label className="mb-2 block text-sm font-medium text-slate-700">Unit</label>
              <select
                className="hz-select mb-4 w-full"
                value={apUnit}
                onChange={(e) => setApUnit(e.target.value as 'weight_reps' | 'time' | 'distance')}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <label className="mb-2 block text-sm font-medium text-slate-700">Logging type</label>
              <select
                className={`hz-select w-full ${formModal.kind === 'editActive' ? 'mb-6' : 'mb-4'}`}
                value={apLoggingType}
                onChange={(e) => setApLoggingType(e.target.value as ExerciseLoggingType)}
              >
                {LOGGING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {formModal.kind === 'approve' || formModal.kind === 'editRequest' ? (
                <>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Request notes</label>
                  <textarea
                    className="hz-input mb-6 min-h-[88px] w-full resize-y py-2"
                    value={apRequestNotes}
                    onChange={(e) => setApRequestNotes(e.target.value)}
                    placeholder="Member’s request notes"
                  />
                </>
              ) : null}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="hz-btn" onClick={closeFormModal} disabled={formSaving}>
                  Cancel
                </button>
                <button type="submit" className="hz-btn hz-btn-primary" disabled={formSaving}>
                  {formSaving
                    ? 'Saving…'
                    : formModal.kind === 'approve'
                      ? 'Approve & Add to Library'
                      : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

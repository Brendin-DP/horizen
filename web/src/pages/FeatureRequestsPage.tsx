import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeatureRequests,
  updateFeatureRequest,
  archiveFeatureRequest,
  type FeatureRequestAdminRow,
  type FeatureRequestStatus,
  type FeatureRequestTag,
} from '../api/client';
import { Archive } from 'lucide-react';

const STATUSES: FeatureRequestStatus[] = [
  'Requested',
  'Under Consideration',
  'In Progress',
  'Done',
  'Archived',
];

const TAGS: FeatureRequestTag[] = ['Bug', 'Feature Request', 'Improvement'];

const KANBAN_STATUSES: FeatureRequestStatus[] = [
  'Requested',
  'Under Consideration',
  'In Progress',
  'Done',
];

function tagBadgeClass(tag: FeatureRequestTag) {
  switch (tag) {
    case 'Bug':
      return 'bg-red-100 text-red-900';
    case 'Feature Request':
      return 'bg-blue-100 text-blue-900';
    case 'Improvement':
      return 'bg-emerald-100 text-emerald-900';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

function statusBadgeClass(status: FeatureRequestStatus) {
  switch (status) {
    case 'Requested':
      return 'bg-slate-100 text-slate-800';
    case 'Under Consideration':
      return 'bg-amber-100 text-amber-900';
    case 'In Progress':
      return 'bg-blue-100 text-blue-900';
    case 'Done':
      return 'bg-emerald-100 text-emerald-900';
    case 'Archived':
      return 'bg-slate-50 text-slate-500 italic';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export default function FeatureRequestsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<FeatureRequestAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setError('');
    setLoading(true);
    getFeatureRequests(token)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const filtered = useMemo(() => {
    let list = rows;
    if (!showArchived) {
      list = list.filter((r) => r.status !== 'Archived');
    }
    if (filterStatus !== 'all') {
      list = list.filter((r) => r.status === filterStatus);
    }
    if (filterTag !== 'all') {
      list = list.filter((r) => r.tag === filterTag);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }
    return list;
  }, [rows, showArchived, filterStatus, filterTag, search]);

  const stats = useMemo(() => {
    const base = {
      total: rows.length,
      Requested: 0,
      'Under Consideration': 0,
      'In Progress': 0,
      Done: 0,
      Archived: 0,
    } as Record<string, number>;
    for (const r of rows) {
      base[r.status] = (base[r.status] || 0) + 1;
    }
    return base;
  }, [rows]);

  async function handleTagChange(id: string, tag: FeatureRequestTag) {
    if (!token) return;
    try {
      const updated = await updateFeatureRequest(id, { tag }, token);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function handleStatusChange(id: string, status: FeatureRequestStatus) {
    if (!token) return;
    try {
      const updated = await updateFeatureRequest(id, { status }, token);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function confirmArchive() {
    if (!token || !archiveId) return;
    try {
      await archiveFeatureRequest(archiveId, token);
      setRows((prev) => prev.map((r) => (r.id === archiveId ? { ...r, status: 'Archived' as const } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed');
    } finally {
      setArchiveId(null);
    }
  }

  const statusFilterOptions = showArchived ? STATUSES : KANBAN_STATUSES;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Feature Requests</h2>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Stat label="Total" value={stats.total} />
        <Stat label="Requested" value={stats.Requested ?? 0} />
        <Stat label="Under Consideration" value={stats['Under Consideration'] ?? 0} />
        <Stat label="In Progress" value={stats['In Progress'] ?? 0} />
        <Stat label="Done" value={stats.Done ?? 0} />
        <Stat label="Archived" value={stats.Archived ?? 0} />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
        <label className="flex min-w-[160px] flex-col gap-1 text-sm font-medium text-slate-700">
          Status
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          >
            <option value="all">All</option>
            {statusFilterOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-sm font-medium text-slate-700">
          Tag
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          >
            <option value="all">All</option>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title…"
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary"
          />
          Show Archived
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-slate-600">
          No feature requests yet. They&apos;ll appear here when members submit them from the app.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-900">Title</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Tag</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Upvotes</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Requested By</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="max-w-xs px-4 py-3 font-medium text-slate-900">{r.title}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.tag}
                      onChange={(e) => handleTagChange(r.id, e.target.value as FeatureRequestTag)}
                      className={`max-w-[11rem] rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium ${tagBadgeClass(r.tag)}`}
                    >
                      {TAGS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => handleStatusChange(r.id, e.target.value as FeatureRequestStatus)}
                      className={`max-w-[12rem] rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium ${statusBadgeClass(r.status)}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.upvotes}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.requestedBy?.name ?? '—'}
                    <br />
                    <span className="text-xs text-slate-400">{r.requestedBy?.email}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== 'Archived' ? (
                      <button
                        type="button"
                        onClick={() => setArchiveId(r.id)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-primary"
                        title="Archive"
                        aria-label="Archive request"
                      >
                        <Archive className="h-5 w-5" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Archived</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {archiveId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Archive this request?</h3>
            <p className="mt-2 text-sm text-slate-600">
              It will be hidden from the roadmap but not deleted.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchiveId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[100px] rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

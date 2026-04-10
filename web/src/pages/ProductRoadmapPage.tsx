import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeatureRequests,
  getAppSettings,
  updateAppSetting,
  updateFeatureRequest,
  type FeatureRequestAdminRow,
  type FeatureRequestStatus,
} from '../api/client';
import { ThumbsUp } from 'lucide-react';

const COLUMNS: FeatureRequestStatus[] = [
  'Requested',
  'Under Consideration',
  'In Progress',
  'Done',
];

function tagBadgeClass(tag: string) {
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

export default function ProductRoadmapPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<FeatureRequestAdminRow[]>([]);
  const [roadmapPublic, setRoadmapPublic] = useState<string>('false');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPublic, setSavingPublic] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicOn = roadmapPublic === 'true';

  const shareUrl = (() => {
    const env = import.meta.env.VITE_PUBLIC_APP_ORIGIN as string | undefined;
    if (env && env.length > 0) {
      return `${env.replace(/\/+$/, '')}/roadmap`;
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/roadmap`;
    }
    return '/roadmap';
  })();

  const load = async () => {
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      const [reqs, sets] = await Promise.all([getFeatureRequests(token), getAppSettings(token)]);
      setRows(reqs);
      const rp = sets.find((s) => s.key === 'roadmap_public');
      setRoadmapPublic(rp?.value ?? 'false');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const kanbanItems = useMemo(
    () => rows.filter((r) => r.status !== 'Archived' && COLUMNS.includes(r.status as FeatureRequestStatus)),
    [rows]
  );

  const byColumn = useMemo(() => {
    const m: Record<string, FeatureRequestAdminRow[]> = {
      Requested: [],
      'Under Consideration': [],
      'In Progress': [],
      Done: [],
    };
    for (const r of kanbanItems) {
      if (m[r.status]) m[r.status].push(r);
    }
    return m;
  }, [kanbanItems]);

  async function togglePublic(on: boolean) {
    if (!token) return;
    setSavingPublic(true);
    setError('');
    try {
      await updateAppSetting('roadmap_public', on ? 'true' : 'false', token);
      setRoadmapPublic(on ? 'true' : 'false');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSavingPublic(false);
    }
  }

  async function handleCardStatus(id: string, status: FeatureRequestStatus) {
    if (!token) return;
    try {
      const updated = await updateFeatureRequest(id, { status }, token);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function copyUrl() {
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Product Roadmap</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Public roadmap</p>
            <p className="mt-1 text-sm text-slate-600">
              {publicOn ? 'Public roadmap is ON' : 'Public roadmap is OFF'}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-slate-600">Enable public page</span>
            <input
              type="checkbox"
              checked={publicOn}
              disabled={savingPublic}
              onChange={(e) => togglePublic(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-primary"
            />
          </label>
        </div>
        {publicOn ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">{shareUrl}</code>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col} className="flex min-h-[200px] flex-col rounded-xl border border-slate-200 bg-slate-50/80">
              <div className="border-b border-slate-200 bg-white px-3 py-2">
                <h3 className="text-sm font-semibold text-slate-900">{col}</h3>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {(byColumn[col] ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No requests</p>
                ) : (
                  (byColumn[col] ?? []).map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="font-semibold text-slate-900">{r.title}</p>
                      <span
                        className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${tagBadgeClass(r.tag)}`}
                      >
                        {r.tag}
                      </span>
                      <div className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                        <ThumbsUp className="h-4 w-4 text-slate-400" aria-hidden />
                        {r.upvotes}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{r.requestedBy?.name ?? '—'}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                      <label className="mt-3 block text-xs font-medium text-slate-600">Move to</label>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          handleCardStatus(r.id, e.target.value as FeatureRequestStatus)
                        }
                        className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900"
                      >
                        {COLUMNS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

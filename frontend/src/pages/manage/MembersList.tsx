import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AdminSociety, type ChangeRequest } from '../../lib/api';
import { EditSocietyModal } from '../../components/EditSocietyModal';
import { Modal } from '../../components/Modal';

type StatusFilter = 'all' | 'active' | 'pending' | 'inactive';

export function MembersList() {
  const [societies, setSocieties] = useState<AdminSociety[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<AdminSociety | null>(null);
  const [reviewing, setReviewing] = useState<AdminSociety | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.adminSocieties().then(setSocieties).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    if (!societies) return [];
    const q = query.trim().toLowerCase();
    return societies.filter((s) => {
      if (statusFilter !== 'all' && (s.status ?? 'pending') !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.contact_phone.includes(q)
      );
    });
  }, [societies, query, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <Link to="/manage" className="text-sm text-ink-500 hover:text-ink-800">← Back to Manage</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Federation members</h1>
        <p className="mt-1 text-ink-500">
          Registered cooperative housing societies enrolled with PCCHSF. Edit details or accept
          changes submitted by societies.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, area, or mobile…"
          className="input max-w-sm"
        />
        <div className="flex gap-1.5">
          {(['all', 'active', 'pending', 'inactive'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === s
                  ? 'bg-federation-800 text-white'
                  : 'bg-white border border-ink-200 text-ink-700 hover:bg-ink-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">
          {error}
        </div>
      )}

      {societies === null && !error && <p className="text-ink-500">Loading…</p>}

      {societies && filtered.length === 0 && (
        <div className="card p-8 text-center text-ink-500">
          No societies match the filter.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3">Society</th>
                  <th className="px-4 py-3">Registered mobile</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Flats</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900">{s.name}</div>
                      {s.registration_number && (
                        <div className="text-[11px] text-ink-500 font-mono">{s.registration_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-700">+91 {s.contact_phone}</td>
                    <td className="px-4 py-3 text-ink-700">{s.area} · {s.pincode}</td>
                    <td className="px-4 py-3 text-right text-ink-900 font-semibold">{s.total_flats ?? '—'}</td>
                    <td className="px-4 py-3"><StatusPill status={s.status ?? 'pending'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="btn-secondary !py-1.5 !px-3 text-xs"
                        >
                          Edit Data
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewing(s)}
                          disabled={s.pending_changes_count === 0}
                          className="relative btn-accent !py-1.5 !px-3 text-xs disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none"
                        >
                          Accept change
                          {s.pending_changes_count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-saffron-700 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1">
                              {s.pending_changes_count}
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <EditSocietyModal
          society={editing}
          mode="admin"
          onClose={() => setEditing(null)}
          onSaved={() => load()}
        />
      )}
      {reviewing && (
        <AcceptChangesModal
          society={reviewing}
          onClose={() => setReviewing(null)}
          onAnyDecision={load}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-azure-100 text-azure-700',
    pending: 'bg-saffron-100 text-saffron-800',
    inactive: 'bg-ink-200 text-ink-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${map[status] ?? 'bg-ink-100 text-ink-700'}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

// ===== Accept Changes modal =====
function AcceptChangesModal({
  society, onClose, onAnyDecision,
}: {
  society: AdminSociety; onClose: () => void; onAnyDecision: () => void;
}) {
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.societyChangeRequests(society.id).then(setRequests).catch((e) => setError(e.message));
  }, [society.id]);
  useEffect(load, [load]);

  async function decide(id: number, decision: 'accept' | 'reject') {
    setBusyId(id);
    setError(null);
    try {
      if (decision === 'accept') await api.acceptChangeRequest(id);
      else await api.rejectChangeRequest(id);
      load();
      onAnyDecision();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process decision.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal onClose={onClose} title={`Pending changes · ${society.name}`}>
      {error && (
        <div className="mb-4 rounded-lg border border-saffron-200 bg-saffron-50 px-3 py-2 text-sm text-saffron-800">
          {error}
        </div>
      )}

      {requests === null && <p className="text-ink-500 text-sm">Loading…</p>}

      {requests && requests.length === 0 && (
        <div className="text-center py-8 text-ink-500 text-sm">
          No pending change requests for this society.
        </div>
      )}

      {requests && requests.length > 0 && (
        <ul className="space-y-4">
          {requests.map((r) => (
            <li key={r.id} className="border border-ink-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs text-ink-500">
                    Submitted {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div className="text-xs text-ink-500">
                    by <span className="font-mono">+91 {r.requested_by_phone}</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-saffron-100 text-saffron-800 font-bold">
                  Pending
                </span>
              </div>

              <ChangeDiff society={society} payload={r.payload} />

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => decide(r.id, 'reject')}
                  disabled={busyId === r.id}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.id, 'accept')}
                  disabled={busyId === r.id}
                  className="btn-primary !py-1.5 !px-3 text-xs"
                >
                  {busyId === r.id ? 'Working…' : 'Accept change'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function ChangeDiff({ society, payload }: { society: AdminSociety; payload: Record<string, unknown> }) {
  const sAny = society as unknown as Record<string, unknown>;
  const keys = Object.keys(payload);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {keys.map((k) => (
        <div key={k} className="border border-ink-100 rounded-lg p-3 bg-ink-50/40">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 font-bold">{k.replace(/_/g, ' ')}</div>
          <div className="mt-1 text-xs text-ink-500 line-through">
            {String(sAny[k] ?? '—')}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-ink-900">
            {String(payload[k] ?? '—')}
          </div>
        </div>
      ))}
    </div>
  );
}


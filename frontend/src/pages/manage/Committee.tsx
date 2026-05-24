import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type CommitteeMember } from '../../lib/api';

type Draft = Pick<CommitteeMember, 'salutation' | 'name' | 'title' | 'term_start' | 'term_end'>;

export function Committee() {
  const [members, setMembers] = useState<CommitteeMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.federationCommittee().then(setMembers).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  function startEdit(m: CommitteeMember) {
    setRowError(null);
    setEditingId(m.id);
    setDraft({
      salutation: m.salutation,
      name: m.name,
      title: m.title,
      term_start: m.term_start ?? '',
      term_end: m.term_end ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setRowError(null);
  }

  async function submitEdit(m: CommitteeMember) {
    if (!draft) return;
    setSavingId(m.id);
    setRowError(null);
    const payload: Record<string, unknown> = {
      salutation: draft.salutation,
      name: draft.name.trim(),
      title: draft.title.trim(),
      term_start: draft.term_start || null,
      term_end: draft.term_end || null,
    };
    try {
      const updated = await api.updateFederationCommitteeMember(m.id, payload);
      setMembers((cur) => cur && cur.map((x) => (x.id === updated.id ? updated : x)));
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <Link to="/manage" className="text-sm text-ink-500 hover:text-ink-800">← Back to Manage</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Federation committee</h1>
        <p className="mt-1 text-ink-500">
          The 11 elected federation office bearers — visible to every admin and shared across logins.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">
          {error}
        </div>
      )}

      {members === null && !error && <p className="text-ink-500">Loading…</p>}

      {members && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-3 py-3 w-10 text-right">#</th>
                  <th className="px-3 py-3">Salutation</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Term start</th>
                  <th className="px-3 py-3">Term end</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.map((m) => {
                  const isEditing = editingId === m.id;
                  const isSaving = savingId === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr className={isEditing ? 'bg-azure-50/40' : 'hover:bg-ink-50/40'}>
                        <td className="px-3 py-2.5 text-right text-ink-400 font-mono text-xs">{m.position}</td>

                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <select
                              value={draft!.salutation}
                              onChange={(e) =>
                                setDraft({ ...draft!, salutation: e.target.value as 'Shri.' | 'Smt.' })
                              }
                              className="input !py-1.5"
                            >
                              <option value="Shri.">Shri.</option>
                              <option value="Smt.">Smt.</option>
                            </select>
                          ) : (
                            <span className="text-ink-700">{m.salutation}</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              value={draft!.name}
                              onChange={(e) => setDraft({ ...draft!, name: e.target.value })}
                              className="input !py-1.5"
                              required
                            />
                          ) : (
                            <span className="font-semibold text-ink-900">{m.name}</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              value={draft!.title}
                              onChange={(e) => setDraft({ ...draft!, title: e.target.value })}
                              className="input !py-1.5"
                              required
                            />
                          ) : (
                            <span className="text-ink-700">{m.title}</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              type="date"
                              value={draft!.term_start ?? ''}
                              onChange={(e) => setDraft({ ...draft!, term_start: e.target.value })}
                              className="input !py-1.5"
                            />
                          ) : (
                            <span className="text-ink-700">{fmtDate(m.term_start)}</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <input
                              type="date"
                              value={draft!.term_end ?? ''}
                              onChange={(e) => setDraft({ ...draft!, term_end: e.target.value })}
                              className="input !py-1.5"
                            />
                          ) : (
                            <span className="text-ink-700">{fmtDate(m.term_end)}</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="btn-secondary !py-1 !px-2.5 text-xs"
                                  disabled={isSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitEdit(m)}
                                  className="btn-primary !py-1 !px-2.5 text-xs"
                                  disabled={isSaving}
                                >
                                  {isSaving ? 'Saving…' : 'Submit'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(m)}
                                disabled={editingId !== null}
                                className="btn-secondary !py-1 !px-3 text-xs"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isEditing && rowError && (
                        <tr className="bg-saffron-50">
                          <td colSpan={7} className="px-3 py-2 text-xs text-saffron-800">{rowError}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-500">
        Only one row can be edited at a time. Click <span className="font-semibold">Edit</span> to make a
        row's fields editable; the button becomes <span className="font-semibold">Submit</span> until you save the changes.
      </p>
    </div>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

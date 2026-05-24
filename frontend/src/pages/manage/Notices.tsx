import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Notice, type NoticeType, type Society } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Field, Input, Select } from '../../components/Field';

const NOTICE_TYPES: NoticeType[] = ['Information', 'GR', 'Policy'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

type FilterState = { mode: 'year' | 'range'; year: number; from: string; to: string };
const defaultFilter: FilterState = { mode: 'year', year: CURRENT_YEAR, from: '', to: '' };

export function Notices() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  const load = useCallback(() => {
    setError(null);
    const params =
      filter.mode === 'year'
        ? { year: filter.year }
        : { from: filter.from || undefined, to: filter.to || undefined };
    api.notices(params).then(setNotices).catch((e) => setError(e.message));
  }, [filter]);
  useEffect(load, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link to="/manage" className="text-sm text-ink-500 hover:text-ink-800">← Back to Manage</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Notices & circulars</h1>
          <p className="mt-1 text-ink-500">
            Federation-issued information, GRs and policy circulars. Defaults to the current year — use
            filters to browse the last two years.
          </p>
        </div>
        <button type="button" onClick={() => setComposing(true)} className="btn-accent self-start sm:self-auto">
          + Create notice
        </button>
      </header>

      <div className="card p-4 mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-1.5">Filter</div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, mode: 'year' }))}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                filter.mode === 'year' ? 'bg-federation-800 text-white' : 'bg-white border border-ink-200 text-ink-700'
              }`}
            >By year</button>
            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, mode: 'range' }))}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                filter.mode === 'range' ? 'bg-federation-800 text-white' : 'bg-white border border-ink-200 text-ink-700'
              }`}
            >By date range</button>
          </div>
        </div>

        {filter.mode === 'year' ? (
          <div>
            <label className="label">Year</label>
            <select
              value={filter.year}
              onChange={(e) => setFilter((f) => ({ ...f, year: Number(e.target.value) }))}
              className="input"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}{y === CURRENT_YEAR ? ' (current)' : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="label">From</label>
              <input
                type="date"
                value={filter.from}
                min={`${CURRENT_YEAR - 2}-01-01`}
                max={`${CURRENT_YEAR}-12-31`}
                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                value={filter.to}
                min={`${CURRENT_YEAR - 2}-01-01`}
                max={`${CURRENT_YEAR}-12-31`}
                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
                className="input"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilter(defaultFilter)}
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >Reset</button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">{error}</div>
      )}

      {notices === null && !error && <p className="text-ink-500">Loading…</p>}

      {notices && notices.length === 0 && (
        <div className="card p-10 text-center">
          <h3 className="font-semibold text-ink-900">No notices in this period</h3>
          <p className="mt-1 text-sm text-ink-500">Try a different year/date range or click "Create notice".</p>
        </div>
      )}

      {notices && notices.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Applicable for</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Edited</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {notices.map((n) => (
                  <tr key={n.id} className="hover:bg-ink-50/40">
                    <td className="px-4 py-3 text-ink-700 whitespace-nowrap">{fmt(n.notice_date)}</td>
                    <td className="px-4 py-3"><TypePill type={n.notice_type} /></td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900">{n.subject}</div>
                      {n.attachment_path && (
                        <a href={n.attachment_path} target="_blank" rel="noreferrer" className="text-xs text-azure-700 hover:underline">
                          📎 Attachment
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700 text-xs">
                      {n.applies_to_all ? 'All societies' : `${n.society_ids.length} society(ies)`}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmt(n.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmt(n.edited_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(n)}
                        className="text-xs text-azure-700 hover:underline font-semibold"
                      >Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {composing && (
        <NoticeFormModal
          mode="create"
          onClose={() => setComposing(false)}
          onSaved={() => { setComposing(false); load(); }}
        />
      )}
      {editing && (
        <NoticeFormModal
          mode="edit"
          notice={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function TypePill({ type }: { type: NoticeType }) {
  const map: Record<NoticeType, string> = {
    Information: 'bg-azure-100 text-azure-700',
    GR: 'bg-saffron-100 text-saffron-800',
    Policy: 'bg-ink-100 text-ink-800',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${map[type]}`}>
      {type}
    </span>
  );
}

// ===== Notice form modal (create + edit) =====
function NoticeFormModal({
  mode, notice, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  notice?: Notice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [appliesToAll, setAppliesToAll] = useState<boolean>(notice ? !!notice.applies_to_all : true);
  const [selectedSocieties, setSelectedSocieties] = useState<Set<number>>(
    new Set(notice?.society_ids ?? [])
  );
  const [noticeType, setNoticeType] = useState<NoticeType>((notice?.notice_type as NoticeType) ?? 'Information');
  const [noticeDate, setNoticeDate] = useState(notice?.notice_date ?? new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState(notice?.subject ?? '');
  const [content, setContent] = useState(notice?.content ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [hasNewAttachment, setHasNewAttachment] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.societies().then(setSocieties).catch(() => {});
  }, []);

  function toggleSociety(id: number) {
    setSelectedSocieties((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setTopError(null);
    setErrors({});

    const fd = new FormData();
    fd.append('subject', subject.trim());
    fd.append('content', content.trim());
    fd.append('notice_date', noticeDate);
    fd.append('notice_type', noticeType);
    fd.append('applies_to_all', appliesToAll ? '1' : '0');
    if (!appliesToAll) {
      [...selectedSocieties].forEach((id) => fd.append('society_ids', String(id)));
    }
    const file = fileRef.current?.files?.[0];
    if (file) fd.append('attachment', file);

    try {
      if (mode === 'create') {
        await api.createNotice(fd);
      } else if (notice) {
        await api.updateNotice(notice.id, fd);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues) {
          const next: Partial<Record<string, string>> = {};
          err.issues.forEach((i) => {
            const k = String(i.path[0] ?? '');
            if (k) next[k] = i.message;
          });
          setErrors(next);
          setTopError('Please fix the highlighted fields.');
        } else setTopError(err.message);
      } else setTopError('Could not save notice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title={mode === 'create' ? 'Create notice' : 'Edit notice'}>
      {topError && (
        <div className="mb-4 rounded-lg border border-saffron-200 bg-saffron-50 px-3 py-2 text-sm text-saffron-800">
          {topError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Applicable for */}
        <div>
          <label className="label">Notice applicable for</label>
          <div className="grid sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAppliesToAll(true)}
              className={`text-left px-4 py-3 rounded-lg border-2 transition ${
                appliesToAll ? 'border-federation-800 bg-ink-50' : 'border-ink-200 bg-white hover:bg-ink-50/40'
              }`}
            >
              <div className="font-semibold text-ink-900 text-sm">All societies</div>
              <div className="text-xs text-ink-500 mt-0.5">Broadcast to every registered society</div>
            </button>
            <button
              type="button"
              onClick={() => setAppliesToAll(false)}
              className={`text-left px-4 py-3 rounded-lg border-2 transition ${
                !appliesToAll ? 'border-federation-800 bg-ink-50' : 'border-ink-200 bg-white hover:bg-ink-50/40'
              }`}
            >
              <div className="font-semibold text-ink-900 text-sm">Specific societies</div>
              <div className="text-xs text-ink-500 mt-0.5">Pick societies via checkboxes</div>
            </button>
          </div>

          {!appliesToAll && (
            <div className="mt-3 border border-ink-200 rounded-lg max-h-44 overflow-y-auto">
              {societies.length === 0 ? (
                <p className="text-sm text-ink-500 p-3">Loading societies…</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {societies.map((s) => (
                    <li key={s.id} className="px-3 py-2 flex items-center gap-2.5 hover:bg-ink-50/60">
                      <input
                        type="checkbox"
                        id={`soc-${s.id}`}
                        checked={selectedSocieties.has(s.id)}
                        onChange={() => toggleSociety(s.id)}
                        className="rounded border-ink-300 text-federation-800 focus:ring-federation-700"
                      />
                      <label htmlFor={`soc-${s.id}`} className="flex-1 text-sm cursor-pointer">
                        <span className="font-medium text-ink-900">{s.name}</span>
                        <span className="text-ink-500 text-xs"> · {s.area}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {errors.society_ids && (
                <p className="text-xs text-saffron-700 p-2 border-t border-ink-100">{errors.society_ids}</p>
              )}
            </div>
          )}
        </div>

        {/* Subject */}
        <Field label="Subject" required error={errors.subject}>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </Field>

        {/* Content */}
        <Field label="Content" required error={errors.content}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="input"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Notice date" required error={errors.notice_date}>
            <Input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} required />
          </Field>
          <Field label="Type of notice" required error={errors.notice_type}>
            <Select value={noticeType} onChange={(e) => setNoticeType(e.target.value as NoticeType)} required>
              {NOTICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>

        {/* Attachment */}
        <div>
          <label className="label">Attachment <span className="text-ink-400">(optional)</span></label>
          <div className="border-2 border-dashed border-ink-300 rounded-xl p-4 hover:border-federation-400 transition">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={() => setHasNewAttachment(true)}
              className="block w-full text-sm text-ink-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-ink-100 file:text-ink-800 hover:file:bg-ink-200"
            />
            {!hasNewAttachment && notice?.attachment_path && (
              <p className="mt-2 text-xs text-ink-600">
                Existing: <a href={notice.attachment_path} target="_blank" rel="noreferrer" className="text-azure-700 hover:underline">📎 view</a>
                {' '}— pick a new file to replace it.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting…' : mode === 'create' ? 'Submit' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

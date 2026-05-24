import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type VentIssue, type IssueCategory } from '../../lib/api';
import { Field, Input, Select } from '../../components/Field';
import { SocietyPicker, useActiveSociety } from '../../components/SocietyPicker';

const CIVIC_DEPARTMENTS = [
  'PCMC Water Supply',
  'MSEDCL Electricity',
  'PWD',
  'PCMC SWM (Garbage)',
  'PCMC Roads',
  'PCMC Sewerage',
  'PCMC Traffic',
  'PMPML (Transport)',
  'Police',
  'Fire Services',
  'PCMC Health',
  'PCMC Encroachment',
];

const CATEGORIES: { value: IssueCategory; label: string; emoji: string }[] = [
  { value: 'road', label: 'Roads & potholes', emoji: '🛣️' },
  { value: 'water', label: 'Water supply', emoji: '💧' },
  { value: 'sewage', label: 'Sewage / drainage', emoji: '🚰' },
  { value: 'streetlight', label: 'Streetlight', emoji: '💡' },
  { value: 'electricity', label: 'Electricity', emoji: '⚡' },
  { value: 'safety', label: 'Safety / security', emoji: '🛡️' },
  { value: 'noise', label: 'Noise pollution', emoji: '🔊' },
  { value: 'encroachment', label: 'Encroachment', emoji: '🚧' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

export function VentIssues() {
  const [activeSociety, setActiveSociety] = useActiveSociety();
  const [issues, setIssues] = useState<VentIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [category, setCategory] = useState<IssueCategory>('road');
  const [filter, setFilter] = useState<'all' | IssueCategory>('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [civicTags, setCivicTags] = useState<Set<string>>(new Set());
  const [showTagPicker, setShowTagPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleTag(t: string) {
    setCivicTags((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  function refresh() {
    api.ventIssues().then(setIssues).catch(() => {});
  }
  useEffect(refresh, []);

  const filtered = useMemo(
    () => (filter === 'all' ? issues : issues.filter((i) => i.category === filter)),
    [issues, filter],
  );

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreviewUrl(URL.createObjectURL(file));
    else setPreviewUrl(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTopError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    if (!fd.get('society_id')) {
      setTopError('Please pick your society first.');
      return;
    }
    // Attach civic tags as a JSON-encoded array string
    if (civicTags.size > 0) fd.set('civic_tags', JSON.stringify([...civicTags]));
    setSubmitting(true);
    try {
      const created = await api.createIssue(fd);
      setActiveSociety(created.society_id);
      setSuccess('Issue reported. The federation has been notified.');
      formRef.current?.reset();
      setPreviewUrl(null);
      setCategory('road');
      setCivicTags(new Set());
      refresh();
    } catch (err) {
      setTopError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-5 gap-8">
      <section className="lg:col-span-2">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-saffron-700">Submit</span>
          </div>
          <h2 className="text-2xl font-bold text-ink-900 leading-tight">
            What's broken in your area?
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            One photo. One sentence. The federation routes it to PCMC and tracks the fix.
          </p>

          {topError && (
            <div className="mt-4 rounded-lg border border-saffron-200 bg-saffron-50 px-3 py-2 text-sm text-saffron-800">
              {topError}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-lg border border-azure-200 bg-azure-50 px-3 py-2 text-sm text-azure-700">
              {success}
            </div>
          )}

          <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Your society" required>
              <SocietyPicker required value={activeSociety ?? ''} onChange={setActiveSociety} />
            </Field>
            <Field label="Your name" required>
              <Input name="reporter_name" placeholder="e.g. Priya K." required />
            </Field>

            <div>
              <label className="label">Category</label>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`text-left px-2.5 py-2 rounded-lg border text-xs transition ${
                      category === c.value
                        ? 'border-saffron-500 bg-saffron-50 text-saffron-800 font-semibold'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
                    }`}
                  >
                    <div className="text-base leading-none mb-0.5">{c.emoji}</div>
                    {c.label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="category" value={category} />
            </div>

            <Field label="Title" required hint="A short one-liner">
              <Input name="title" placeholder="e.g. Pothole on main road outside society gate" required />
            </Field>

            <Field label="Describe the issue" required>
              <textarea
                name="description"
                rows={3}
                required
                className="input"
                placeholder="What's happening? When did it start? Any history with PCMC on this?"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Location / landmark">
                <Input name="location" placeholder="e.g. Near gate B, opposite shop" />
              </Field>
              <Field label="Severity">
                <Select name="severity" defaultValue="medium">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
            </div>

            {/* Civic department tags */}
            <div>
              <label className="label">Tag civic departments</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[...civicTags].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-azure-50 text-azure-700 border border-azure-200 px-2 py-0.5 text-[11px] font-semibold">
                    #{t.replace(/\s+/g, '')}
                    <button type="button" onClick={() => toggleTag(t)} className="text-azure-700 hover:text-azure-900" aria-label={`Remove ${t}`}>×</button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setShowTagPicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full bg-white border border-dashed border-ink-300 text-ink-700 hover:border-ink-500 hover:bg-ink-50 px-2.5 py-0.5 text-[11px] font-semibold"
                >
                  {showTagPicker ? '− Done' : '+ Add tag'}
                </button>
              </div>
              {showTagPicker && (
                <div className="border border-ink-200 rounded-lg p-2 grid grid-cols-2 gap-1">
                  {CIVIC_DEPARTMENTS.map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => toggleTag(d)}
                      className={`text-left px-2 py-1.5 text-xs rounded transition ${
                        civicTags.has(d)
                          ? 'bg-azure-100 text-azure-800 font-semibold'
                          : 'text-ink-700 hover:bg-ink-100'
                      }`}
                    >
                      {civicTags.has(d) ? '✓ ' : ''}{d}
                    </button>
                  ))}
                </div>
              )}
              <p className="help">Auto-routes your post to the right civic department for follow-up.</p>
            </div>

            <details className="border border-ink-200 rounded-lg overflow-hidden">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-ink-800 bg-ink-50/60 hover:bg-ink-100">
                Tag social handles (optional)
              </summary>
              <div className="p-3 space-y-3 bg-white">
                <Field label="Instagram">
                  <Input name="instagram_handle" placeholder="priya.shreesai" />
                </Field>
                <Field label="X (Twitter)">
                  <Input name="x_handle" placeholder="@priya_k" />
                </Field>
                <Field label="Facebook">
                  <Input name="facebook_handle" placeholder="PriyaKulkarniPCMC" />
                </Field>
                <p className="text-[11px] text-ink-500">
                  Any of these appear as clickable chips on your post in the VENT feed.
                </p>
              </div>
            </details>

            <div>
              <label className="label">Photo evidence</label>
              <div className="border-2 border-dashed border-ink-300 rounded-xl p-4 text-center hover:border-saffron-400 transition relative">
                {previewUrl ? (
                  <div className="relative">
                    <img src={previewUrl} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                    <button
                      type="button"
                      onClick={() => { setPreviewUrl(null); if (fileRef.current) fileRef.current.value = ''; }}
                      className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded-full w-6 h-6 leading-none"
                    >×</button>
                  </div>
                ) : (
                  <div className="py-4 cursor-pointer" onClick={() => fileRef.current?.click()}>
                    <div className="text-2xl mb-1">📷</div>
                    <div className="text-sm font-medium text-ink-800">Tap to upload a photo</div>
                    <div className="text-xs text-ink-500 mt-0.5">JPEG / PNG / WEBP up to 8 MB</div>
                  </div>
                )}
                <input
                  ref={fileRef}
                  name="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onPhotoChange}
                  className={previewUrl ? 'hidden' : 'absolute inset-0 opacity-0 cursor-pointer'}
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="vent-btn-primary w-full">
              {submitting ? 'Submitting…' : 'Submit to federation'}
            </button>
          </form>
        </div>
      </section>

      <section className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-ink-900">Recent reports</h2>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | IssueCategory)} className="max-w-xs">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-ink-500">
            No issues reported yet. Be the first to vent.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((i) => (
              <article key={i.id} className="card overflow-hidden flex flex-col">
                {i.photo_path && (
                  <a href={i.photo_path} target="_blank" rel="noreferrer">
                    <img src={i.photo_path} alt={i.title} className="w-full aspect-[16/10] object-cover" />
                  </a>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <SeverityBadge severity={i.severity} />
                    <span className="text-[10px] uppercase tracking-wider text-ink-500 capitalize">{i.category}</span>
                  </div>
                  <h3 className="font-semibold text-ink-900">{i.title}</h3>
                  <p className="text-sm text-ink-600 mt-1 line-clamp-3">{i.description}</p>
                  <div className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500 flex items-center justify-between">
                    <span>{i.society_name} · {i.area}</span>
                    <span>{new Date(i.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">— {i.reporter_name}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: 'bg-ink-100 text-ink-700',
    medium: 'bg-saffron-100 text-saffron-800',
    high: 'bg-saffron-100 text-saffron-800',
    urgent: 'bg-saffron-100 text-saffron-800',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${map[severity] ?? 'bg-ink-100 text-ink-700'}`}>
      {severity}
    </span>
  );
}

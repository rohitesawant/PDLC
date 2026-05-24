import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type VentStats, type Stats } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Analytics() {
  const { user } = useAuth();
  const societyId = user?.society?.id;
  const [vent, setVent] = useState<VentStats | null>(null);
  const [federation, setFederation] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([api.ventStats(societyId), api.stats()])
      .then(([v, f]) => { setVent(v); setFederation(f); })
      .catch(() => {});
  }, [societyId]);

  const cards = useMemo(() => [
    { label: 'Issues opened', value: vent?.issues_total ?? 0, sub: `${vent?.issues_open ?? 0} still open`, tone: 'orange' as const },
    { label: 'Federation reach', value: federation?.society_count ?? 0, sub: `${federation?.member_count ?? 0} members enrolled`, tone: 'azure' as const },
    { label: 'Societies enrolled', value: federation?.society_count ?? 0, sub: `${federation?.areas?.length ?? 0} areas covered`, tone: 'orange' as const },
    { label: 'Categories tracked', value: vent?.issues_by_category?.length ?? 0, sub: 'distinct civic categories', tone: 'azure' as const },
  ], [vent, federation]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-800">← Back to profile</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Analytics</h1>
        <p className="mt-1 text-ink-500">
          Society-level and federation-wide insights{user?.society ? ` for ${user.society.name}` : ''}.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border p-5 ${c.tone === 'orange' ? 'border-saffron-100 bg-gradient-to-br from-saffron-50 to-white' : 'border-azure-100 bg-gradient-to-br from-azure-50 to-white'}`}>
            <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{c.label}</div>
            <div className="mt-2 text-3xl font-bold text-ink-900">{c.value.toLocaleString('en-IN')}</div>
            <div className="text-xs text-ink-500 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-6 mt-6">
        <h2 className="font-semibold text-ink-900 mb-3">Issues by category</h2>
        {!vent || vent.issues_by_category.length === 0 ? (
          <p className="text-sm text-ink-500">No issue data yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {vent.issues_by_category.map((row) => {
              const max = Math.max(1, ...vent.issues_by_category.map((x) => x.c));
              return (
                <li key={row.category} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="capitalize text-ink-700">{row.category}</span>
                    <span className="text-ink-500">{row.c}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div className="h-full bg-saffron-500" style={{ width: `${(row.c / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-ink-500">
        Deeper drill-downs (member growth, area heatmaps, monthly trends) — coming soon.
      </p>
    </div>
  );
}

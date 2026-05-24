import { useEffect, useState } from 'react';
import { api, type Stats, type Society, type Member } from '../lib/api';

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.societies(), api.members()])
      .then(([s, soc, mem]) => {
        setStats(s);
        setSocieties(soc);
        setMembers(mem);
      })
      .catch((e) => setError(e.message));
  }, []);

  const maxAreaCount = Math.max(1, ...(stats?.areas.map((a) => a.c) ?? [1]));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Federation dashboard</h1>
        <p className="mt-2 text-ink-600">Overview of registered societies and members across PCMC.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">{error}</div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Registered societies" value={stats?.society_count ?? 0} accent="federation" />
        <StatCard label="Enrolled members" value={stats?.member_count ?? 0} accent="saffron" />
        <StatCard label="Areas covered" value={stats?.areas.length ?? 0} accent="slate" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="card p-6 lg:col-span-2">
          <h2 className="font-semibold text-ink-900 mb-4">Societies by area</h2>
          {(!stats || stats.areas.length === 0) ? (
            <p className="text-sm text-ink-500">No data yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.areas.map((a) => (
                <li key={a.area} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-ink-700">{a.area}</span>
                    <span className="text-ink-500">{a.c}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full bg-federation-500"
                      style={{ width: `${(a.c / maxAreaCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6 lg:col-span-3">
          <h2 className="font-semibold text-ink-900 mb-4">Latest societies</h2>
          {societies.length === 0 ? (
            <p className="text-sm text-ink-500">No societies yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {societies.slice(0, 6).map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-ink-900">{s.name}</div>
                    <div className="text-xs text-ink-500">{s.area} · {s.member_count ?? 0} members</div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-ink-100 text-ink-700">{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-6 mt-6">
        <h2 className="font-semibold text-ink-900 mb-4">Latest members</h2>
        {members.length === 0 ? (
          <p className="text-sm text-ink-500">No members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Society</th>
                  <th className="py-2 pr-3">Flat</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.slice(0, 10).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 font-medium text-ink-900">{m.full_name}</td>
                    <td className="py-2 pr-3 text-ink-700">{m.society_name}</td>
                    <td className="py-2 pr-3 text-ink-700">{m.wing ? `${m.wing}-` : ''}{m.flat_number}</td>
                    <td className="py-2 pr-3 capitalize text-ink-700">{m.role_in_society.replace('_', ' ')}</td>
                    <td className="py-2 pr-3 text-ink-500">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'federation' | 'saffron' | 'slate' }) {
  const map = {
    federation: 'from-federation-50 to-white border-federation-100',
    saffron: 'from-saffron-50 to-white border-saffron-100',
    slate: 'from-ink-50 to-white border-ink-200',
  } as const;
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${map[accent]} p-5`}>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-ink-900">{value}</div>
    </div>
  );
}

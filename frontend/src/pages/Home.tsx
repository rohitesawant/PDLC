import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type SocietyProfile } from '../lib/api';
import { useAuth } from '../lib/auth';
import { EditSocietyModal } from '../components/EditSocietyModal';

export function Home() {
  const { user } = useAuth();
  const societyId = user?.society?.id ?? user?.member?.society_id ?? null;
  const isAdmin = !!user?.is_admin;
  const [profile, setProfile] = useState<SocietyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    if (!societyId) return;
    setError(null);
    api.societyProfile(societyId).then(setProfile).catch((e) => setError(e.message));
  }, [societyId]);

  useEffect(load, [load]);

  if (!societyId) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold text-ink-900">No society linked to your account</h2>
          <p className="mt-2 text-sm text-ink-500">
            Your mobile number is registered but not yet attached to any society. Please contact the
            federation office.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-lg border border-saffron-200 bg-saffron-50 p-4 text-sm text-saffron-800">{error}</div>
      </div>
    );
  }

  if (!profile) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-ink-500">Loading society profile…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <SocietyDetailsSection profile={profile} onEdit={() => setEditing(true)} />
      <MembershipSection
        profile={profile}
        renewing={renewing}
        onRenew={async () => {
          setRenewing(true);
          try {
            await api.renewMembership(profile.society.id);
            load();
          } finally {
            setRenewing(false);
          }
        }}
      />
      <DocumentsAndVentSection profile={profile} />

      {editing && (
        <EditSocietyModal
          society={profile.society}
          mode={isAdmin ? 'admin' : 'member'}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
          onRequested={() => { /* close handled by modal's success screen */ }}
        />
      )}
    </div>
  );
}


// ===== Section 1: Society details =====
function SocietyDetailsSection({ profile, onEdit }: { profile: SocietyProfile; onEdit: () => void }) {
  const s = profile.society;
  return (
    <section>
      <SectionHeader index="01" title="Society profile" />
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">{s.name}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {s.address_line1}
              {s.address_line2 ? `, ${s.address_line2}` : ''} · {s.area}, {s.city} — {s.pincode}
            </p>
            {s.registration_number && (
              <p className="mt-0.5 text-xs text-ink-400">Reg. {s.registration_number}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={s.status} />
            <button type="button" onClick={onEdit} className="btn-secondary !py-1.5 !px-3 text-xs">
              Edit Profile
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Number of flats" value={s.total_flats?.toString() ?? '—'} />
          <Stat label="Convenience stores" value={(s.convenience_stores ?? 0).toString()} />
          <Stat label="Established" value={s.year_established?.toString() ?? '—'} />
        </div>
      </div>
    </section>
  );
}

// ===== Section 2: Federation membership =====
function MembershipSection({
  profile,
  onRenew,
  renewing,
}: {
  profile: SocietyProfile;
  onRenew: () => void;
  renewing: boolean;
}) {
  const s = profile.society;
  const endDate = s.membership_end_date ? new Date(s.membership_end_date) : null;
  const isOverdue = endDate ? endDate < new Date() : true;
  const daysFromNow = endDate
    ? Math.round((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <section>
      <SectionHeader index="02" title="Federation membership" />
      <div className={`card p-6 sm:p-8 ${isOverdue ? 'ring-1 ring-saffron-200' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-ink-900">Membership status</h3>
              {isOverdue ? (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-saffron-100 text-saffron-800">
                  Overdue
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-azure-100 text-azure-700">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {isOverdue
                ? `Your federation membership expired ${endDate ? Math.abs(daysFromNow!) : '?'} days ago.`
                : `Your membership is active for another ${daysFromNow} days.`}
            </p>
          </div>
          {isOverdue && (
            <button onClick={onRenew} disabled={renewing} className="btn-accent">
              {renewing ? 'Processing…' : `Renew membership${s.overdue_amount ? ` · ${rupees(s.overdue_amount)}` : ''}`}
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DataRow label="Membership end date" value={fmt(s.membership_end_date)} accent={isOverdue ? 'orange' : 'default'} />
          <DataRow label="Last membership fee paid" value={fmt(s.last_payment_date)} />
          <DataRow
            label="Overdue amount"
            value={s.overdue_amount && s.overdue_amount > 0 ? rupees(s.overdue_amount) : '₹0'}
            accent={s.overdue_amount && s.overdue_amount > 0 ? 'orange' : 'default'}
          />
        </div>
      </div>
    </section>
  );
}

// ===== Section 3: Documents + VENT timeline =====
function DocumentsAndVentSection({ profile }: { profile: SocietyProfile }) {
  const docs = profile.documents;
  const timeline = useMemo(() => buildTimeline(profile), [profile]);

  return (
    <section>
      <SectionHeader index="03" title="Documents & activity" />

      <div className="card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink-900">Documents</h3>
          <span className="text-xs text-ink-500">{docs.length} on file</span>
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-ink-500">No documents on file yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {docs.map((d) => <DocumentTile key={d.id} doc={d} />)}
          </div>
        )}

        <h3 className="text-lg font-semibold text-ink-900 mt-8 mb-4">
          VENT timeline
        </h3>
        {timeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 p-8 text-center">
            <p className="text-sm text-ink-500">No VENT activity yet.</p>
            <Link to="/vent" className="btn-accent mt-3 inline-flex">Open VENT</Link>
          </div>
        ) : (
          <ol className="relative border-l-2 border-ink-100 pl-5 space-y-5">
            {timeline.map((e) => <TimelineItem key={e.key} entry={e} />)}
          </ol>
        )}
      </div>
    </section>
  );
}

// ===== Small reusable bits =====
function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3 px-1">
      <span className="text-[11px] font-bold text-saffron-600 tracking-[0.2em]">{index}</span>
      <h2 className="text-sm uppercase tracking-[0.18em] font-semibold text-ink-500">{title}</h2>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 border border-ink-100 p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink-900">{value}</div>
    </div>
  );
}

function DataRow({ label, value, accent = 'default' }: { label: string; value: string; accent?: 'default' | 'orange' }) {
  const valueColor = accent === 'orange' ? 'text-saffron-700' : 'text-ink-900';
  return (
    <div className="rounded-xl bg-ink-50 border border-ink-100 p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</div>
      <div className={`mt-1 text-base font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-saffron-100 text-saffron-800',
    approved: 'bg-azure-100 text-azure-700',
    active: 'bg-azure-100 text-azure-700',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${map[status] ?? 'bg-ink-100 text-ink-700'}`}>
      {status}
    </span>
  );
}

function DocumentTile({ doc }: { doc: SocietyProfile['documents'][number] }) {
  const meta = docMeta(doc.type);
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  return (
    <a
      href={doc.file_path ?? '#'}
      target={doc.file_path ? '_blank' : undefined}
      rel="noreferrer"
      className="group block rounded-xl border border-ink-200 bg-white p-4 hover:border-ink-400 hover:shadow-card transition"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold ${meta.iconClass}`}>
        {meta.glyph}
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">{meta.label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink-900 line-clamp-2">{doc.name}</div>
      {doc.issued_date && <div className="mt-1 text-xs text-ink-500">{fmt(doc.issued_date)}</div>}
    </a>
  );
}

function docMeta(type: string) {
  switch (type) {
    case 'share_certificate':
      return { label: 'Share Cert.', glyph: '★', iconClass: 'bg-saffron-100 text-saffron-700' };
    case 'receipt':
      return { label: 'Receipt', glyph: '₹', iconClass: 'bg-azure-100 text-azure-700' };
    case 'invoice':
      return { label: 'Invoice', glyph: '🧾', iconClass: 'bg-saffron-50 text-saffron-700' };
    default:
      return { label: 'Document', glyph: '📄', iconClass: 'bg-ink-100 text-ink-700' };
  }
}

// ===== Timeline =====
type TimelineEntry = {
  key: string;
  ts: string;
  kind: 'issue';
  title: string;
  description?: string;
  tag?: string;
  photo?: string | null;
};

function buildTimeline(profile: SocietyProfile): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const i of profile.vent_timeline.issues) {
    entries.push({
      key: `i-${i.id}`,
      ts: i.created_at,
      kind: 'issue',
      title: i.title,
      description: i.description,
      tag: `${i.category} · ${i.severity}`,
      photo: i.photo_path,
    });
  }
  return entries
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 25);
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const dotColor = 'bg-saffron-500';
  const when = new Date(entry.ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <li className="relative">
      <span className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${dotColor}`} />
      <div className="flex items-start gap-3">
        {entry.photo ? (
          <a href={entry.photo} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={entry.photo} alt="" className="w-14 h-14 rounded-lg object-cover border border-ink-200" />
          </a>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-500">{when}</span>
            {entry.tag && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-ink-100 text-ink-700">
                {entry.tag}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-ink-900">{entry.title}</div>
          {entry.description && (
            <p className="mt-0.5 text-xs text-ink-600 line-clamp-2">{entry.description}</p>
          )}
        </div>
      </div>
    </li>
  );
}

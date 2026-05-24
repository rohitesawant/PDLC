import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Manage() {
  const { user } = useAuth();
  const society = user?.society;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-6">
        <Link to="/" className="text-sm text-ink-500 hover:text-ink-800">← Back to profile</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Manage</h1>
        <p className="mt-1 text-ink-500">
          Society administration{society ? ` — ${society.name}` : ''}.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ManageTile
          title="Members"
          desc="View societies enrolled with the federation. Edit details or approve their pending changes."
          to="/manage/members"
        />
        <ManageTile
          title="Committee"
          desc="The federation's 11-member elected committee — salutation, name, title, term dates. Shared across all admins."
          to="/manage/committee"
        />
        <ManageTile title="Documents" desc="Upload and manage share certificates, receipts, bye-laws." badge="Coming soon" />
        <ManageTile
          title="Invoices & Payments"
          desc="Generate invoices for registered societies and track membership payments."
          to="/manage/invoices"
        />
        <ManageTile
          title="Notices & circulars"
          desc="Publish information, GR and policy notices to all federation members or specific societies."
          to="/manage/notices"
        />
        <ManageTile title="Society settings" desc="Edit address, contact, and registration details." badge="Coming soon" />
      </div>
    </div>
  );
}

function ManageTile({
  title, desc, to, badge,
}: {
  title: string; desc: string; to?: string; badge?: string;
}) {
  const inner = (
    <div className="card p-5 h-full hover:border-ink-400 hover:shadow-card transition">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-ink-900">{title}</h3>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-ink-100 text-ink-700">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-500 leading-relaxed">{desc}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>;
}

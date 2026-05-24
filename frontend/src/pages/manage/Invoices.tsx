import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Invoice, type Society } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Field, Input, Select } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { rupeesInWords } from '../../lib/words';

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.invoices().then(setInvoices).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const totalAmount = useMemo(
    () => (invoices ?? []).reduce((s, i) => s + i.amount_inr, 0),
    [invoices],
  );
  const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link to="/manage" className="text-sm text-ink-500 hover:text-ink-800">← Back to Manage</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Invoices & Payments</h1>
          <p className="mt-1 text-ink-500">
            Generate invoices for registered societies and track membership payments.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-accent self-start sm:self-auto">
          + Generate invoice
        </button>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Tile label="Total invoices" value={(invoices?.length ?? 0).toString()} />
        <Tile label="Lifetime billed" value={rupees(totalAmount)} />
        <Tile label="Pending" value={(invoices ?? []).filter((i) => i.status === 'pending').length.toString()} tone="orange" />
      </div>

      {error && (
        <div className="rounded-lg border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">{error}</div>
      )}

      {invoices === null && !error && <p className="text-ink-500">Loading…</p>}

      {invoices && invoices.length === 0 && (
        <div className="card p-10 text-center">
          <h3 className="font-semibold text-ink-900">No invoices generated yet</h3>
          <p className="mt-1 text-sm text-ink-500">Click "Generate invoice" to bill the first society.</p>
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Society</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-ink-50/40">
                    <td className="px-4 py-3 font-mono font-semibold text-ink-900">{i.invoice_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-900">{i.society_name}</div>
                      <div className="text-xs text-ink-500">{i.society_area}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-700 whitespace-nowrap">{fmt(i.from_date)} → {fmt(i.to_date)}</td>
                    <td className="px-4 py-3 text-right text-ink-900 font-semibold">{rupees(i.amount_inr)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                        i.status === 'paid' ? 'bg-azure-100 text-azure-700' : 'bg-saffron-100 text-saffron-800'
                      }`}>{i.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmt(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <InvoiceCreateModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'orange' }) {
  const cls = tone === 'orange'
    ? 'border-saffron-100 bg-gradient-to-br from-saffron-50 to-white'
    : 'border-ink-200 bg-gradient-to-br from-ink-50 to-white';
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-bold text-ink-900">{value}</div>
    </div>
  );
}

// ===== Invoice Generate Modal =====
function InvoiceCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (i: Invoice) => void }) {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [societyId, setSocietyId] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState(defaultFrom());
  const [toDate, setToDate] = useState(defaultTo());
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.societies()
      .then((rows) => {
        setSocieties(rows);
        if (rows.length === 1) setSocietyId(rows[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const amountNumber = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const words = useMemo(() => rupeesInWords(amountNumber), [amountNumber]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!societyId) {
      setError('Please select a society to bill.');
      return;
    }
    if (amountNumber <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (fromDate > toDate) {
      setError('From date must be on or before To date.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createInvoice({
        society_id: societyId,
        from_date: fromDate,
        to_date: toDate,
        amount_inr: amountNumber,
        amount_in_words: words,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Generate invoice" maxWidth="max-w-2xl">
      {/* Letterhead */}
      <div className="border border-ink-200 rounded-xl p-5 mb-5 flex items-center gap-4 bg-ink-50/40">
        <Logo size={64} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-saffron-600">PCCHSF</div>
          <div className="text-base sm:text-lg font-bold text-ink-900 leading-tight">
            Pimpri Chinchwad Co-Operative Housing Societies Federation, Ltd.
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            Federation Office, Pimpri-Chinchwad, MH 411018 · GSTIN —
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">Document</div>
          <div className="text-base font-bold text-ink-900">INVOICE</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-saffron-200 bg-saffron-50 px-3 py-2 text-sm text-saffron-800">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Bill to (society)" required>
          <Select
            value={societyId}
            onChange={(e) => setSocietyId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="" disabled>Select a registered society…</option>
            {societies.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.area}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="From date" required>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
          </Field>
          <Field label="To date" required>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
          </Field>
        </div>

        <Field label="Amount (₹)" required hint="In Indian Rupees, whole numbers only">
          <Input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 15000"
            required
          />
        </Field>

        <div>
          <label className="label">Amount in words</label>
          <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-800 min-h-[42px] italic">
            {words || <span className="text-ink-400 not-italic">Enter an amount to see it in words…</span>}
          </div>
          <p className="help">Auto-generated from the amount above (Indian numbering: lakh / crore).</p>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Generating…' : 'Generate invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function defaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

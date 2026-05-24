import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, Input, Select, FormSection } from '../components/Field';
import { Logo } from '../components/Logo';
import { PCMC_AREAS } from '../lib/areas';
import { api, ApiError } from '../lib/api';

type FormErrors = Partial<Record<string, string>>;

export function SocietyRegister() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [topError, setTopError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTopError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      const val = typeof v === 'string' ? v.trim() : v;
      if (val !== '' && val !== null) payload[k] = val;
    });

    setSubmitting(true);
    try {
      await api.createSociety(payload);
      navigate('/login?registered=1');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues) {
          const next: FormErrors = {};
          err.issues.forEach((i) => {
            const k = String(i.path[0] ?? '');
            if (k) next[k] = i.message;
          });
          setErrors(next);
          setTopError('Please fix the highlighted fields.');
        } else {
          setTopError(err.message);
        }
      } else {
        setTopError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-white border-b border-ink-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo />
          <Link to="/login" className="text-sm text-ink-500 hover:text-ink-800">← Back to sign in</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Register your housing society</h1>
          <p className="mt-2 text-ink-600 max-w-2xl">
            Provide the society's official details. Once submitted, your society will appear on the
            federation directory with a "pending verification" status while we confirm with the
            Registrar of Cooperative Societies.
          </p>
        </div>

      {topError && (
        <div className="mb-6 rounded-lg border border-saffron-200 bg-saffron-50 px-4 py-3 text-sm text-saffron-800">
          {topError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <FormSection
          title="Society details"
          description="As registered with the Registrar of Cooperative Societies, Maharashtra."
        >
          <div className="sm:col-span-2">
            <Field label="Society name" required error={errors.name}>
              <Input name="name" placeholder="e.g. Shree Sai Residency CHS Ltd" required />
            </Field>
          </div>
          <Field label="Registration number" hint="Optional — can be added later" error={errors.registration_number}>
            <Input name="registration_number" placeholder="e.g. PNA/PCMC/HSG/(TC)/12345/2014" />
          </Field>
          <Field label="Year established" error={errors.year_established}>
            <Input name="year_established" type="number" placeholder="e.g. 2014" min={1900} max={new Date().getFullYear()} />
          </Field>
          <Field label="Total flats / units" error={errors.total_flats}>
            <Input name="total_flats" type="number" placeholder="e.g. 96" min={1} />
          </Field>
        </FormSection>

        <FormSection title="Address" description="Where the society is located within PCMC limits.">
          <div className="sm:col-span-2">
            <Field label="Address line 1" required error={errors.address_line1}>
              <Input name="address_line1" placeholder="Building / road" required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address line 2" error={errors.address_line2}>
              <Input name="address_line2" placeholder="Landmark, sector (optional)" />
            </Field>
          </div>
          <Field label="Area / locality" required error={errors.area}>
            <Select name="area" defaultValue="" required>
              <option value="" disabled>Select area</option>
              {PCMC_AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </Field>
          <Field label="PIN code" required error={errors.pincode}>
            <Input name="pincode" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="411019" required />
          </Field>
        </FormSection>

        <FormSection title="Office bearers" description="Current chairperson, secretary, and treasurer.">
          <Field label="Chairperson" error={errors.chairperson_name}>
            <Input name="chairperson_name" placeholder="Full name" />
          </Field>
          <Field label="Secretary" error={errors.secretary_name}>
            <Input name="secretary_name" placeholder="Full name" />
          </Field>
          <Field label="Treasurer" error={errors.treasurer_name}>
            <Input name="treasurer_name" placeholder="Full name" />
          </Field>
        </FormSection>

        <FormSection title="Society contact" description="Used by the federation to reach the managing committee.">
          <Field label="Contact email" required error={errors.contact_email}>
            <Input name="contact_email" type="email" placeholder="committee@example.com" required />
          </Field>
          <Field label="Contact phone" required hint="10-digit mobile" error={errors.contact_phone}>
            <Input name="contact_phone" inputMode="numeric" pattern="[6-9]\d{9}" maxLength={10} placeholder="9876543210" required />
          </Field>
        </FormSection>

        <div className="card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-ink-600">
            By submitting, you confirm you're authorised to register this society with the federation.
          </p>
          <div className="flex gap-3">
            <Link to="/login" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Proceed to Payment'}
            </button>
          </div>
        </div>
        </form>
      </div>
    </div>
  );
}

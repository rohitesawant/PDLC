import { useState } from 'react';
import { api, ApiError, type Society } from '../lib/api';
import { Field, Input, Select } from './Field';
import { Modal } from './Modal';
import { PCMC_AREAS } from '../lib/areas';

type FormErrors = Partial<Record<string, string>>;

type Props = {
  society: Society & { convenience_stores?: number | null };
  /** 'admin' applies the edit immediately; 'member' files a change request for admin approval. */
  mode: 'admin' | 'member';
  onClose: () => void;
  onSaved?: (s: Society) => void;
  onRequested?: () => void;
};

export function EditSocietyModal({ society, mode, onClose, onSaved, onRequested }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submittedAsRequest, setSubmittedAsRequest] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setTopError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      const val = typeof v === 'string' ? v.trim() : v;
      if (val !== '') payload[k] = val;
    });

    setSubmitting(true);
    try {
      if (mode === 'admin') {
        const updated = await api.updateSociety(society.id, payload);
        onSaved?.(updated);
        onClose();
      } else {
        await api.submitSocietyChangeRequest(society.id, payload);
        setSubmittedAsRequest(true);
        onRequested?.();
      }
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
        } else setTopError(err.message);
      } else setTopError('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedAsRequest) {
    return (
      <Modal onClose={onClose} title="Changes submitted for approval">
        <div className="text-center py-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-azure-100 text-azure-700 inline-flex items-center justify-center text-2xl mb-3">
            ✓
          </div>
          <h3 className="text-lg font-semibold text-ink-900">Submitted for admin approval</h3>
          <p className="mt-1.5 text-sm text-ink-500 max-w-md mx-auto">
            Your requested changes have been sent to the federation admin. They'll show up on the
            society profile once approved.
          </p>
          <button onClick={onClose} className="btn-primary mt-5">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={`${mode === 'admin' ? 'Edit' : 'Request changes for'} · ${society.name}`}>
      {mode === 'member' && (
        <div className="mb-4 rounded-lg border border-azure-200 bg-azure-50 px-3 py-2 text-xs text-azure-700">
          You'll submit these as a <strong>change request</strong>. The federation admin needs to
          approve before they appear on the society profile.
        </div>
      )}

      {topError && (
        <div className="mb-4 rounded-lg border border-saffron-200 bg-saffron-50 px-3 py-2 text-sm text-saffron-800">
          {topError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Society name" required error={errors.name}>
              <Input name="name" defaultValue={society.name} required />
            </Field>
          </div>
          <Field label="Registration number" error={errors.registration_number}>
            <Input name="registration_number" defaultValue={society.registration_number ?? ''} />
          </Field>
          <Field label="Year established" error={errors.year_established}>
            <Input name="year_established" type="number" defaultValue={society.year_established ?? ''} />
          </Field>
          <Field label="Total flats" error={errors.total_flats}>
            <Input name="total_flats" type="number" defaultValue={society.total_flats ?? ''} />
          </Field>
          <Field label="Convenience stores" error={errors.convenience_stores}>
            <Input name="convenience_stores" type="number" defaultValue={society.convenience_stores ?? 0} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address line 1" required error={errors.address_line1}>
              <Input name="address_line1" defaultValue={society.address_line1} required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address line 2" error={errors.address_line2}>
              <Input name="address_line2" defaultValue={society.address_line2 ?? ''} />
            </Field>
          </div>
          <Field label="Area" required error={errors.area}>
            <Select name="area" defaultValue={society.area} required>
              {PCMC_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="PIN code" required error={errors.pincode}>
            <Input name="pincode" defaultValue={society.pincode} pattern="\d{6}" maxLength={6} required />
          </Field>
          <Field label="Chairperson" error={errors.chairperson_name}>
            <Input name="chairperson_name" defaultValue={society.chairperson_name ?? ''} />
          </Field>
          <Field label="Secretary" error={errors.secretary_name}>
            <Input name="secretary_name" defaultValue={society.secretary_name ?? ''} />
          </Field>
          <Field label="Treasurer" error={errors.treasurer_name}>
            <Input name="treasurer_name" defaultValue={society.treasurer_name ?? ''} />
          </Field>
          <Field label="Contact email" required error={errors.contact_email}>
            <Input name="contact_email" type="email" defaultValue={society.contact_email} required />
          </Field>
          <Field label="Contact phone" required error={errors.contact_phone}>
            <Input name="contact_phone" defaultValue={society.contact_phone} pattern="[6-9]\d{9}" maxLength={10} required />
          </Field>
          {mode === 'admin' && (
            <Field label="Registration status" required error={errors.status}>
              <Select name="status" defaultValue={society.status ?? 'pending'} required>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? (mode === 'admin' ? 'Saving…' : 'Submitting…')
              : (mode === 'admin' ? 'Save changes' : 'Submit for approval')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

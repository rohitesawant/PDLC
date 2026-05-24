import { useEffect, useState } from 'react';
import { api, type Society } from '../lib/api';
import { Select } from './Field';

type Props = {
  name?: string;
  value?: number | '';
  onChange?: (id: number) => void;
  required?: boolean;
};

const STORAGE_KEY = 'vent.activeSociety';

export function useActiveSociety() {
  const [societyId, setSocietyId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });
  function update(id: number | null) {
    setSocietyId(id);
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
    else localStorage.removeItem(STORAGE_KEY);
  }
  return [societyId, update] as const;
}

export function SocietyPicker({ name = 'society_id', value, onChange, required }: Props) {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.societies().then(setSocieties).finally(() => setLoading(false));
  }, []);

  return (
    <Select
      name={name}
      value={value ?? ''}
      onChange={(e) => onChange?.(Number(e.target.value))}
      required={required}
      disabled={loading || societies.length === 0}
    >
      <option value="" disabled>
        {loading ? 'Loading…' : societies.length === 0 ? 'No societies registered' : 'Select your society'}
      </option>
      {societies.map((s) => (
        <option key={s.id} value={s.id}>{s.name} — {s.area}</option>
      ))}
    </Select>
  );
}

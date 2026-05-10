import { useRef, useState } from 'react';
import Modal from './Modal';
import Avatar from './Avatar';
import CurrencyCombobox from './CurrencyCombobox';
import { resizeImageToDataUrl } from '../lib/avatar';
import { createGroup, updateGroup } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Group } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal acts as an editor instead of a creator. */
  editing?: Group;
  onCreated?: (id: string) => void;
}

export default function GroupFormModal(props: Props) {
  // Re-mount the inner form whenever the modal opens or the edit
  // target changes, so initial form state can be derived from props
  // without resorting to setState-inside-effect.
  if (!props.open) return null;
  const formKey = props.editing?.id ?? 'new';
  return <GroupFormModalInner key={formKey} {...props} />;
}

function GroupFormModalInner({ open, onClose, editing, onCreated }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [currency, setCurrency] = useState(editing?.defaultCurrency ?? 'EUR');
  const [avatar, setAvatar] = useState<string | undefined>(editing?.avatarDataUrl);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  async function handleAvatarPick(file?: File) {
    if (!file) return;
    try {
      const data = await resizeImageToDataUrl(file, 400);
      setAvatar(data);
    } catch (err) {
      console.error(err);
      pushToast({ kind: 'error', message: 'Could not read image.' });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      if (editing) {
        await updateGroup(editing.id, {
          name: trimmed,
          description: description.trim() || undefined,
          defaultCurrency: currency,
          avatarDataUrl: avatar,
        });
        pushToast({ kind: 'success', message: 'Trip updated' });
      } else {
        const g = await createGroup({
          name: trimmed,
          description: description.trim() || undefined,
          defaultCurrency: currency,
          avatarDataUrl: avatar,
        });
        pushToast({ kind: 'success', message: 'Trip created' });
        onCreated?.(g.id);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit trip' : 'New trip'}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group rounded-full"
            aria-label="Choose avatar image"
          >
            <Avatar name={name || 'Trip'} src={avatar} size={64} />
            <span className="absolute inset-0 rounded-full bg-slate-900/0 group-hover:bg-slate-900/30 grid place-items-center text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition">
              Change
            </span>
          </button>
          <div className="text-xs text-slate-500 leading-snug">
            Optional avatar.
            <br />
            Resized to 400×400 on device.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarPick(e.target.files?.[0] ?? undefined)}
          />
          {avatar ? (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => setAvatar(undefined)}
            >
              Remove
            </button>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="grp-name">
            Name
          </label>
          <input
            id="grp-name"
            className="input"
            placeholder="Greece 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="grp-desc">
            Description
          </label>
          <textarea
            id="grp-desc"
            className="input"
            rows={2}
            placeholder="Optional — who, when, why"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Default currency</label>
          <CurrencyCombobox value={currency} onChange={setCurrency} />
          <p className="text-[11px] text-slate-500 mt-1.5">
            Used as the suggested currency when adding new expenses.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {editing ? 'Save changes' : 'Create trip'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

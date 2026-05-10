import { useState } from 'react';
import Avatar from './Avatar';
import EmptyState from './EmptyState';
import { addMember, deleteMember, renameMember } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Member } from '../types';

export default function MembersTab({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const pushToast = useUI((s) => s.pushToast);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await addMember(groupId, trimmed);
    setName('');
  }

  async function handleSaveRename(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    await renameMember(id, trimmed);
    setEditingId(null);
    setEditingName('');
  }

  async function handleDelete(id: string) {
    const sure = window.confirm(
      'Remove this member? Their existing expense involvement remains.',
    );
    if (!sure) return;
    await deleteMember(id);
    pushToast({ kind: 'success', message: 'Member removed' });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="card p-3 flex items-center gap-2">
        <input
          className="input"
          placeholder="Add a member name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add at least one person before recording expenses."
        />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-3">
              <Avatar name={m.displayName} size={36} />
              {editingId === m.id ? (
                <input
                  autoFocus
                  className="input flex-1"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveRename(m.id);
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditingName('');
                    }
                  }}
                />
              ) : (
                <div className="flex-1 font-medium text-slate-900 truncate">
                  {m.displayName}
                </div>
              )}
              {editingId === m.id ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleSaveRename(m.id)}
                >
                  Save
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditingName(m.displayName);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                    onClick={() => void handleDelete(m.id)}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

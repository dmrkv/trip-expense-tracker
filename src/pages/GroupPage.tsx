import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import Avatar from '../components/Avatar';
import GroupFormModal from '../components/GroupFormModal';
import ExpensesTab from '../components/ExpensesTab';
import BalancesTab from '../components/BalancesTab';
import MembersTab from '../components/MembersTab';
import AddExpenseModal from '../components/AddExpenseModal';
import ShareTripBackupModal from '../components/ShareTripBackupModal';
import { deleteGroup, exportGroupReplacePayload } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Member } from '../types';

const TABS = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'members', label: 'Members' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function GroupPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const pushToast = useUI((s) => s.pushToast);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBackupJson, setShareBackupJson] = useState<string | null>(null);
  const [shareBackupLoading, setShareBackupLoading] = useState(false);
  const [shareBackupError, setShareBackupError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const group = useLiveQuery(() => (id ? db.groups.get(id) : undefined), [id]);
  const members = useLiveQuery<Member[], Member[]>(
    () =>
      id
        ? db.members.where('groupId').equals(id).sortBy('sortOrder')
        : Promise.resolve<Member[]>([]),
    [id],
    [],
  );

  const activeTab: TabKey = useMemo(() => {
    const found = TABS.find((t) => t.key === tab);
    return found?.key ?? 'expenses';
  }, [tab]);

  if (!id) return null;
  if (group === undefined) {
    return <div className="py-10 text-center text-slate-400">Loading…</div>;
  }
  if (group === null) {
    return (
      <div className="py-10 text-center">
        <p className="text-slate-600">This trip no longer exists.</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">
          Back to trips
        </Link>
      </div>
    );
  }

  async function handleDelete() {
    if (!group) return;
    const sure = window.confirm(
      `Delete "${group.name}"? This removes all members, expenses and transfers.`,
    );
    if (!sure) return;
    await deleteGroup(group.id);
    pushToast({ kind: 'success', message: 'Trip deleted' });
    navigate('/', { replace: true });
  }

  function closeShareModal() {
    setShareOpen(false);
    setShareBackupJson(null);
    setShareBackupError(null);
    setShareBackupLoading(false);
  }

  async function openShareModal() {
    if (!id) return;
    setShareOpen(true);
    setShareBackupJson(null);
    setShareBackupError(null);
    setShareBackupLoading(true);
    try {
      const payload = await exportGroupReplacePayload(id);
      setShareBackupJson(JSON.stringify(payload, null, 2));
    } catch (e) {
      setShareBackupError(e instanceof Error ? e.message : 'Could not export trip');
    } finally {
      setShareBackupLoading(false);
    }
  }

  function openAddExpense() {
    if (members.length === 0) {
      pushToast({
        kind: 'info',
        message: 'Add a member before recording an expense.',
      });
      return;
    }
    setAdding(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar name={group.name} src={group.avatarDataUrl} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 truncate">{group.name}</h1>
          </div>
          {group.description ? (
            <p className="text-sm text-slate-500 mt-0.5">{group.description}</p>
          ) : null}
          <div className="text-xs text-slate-400 mt-1">
            {members.length} {members.length === 1 ? 'member' : 'members'} · default{' '}
            {group.defaultCurrency}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="btn-secondary min-h-10 px-3 py-2 text-sm gap-1.5"
            onClick={() => void openShareModal()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3v12m0 0l4-4m-4 4L8 11M5 19h14a2 2 0 002-2v-3"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Share
          </button>
          <div className="relative">
            <button
              type="button"
              className="btn-ghost min-h-10 w-10 p-0 grid place-items-center"
              aria-label="Trip menu"
              onClick={() => setShowMenu((s) => !s)}
              onBlur={() => setTimeout(() => setShowMenu(false), 120)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="5" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="19" r="1.6" fill="currentColor" />
              </svg>
            </button>
            {showMenu ? (
              <div className="absolute right-0 mt-1 z-20 w-40 rounded-xl bg-white shadow-lg border border-slate-200 overflow-hidden text-sm">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEditing(true);
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                >
                  Edit trip
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleDelete();
                  }}
                  className="block w-full text-left px-3 py-2 text-red-600 hover:bg-red-50"
                >
                  Delete trip
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1">
        {TABS.map((t) => (
          <NavLink
            key={t.key}
            to={t.key === 'expenses' ? `/group/${id}` : `/group/${id}/${t.key}`}
            end
            className={({ isActive }) =>
              `flex-1 text-center text-sm font-medium py-2 rounded-lg transition ${
                (isActive && t.key !== 'expenses') ||
                (t.key === 'expenses' && activeTab === 'expenses')
                  ? 'bg-accent/10 text-accent-700'
                  : 'text-slate-600'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {activeTab === 'expenses' ? (
        <ExpensesTab groupId={id} members={members} onRequestAddExpense={openAddExpense} />
      ) : null}
      {activeTab === 'balances' ? (
        <BalancesTab groupId={id} members={members} />
      ) : null}
      {activeTab === 'members' ? (
        <MembersTab groupId={id} members={members} />
      ) : null}

      {/* Floating add expense button */}
      <button
        type="button"
        onClick={openAddExpense}
        className="fixed right-4 z-30 btn-primary h-14 w-14 rounded-full p-0 shadow-lg"
        style={{ bottom: 'calc(72px + var(--safe-bottom))' }}
        aria-label="Add expense"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <GroupFormModal
        open={editing}
        onClose={() => setEditing(false)}
        editing={group}
      />
      <AddExpenseModal
        open={adding}
        onClose={() => setAdding(false)}
        group={group}
        members={members}
      />
      <ShareTripBackupModal
        open={shareOpen}
        onClose={closeShareModal}
        groupName={group.name}
        backupJson={shareBackupJson}
        backupLoading={shareBackupLoading}
        backupError={shareBackupError}
      />
    </div>
  );
}

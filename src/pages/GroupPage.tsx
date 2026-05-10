import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, MoreVertical, Plus, Users } from 'lucide-react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import Avatar from '../components/Avatar';
import GroupFormModal from '../components/GroupFormModal';
import ExpensesTab from '../components/ExpensesTab';
import BalancesPanel from '../components/BalancesPanel';
import MembersTab from '../components/MembersTab';
import AddExpenseModal from '../components/AddExpenseModal';
import AddSettlementModal from '../components/AddSettlementModal';
import ShareTripBackupModal from '../components/ShareTripBackupModal';
import { deleteGroup, exportGroupReplacePayload } from '../lib/repo';
import { useUI } from '../store/ui';
import type { ExportPayload } from '../lib/repo';
import type { Expense, Member } from '../types';

type ExpenseModalState = null | { mode: 'add' } | { mode: 'edit'; expense: Expense };

const TABS = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'members', label: 'Members' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function useIsLgUp() {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    function apply() {
      setLg(mq.matches);
    }
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return lg;
}

export default function GroupPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const pushToast = useUI((s) => s.pushToast);
  const [editing, setEditing] = useState(false);
  const [expenseModal, setExpenseModal] = useState<ExpenseModalState>(null);
  const [settling, setSettling] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBackupPayload, setShareBackupPayload] = useState<ExportPayload | null>(null);
  const [shareBackupLoading, setShareBackupLoading] = useState(false);
  const [shareBackupError, setShareBackupError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const isLgUp = useIsLgUp();

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

  const visibleTabs = useMemo(
    () => (isLgUp ? TABS.filter((t) => t.key !== 'balances') : TABS),
    [isLgUp],
  );

  const mainTab: 'expenses' | 'members' | 'balances' = useMemo(() => {
    if (!isLgUp && activeTab === 'balances') return 'balances';
    if (isLgUp && activeTab === 'balances') return 'expenses';
    if (activeTab === 'members') return 'members';
    return 'expenses';
  }, [isLgUp, activeTab]);

  const expensesTabSelected =
    activeTab === 'expenses' || (isLgUp && activeTab === 'balances');

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
    setShareBackupPayload(null);
    setShareBackupError(null);
    setShareBackupLoading(false);
  }

  async function openShareModal() {
    if (!id) return;
    setShareOpen(true);
    setShareBackupPayload(null);
    setShareBackupError(null);
    setShareBackupLoading(true);
    try {
      const payload = await exportGroupReplacePayload(id);
      setShareBackupPayload(payload);
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
    setExpenseModal({ mode: 'add' });
  }

  function closeExpenseModal() {
    setExpenseModal(null);
  }

  function openAddSettlement() {
    if (members.length < 2) {
      pushToast({
        kind: 'info',
        message: 'Add at least two members to record a payment between people.',
      });
      return;
    }
    setSettling(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
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
        </div>
        <div className="flex items-center gap-1 shrink-0 justify-end sm:justify-start flex-wrap sm:flex-nowrap">
          <button
            type="button"
            className="btn-primary min-h-10 px-3 py-2 text-sm gap-1.5"
            onClick={openAddExpense}
          >
            <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add expense</span>
          </button>
          <button
            type="button"
            className="btn-secondary min-h-10 px-3 py-2 text-sm gap-1.5"
            onClick={openAddSettlement}
            title="Record a payment between members"
          >
            <ArrowRightLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="sm:hidden">Pay</span>
            <span className="hidden sm:inline">Settle</span>
          </button>
          <button
            type="button"
            className="btn-secondary min-h-10 px-3 py-2 text-sm gap-1.5"
            onClick={() => void openShareModal()}
          >
            <Users className="h-[18px] w-[18px] shrink-0" aria-hidden />
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
              <MoreVertical className="h-5 w-5" aria-hidden />
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

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-6 lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1">
            {visibleTabs.map((t) => (
              <NavLink
                key={t.key}
                to={t.key === 'expenses' ? `/group/${id}` : `/group/${id}/${t.key}`}
                end
                className={() =>
                  `flex-1 text-center text-sm font-medium py-2 rounded-lg transition ${
                    (t.key === 'expenses' && expensesTabSelected) ||
                    (t.key === 'members' && activeTab === 'members')
                      ? 'bg-accent/10 text-accent-700'
                      : 'text-slate-600'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>

          {mainTab === 'expenses' ? (
            <ExpensesTab
              groupId={id}
              members={members}
              onRequestAddExpense={openAddExpense}
              onEditExpense={(expense) => setExpenseModal({ mode: 'edit', expense })}
            />
          ) : null}
          {mainTab === 'members' ? (
            <MembersTab groupId={id} members={members} />
          ) : null}
          {mainTab === 'balances' ? (
            <BalancesPanel
              groupId={id}
              members={members}
              onRequestRecordSettlement={openAddSettlement}
              variant="standalone"
            />
          ) : null}
        </div>

        {isLgUp ? (
          <aside
            className="flex flex-col mt-0 rounded-xl border border-slate-200 bg-white shadow-sm p-4 min-h-[min(640px,calc(100vh-var(--safe-top)-4rem-var(--safe-bottom)-3rem))] max-h-[calc(100vh-var(--safe-top)-4rem-var(--safe-bottom)-2rem)] lg:sticky lg:top-[calc(var(--safe-top)+3.5rem+0.75rem)]"
            aria-label="Balances"
          >
            <BalancesPanel
              groupId={id}
              members={members}
              onRequestRecordSettlement={openAddSettlement}
              variant="sidebar"
            />
          </aside>
        ) : null}
      </div>

      <GroupFormModal
        open={editing}
        onClose={() => setEditing(false)}
        editing={group}
      />
      <AddExpenseModal
        open={expenseModal !== null}
        onClose={closeExpenseModal}
        group={group}
        members={members}
        initialExpense={expenseModal?.mode === 'edit' ? expenseModal.expense : undefined}
      />
      <AddSettlementModal
        open={settling}
        onClose={() => setSettling(false)}
        group={group}
        members={members}
      />
      <ShareTripBackupModal
        open={shareOpen}
        onClose={closeShareModal}
        groupName={group.name}
        backupPayload={shareBackupPayload}
        backupLoading={shareBackupLoading}
        backupError={shareBackupError}
      />
    </div>
  );
}

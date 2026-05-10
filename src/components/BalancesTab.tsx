import BalancesPanel from './BalancesPanel';
import type { Member } from '../types';

export default function BalancesTab({
  groupId,
  members,
  onRequestRecordSettlement,
}: {
  groupId: string;
  members: Member[];
  onRequestRecordSettlement?: () => void;
}) {
  return (
    <BalancesPanel
      groupId={groupId}
      members={members}
      onRequestRecordSettlement={onRequestRecordSettlement}
      variant="standalone"
    />
  );
}

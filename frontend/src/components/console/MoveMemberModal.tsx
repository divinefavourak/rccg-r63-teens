/**
 * Move a member to another part of the church.
 *
 * `POST /identity/memberships/<id>/transfer/`. The server asks for
 * `memberships.manage` over both where the person is leaving and where they
 * are going, records the move, makes the new node their home and ends the
 * membership they left.
 *
 * The list is the caller's own tree, so it only offers places they can see.
 * Whether they may move someone *into* each one is the server's decision, and
 * its refusal is shown as it words it.
 */
import { useMemo, useState } from 'react';
import api from '../../api/axios';
import { useHierarchy } from '../../hooks/useHierarchy';
import { NODE_TYPE_LABELS, type ConsoleMembership } from '../../types/console';
import { AlertBanner, Btn, Modal, SearchField, Skeleton } from './primitives';

const LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';

export const MoveMemberModal = ({
  membership,
  name,
  onClose,
  onMoved,
}: {
  membership: ConsoleMembership;
  name: string;
  onClose: () => void;
  onMoved: (message: string) => void;
}) => {
  const hierarchy = useHierarchy();
  const [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const places = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = new Map(hierarchy.nodes.map((n) => [n.path, n.name]));
    return hierarchy.nodes
      .filter(
        (n) =>
          n.selectable &&
          n.is_active !== false &&
          n.id !== membership.organization_node &&
          (!q || n.name.toLowerCase().includes(q)),
      )
      .slice(0, 60)
      .map((n) => ({
        node: n,
        // The parent's name, to tell two parishes of the same name apart.
        under: names.get(n.path.slice(0, -4)),
      }));
  }, [hierarchy.nodes, query, membership.organization_node]);

  const target = hierarchy.nodes.find((n) => n.id === targetId) ?? null;
  const from = membership.organization_node_detail?.name ?? 'where they are now';

  const move = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/identity/memberships/${membership.id}/transfer/`, {
        to_node: target.id,
        reason: reason.trim(),
      });
      onMoved(`${name} now belongs to ${target.name}.`);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const first = data ? Object.values(data).flat()[0] : undefined;
      setError(
        typeof first === 'string'
          ? first
          : "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Move ${name}`}
      subtitle={`From ${from}. Their roles are not changed by a move; end or assign those separately.`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Btn size="md" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" size="md" disabled={!target || busy} onClick={move}>
            {busy ? 'Moving…' : target ? `Move to ${target.name}` : 'Choose where'}
          </Btn>
        </>
      }
    >
      {error && (
        <AlertBanner kind="error" className="mb-3">
          {error}
        </AlertBanner>
      )}

      <div className="[&>label]:w-full sm:[&>label]:w-full">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Find where to move them"
          placeholder="Find a province, zone, area or parish"
        />
      </div>

      <div
        role="listbox"
        aria-label="Where to move them"
        className="console-scroll mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto"
      >
        {hierarchy.isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : places.length === 0 ? (
          <p className="py-4 text-center text-[14px] leading-5 text-console-body">
            {query.trim()
              ? `Nowhere you can see is called “${query.trim()}”.`
              : 'There is nowhere else in your part of the church to move them to.'}
          </p>
        ) : (
          places.map(({ node, under }) => {
            const chosen = node.id === targetId;
            return (
              <button
                key={node.id}
                type="button"
                role="option"
                aria-selected={chosen}
                onClick={() => setTargetId(node.id)}
                className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-full px-3.5 py-1.5 text-left text-[14px] leading-5 transition-colors ${
                  chosen
                    ? 'bg-console-action text-console-on-action'
                    : 'text-console-text hover:bg-console-tinted'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{node.name}</span>
                <span className="shrink-0 text-[12px] font-medium opacity-70">
                  {NODE_TYPE_LABELS[node.node_type]}
                  {under ? ` in ${under}` : ''}
                </span>
              </button>
            );
          })
        )}
      </div>

      <label className="mt-3 block">
        <span className={LABEL}>Why (optional, kept with the record of the move)</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3.5 py-2.5 text-[16px] leading-6 text-console-text outline-none transition-colors focus:border-console-text"
        />
      </label>
    </Modal>
  );
};

export default MoveMemberModal;

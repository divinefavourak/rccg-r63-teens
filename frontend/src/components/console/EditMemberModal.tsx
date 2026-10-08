/**
 * Edit a member's account details.
 *
 * `PATCH /auth/users/<id>/`, which needs `users.manage`. The form is filled
 * from `GET /auth/users/<id>/` rather than from the People row: the row names a
 * person and carries nothing else.
 *
 * Deliberately not here:
 *
 * * the legacy `role` field. The endpoint accepts it, and setting it to admin
 *   makes the account a superuser. Authority in the Console is granted with
 *   Assign a role, which checks what the granter is allowed to give;
 * * province, zone, area and parish as text. Where someone belongs is their
 *   membership of a node in the tree, not a typed string.
 *
 * Deactivating is the one consequential control. It stops the person signing
 * in, so it is worded as that and asks before it saves.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import { Btn, ErrorState, Modal, Skeleton } from './primitives';

/** `UserSerializer`, the fields this form reads. */
interface Account {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  is_active: boolean;
}

const LABEL =
  'block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted';
const INPUT =
  'mt-1 w-full rounded-console-md border-2 border-transparent bg-console-tinted px-3.5 py-2.5 text-[16px] leading-6 text-console-text outline-none transition-colors focus:border-console-text';

const NAMES: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  phone: 'Phone',
  gender: 'Gender',
  is_active: 'Account',
};

const Form = ({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: (name: string) => void;
}) => {
  const [form, setForm] = useState({
    first_name: account.first_name ?? '',
    last_name: account.last_name ?? '',
    email: account.email ?? '',
    phone: account.phone ?? '',
    gender: account.gender ?? '',
    is_active: account.is_active,
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingOff, setConfirmingOff] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const name = `${form.first_name} ${form.last_name}`.trim() || account.email;
  const turningOff = account.is_active && !form.is_active;
  const ready = form.first_name.trim() && form.email.trim();

  const save = async () => {
    // Turning an account off is asked about once, in the footer, before it goes.
    if (turningOff && !confirmingOff) {
      setConfirmingOff(true);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      // Only what changed, so an untouched field is never written back.
      const changed: Record<string, unknown> = {};
      for (const key of Object.keys(form) as (keyof typeof form)[]) {
        const next = typeof form[key] === 'string' ? (form[key] as string).trim() : form[key];
        if (next !== (account[key] ?? '')) changed[key] = next;
      }
      if (Object.keys(changed).length > 0) {
        await api.patch(`/auth/users/${account.id}/`, changed);
      }
      onSaved(name);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const mapped: Record<string, string> = {};
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          mapped[k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
      }
      setErrors(
        Object.keys(mapped).length
          ? mapped
          : { detail: "We couldn't reach the server. Check your connection and try again." },
      );
      setConfirmingOff(false);
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <span className="mt-1 block text-[12px] font-medium leading-4 text-console-danger">
        {errors[key]}
      </span>
    ) : null;

  const other = Object.entries(errors).filter(([key]) => !(key in form));

  return (
    <Modal
      title={`Edit ${`${account.first_name} ${account.last_name}`.trim() || account.email}`}
      subtitle="Their name and how to reach them. Roles are changed with Assign role."
      onClose={onClose}
      width={560}
      footer={
        confirmingOff ? (
          <>
            <p className="mr-auto text-[14px] leading-5 text-console-body">
              {name} will not be able to sign in. Nothing is deleted.
            </p>
            <Btn size="md" onClick={() => setConfirmingOff(false)} disabled={busy}>
              Go back
            </Btn>
            <Btn variant="danger" size="md" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Deactivate and save'}
            </Btn>
          </>
        ) : (
          <>
            <Btn size="md" onClick={onClose} disabled={busy}>
              Cancel
            </Btn>
            <Btn variant="primary" size="md" onClick={save} disabled={!ready || busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Btn>
          </>
        )
      }
    >
      {other.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-console-lg bg-console-danger-bg px-3.5 py-3 text-[14px] leading-5 text-console-text"
        >
          <p className="font-semibold">These details weren't saved.</p>
          <ul className="mt-1 list-disc pl-5">
            {other.map(([key, message]) => (
              <li key={key}>
                {key === 'detail' || key === 'non_field_errors'
                  ? message
                  : `${NAMES[key] ?? key.replace(/_/g, ' ')}: ${message}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>First name</span>
          <input
            className={INPUT}
            value={form.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            autoComplete="off"
          />
          {fieldError('first_name')}
        </label>
        <label className="block">
          <span className={LABEL}>Last name</span>
          <input
            className={INPUT}
            value={form.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            autoComplete="off"
          />
          {fieldError('last_name')}
        </label>
        <label className="block sm:col-span-2">
          <span className={LABEL}>Email</span>
          <input
            type="email"
            className={INPUT}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {fieldError('email')}
        </label>
        <label className="block">
          <span className={LABEL}>Phone</span>
          <input
            type="tel"
            className={INPUT}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            autoComplete="off"
          />
          {fieldError('phone')}
        </label>
        <label className="block">
          <span className={LABEL}>Gender</span>
          <select
            className={INPUT}
            value={form.gender}
            onChange={(e) => set('gender', e.target.value)}
          >
            <option value="">Not recorded</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="not_specified">Prefer not to say</option>
          </select>
          {fieldError('gender')}
        </label>
        <label className="flex items-start gap-2.5 rounded-console-md bg-console-tinted px-3.5 py-3 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.is_active}
            onChange={(e) => {
              set('is_active', e.target.checked);
              setConfirmingOff(false);
            }}
          />
          <span>
            <span className="block text-[14px] font-semibold leading-5 text-console-text">
              This person can sign in
            </span>
            <span className="block text-[12px] font-medium leading-4 text-console-muted">
              Untick to deactivate the account. Their history and registrations stay.
            </span>
          </span>
        </label>
        {fieldError('is_active')}
      </div>
    </Modal>
  );
};

export const EditMemberModal = ({
  userId,
  name,
  onClose,
  onSaved,
}: {
  userId: string;
  /** Shown while the account loads. */
  name: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) => {
  const account = useQuery({
    queryKey: ['account', userId],
    queryFn: async () => (await api.get<Account>(`/auth/users/${userId}/`)).data,
    // Always the record as it is now: a form filled from a cached copy would
    // save someone else's earlier edit back over a newer one.
    gcTime: 0,
  });

  if (account.data) {
    return <Form account={account.data} onClose={onClose} onSaved={onSaved} />;
  }

  return (
    <Modal title={`Edit ${name}`} onClose={onClose} width={560}>
      {account.isError ? (
        <ErrorState
          message={`We couldn't open ${name}'s details. Try again.`}
          onRetry={() => account.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-console-md" />
          <Skeleton className="h-12 w-full rounded-console-md" />
          <Skeleton className="h-12 w-2/3 rounded-console-md" />
        </div>
      )}
    </Modal>
  );
};

export default EditMemberModal;

/**
 * Settings — your account, and what your authority actually is.
 *
 * The only Console screen with no permission gate: everyone who can sign in has
 * a profile. What differs is the second half, which spells out the permissions
 * behind every other screen's behaviour.
 *
 * That transparency is the point. When a coordinator asks "why can't I publish?",
 * the answer should be a page they can read, not a support conversation.
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Btn,
  Card,
  CardHeader,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useTheme } from '../../hooks/useTheme';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  NODE_TYPE_LABELS,
} from '../../types/console';

export const Settings = () => {
  const { me, permissions, assignments, refresh } = useConsoleAuth();
  const { theme, toggleTheme } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(me?.profile?.display_name ?? '');
  }, [me]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/identity/profile/', { display_name: displayName });
      await refresh();
      setSaved(true);
    } catch {
      setError('Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }, [displayName, refresh]);

  return (
    <ScreenShell
      title="Settings"
      subtitle="Your account, and exactly what your role lets you do."
      hideScope
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="text-[13px] font-semibold text-console-text">
              Your profile
            </span>
          </CardHeader>
          <div className="space-y-3 p-4">
            <div>
              <label className="block text-[11px] font-medium text-console-body">
                Display name
              </label>
              <input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSaved(false);
                }}
                className="mt-1 w-full rounded-console-md border border-console-border bg-console-surface px-2.5 py-2 text-[13px] text-console-text outline-none focus:border-console-action"
              />
              <p className="mt-1 text-[11px] text-console-subtle">
                How you appear in People, the audit log, and to anyone you appoint.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                  Username
                </span>
                <span className="text-console-body">{me?.username}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
                  Email
                </span>
                <span className="truncate text-console-body">{me?.email}</span>
              </div>
            </div>

            {error && (
              <p className="text-[12px] text-console-danger">{error}</p>
            )}

            <div className="flex items-center gap-2">
              <Btn variant="primary" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </Btn>
              {saved && (
                <span className="flex items-center gap-1 text-[12px] text-console-success">
                  <Check size={13} /> Saved
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-[13px] font-semibold text-console-text">
              Appearance
            </span>
          </CardHeader>
          <div className="p-4">
            <Btn variant="secondary" size="md" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              Switch to {theme === 'dark' ? 'light' : 'dark'} mode
            </Btn>
            <p className="mt-2 text-[11px] text-console-subtle">
              Shared with the teen app — changing it here changes it there too.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <span className="text-[13px] font-semibold text-console-text">
            Your authority
          </span>
          <Badge tone="neutral">
            {me?.is_superuser ? 'all 21' : `${permissions.size} of 21`}
          </Badge>
        </CardHeader>

        <div className="p-4">
          {assignments.length === 0 ? (
            <p className="text-[13px] text-console-muted">
              {me?.is_superuser
                ? 'You are a Django superuser, which grants every permission everywhere regardless of role assignments.'
                : 'You hold no role. Whoever appointed you can grant one.'}
            </p>
          ) : (
            <ul className="mb-4 space-y-1.5">
              {assignments.map((a) => (
                <li key={a.id} className="text-[13px] text-console-body">
                  <span className="font-medium text-console-text">
                    {a.role_detail?.label}
                  </span>
                  {a.node_detail && (
                    <>
                      {' at '}
                      {a.node_detail.name}
                      <span className="text-console-subtle">
                        {' '}
                        ({NODE_TYPE_LABELS[a.node_detail.node_type]})
                      </span>
                    </>
                  )}
                  <span className="text-console-subtle">
                    {' '}
                    · since {a.start_date}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-console-subtle">
            What that lets you do
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((code) => {
              const has = permissions.has(code);
              return (
                <div
                  key={code}
                  className={`flex items-start gap-2 rounded-console-sm px-2 py-1.5 text-[12px] ${
                    has ? 'bg-console-action-light' : 'bg-console-tinted'
                  }`}
                >
                  {has ? (
                    <Check
                      size={13}
                      className="mt-0.5 shrink-0 text-console-action"
                    />
                  ) : (
                    <span className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                  <span
                    className={
                      has ? 'text-console-body' : 'text-console-disabled'
                    }
                  >
                    {PERMISSION_LABELS[code]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
};

export default Settings;

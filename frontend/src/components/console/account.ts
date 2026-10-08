/**
 * Who is signed in and in what capacity, as the shell shows it.
 *
 * The role is the holder's *highest* active assignment. `assignments` is sorted
 * most-authoritative first by the context, so that is simply the first one.
 */
import { useConsoleAuth } from '../../context/ConsoleAuthContext';

export function useAccountLabel() {
  const { me, assignments } = useConsoleAuth();

  const primary = assignments[0];
  const roleLabel = me?.is_superuser
    ? 'Superuser'
    : (primary?.role_detail?.label ?? 'No role assigned');

  const displayName =
    me?.profile?.display_name ||
    [me?.first_name, me?.last_name].filter(Boolean).join(' ') ||
    me?.username ||
    '';

  return {
    displayName,
    roleLabel,
    roleNode: primary?.node_detail?.name,
    firstName: displayName.split(' ')[0] ?? '',
  };
}

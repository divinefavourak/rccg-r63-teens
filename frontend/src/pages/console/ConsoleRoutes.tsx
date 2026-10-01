/**
 * The Console's entire route tree, in one lazy-loaded chunk.
 *
 * Mounted as a single splat route from `App.tsx` so that none of the Console —
 * shell, permission context, screens — lands in the bundle a teen downloads to
 * read a devotional. The Console is staff software; it should cost nothing to
 * everyone who never opens it.
 *
 * `ConsoleAuthProvider` wraps only this subtree for the same reason: mounting it
 * globally would fire `/identity/me/` on the public landing page for users who
 * have no roles and no use for the answer.
 */
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import {
  ConsoleAuthProvider,
  useConsoleAuth,
} from '../../context/ConsoleAuthContext';
import ConsoleLayout from '../../components/console/ConsoleLayout';
import { PermissionDenied } from '../../components/console/PermissionGate';
import { navItemFor } from '../../components/console/navigation';

import Overview from './Overview';
import People from './People';
import Hierarchy from './Hierarchy';
import Roles from './Roles';
import Content from './Content';
import Review from './Review';
import Manuals from './Manuals';
import Media from './Media';
import Bible from './Bible';
import Events from './Events';
import CheckIn from './CheckIn';
import MyClass from './MyClass';
import Notifications from './Notifications';
import Analytics from './Analytics';
import Settings from './Settings';
import AuditLog from './AuditLog';

/**
 * Gates a screen reached by direct URL.
 *
 * The sidebar never offers an unreachable screen, so landing here means a deep
 * link or a stale bookmark — an accident rather than an attempt. The check
 * reuses the same `access` predicate the sidebar uses, so a screen can never be
 * reachable by URL but absent from the nav, or the reverse.
 *
 * This is a UI courtesy, not a security boundary. Every endpoint behind these
 * screens enforces its own permission server-side.
 */
const Gated = ({ navId, children }: { navId: string; children: ReactNode }) => {
  const { permissions } = useConsoleAuth();
  const item = navItemFor(navId);
  if (item && item.access(permissions) === false) {
    return <PermissionDenied screenName={item.label} />;
  }
  return <>{children}</>;
};

/** Route id -> screen. Ids match `NAV_ITEMS`, which is what keeps the two in step. */
const SCREENS: { id: string; element: ReactNode }[] = [
  { id: 'people', element: <People /> },
  { id: 'hierarchy', element: <Hierarchy /> },
  { id: 'roles', element: <Roles /> },
  { id: 'content', element: <Content /> },
  { id: 'review', element: <Review /> },
  { id: 'manuals', element: <Manuals /> },
  { id: 'media', element: <Media /> },
  { id: 'bible', element: <Bible /> },
  { id: 'events', element: <Events /> },
  { id: 'check-in', element: <CheckIn /> },
  { id: 'my-class', element: <MyClass /> },
  { id: 'notifications', element: <Notifications /> },
  { id: 'analytics', element: <Analytics /> },
  { id: 'settings', element: <Settings /> },
  { id: 'audit-log', element: <AuditLog /> },
];

export const ConsoleRoutes = () => (
  <ConsoleAuthProvider>
    <Routes>
      <Route element={<ConsoleLayout />}>
        <Route index element={<Overview />} />
        {SCREENS.map(({ id, element }) => (
          <Route
            key={id}
            path={id}
            element={<Gated navId={id}>{element}</Gated>}
          />
        ))}
        <Route path="*" element={<PermissionDenied screenName="That screen" />} />
      </Route>
    </Routes>
  </ConsoleAuthProvider>
);

export default ConsoleRoutes;

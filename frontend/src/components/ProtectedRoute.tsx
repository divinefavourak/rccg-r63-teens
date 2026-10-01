import { type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import Loader from './Loader';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Restrict by legacy `User.role`. Omit to require only that the visitor is
   * signed in — which is what the Console does, because what it shows is decided
   * by the 21 permissions from `/identity/me/`, not by a role string.
   */
  allowedRoles?: UserRole[];
  /** Where to send a signed-out visitor. */
  loginPath?: string;
}

const ProtectedRoute = ({
  children,
  allowedRoles,
  loginPath = '/login',
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loader label="Checking your access…" />;
  }

  // Previously this returned `null`, which rendered a blank page and left the
  // visitor stranded with no error and no way forward. Redirect instead, and
  // carry the attempted location so sign-in can return them to it.
  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Signed in, but not one of the roles this route is for. Send them to their
  // own home rather than to the login screen — they are authenticated, so
  // asking them to sign in again would be nonsense.
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const home =
      user.role === 'coordinator' ? '/coordinator/dashboard'
      : user.role === 'admin' ? '/admin/dashboard'
      : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

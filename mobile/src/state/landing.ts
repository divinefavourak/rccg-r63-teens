import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { useAuth } from './auth';
import { useTeacherTools } from './teacher';

/**
 * Leaders open on their dashboard (November 2026, at a coordinator's request;
 * 05-navigation.md "Leaders land on their dashboard").
 *
 * Once per person per launch: signing in, or opening the app already signed
 * in, takes a teacher or coordinator from Today to the teacher tools. After
 * that the switch on the dashboard ("Faith Tribe") takes them to the teen side
 * and they stay there until the next launch or sign-in; the app does not keep
 * pulling them back.
 *
 * Held in memory, not stored: a fresh launch should land on the dashboard
 * again, whatever happened last time.
 */
let landedFor: string | null = null;

/**
 * The sign-in and sign-up screens. Someone browsing as a guest already has the
 * tabs mounted underneath, so at the moment they sign in the path is still one
 * of these; landing waits until they come back out to Today.
 */
const SIGNING_IN = ['/welcome', '/log-in', '/sign-up', '/verify', '/all-set', '/forgot-password', '/auth/google'];

export function useLeaderLanding() {
  const router = useRouter();
  const path = usePathname();
  const { isGuest, user } = useAuth();
  const tools = useTeacherTools();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isGuest || !userId || !tools.ready) return;
    if (landedFor === userId) return;
    if (SIGNING_IN.some((p) => path.startsWith(p))) return;
    landedFor = userId;
    // Only from Today. Opening the app from a notification goes where the
    // notification points, and that launch counts as landed.
    if (tools.any && path === '/') router.replace('/console');
  }, [isGuest, userId, tools.ready, tools.any, path, router]);
}

import { useCan, useIdentity } from '../api/queries';
import { PERM } from '../api/types';
import { useAuth } from './auth';

/**
 * Which teacher tools this person has.
 *
 * Each tool hangs off one permission and nothing else. A Teacher holds the
 * first three, a parish leader the same, a content editor only the last; none
 * of that is spelled out here, because roles are rows an admin can edit and a
 * role's name says nothing about what it can do (05-navigation.md). A tool the
 * person cannot use is not drawn at all: missing, never locked.
 */
export interface TeacherTools {
  /** False until permissions have loaded, so nothing flashes "not for you". */
  ready: boolean;
  /** At least one tool, so the entry on Me is worth showing. */
  any: boolean;
  /** This week's manual, with the teacher's notes. */
  lesson: boolean;
  /** The class list and each teen's read-only page. */
  roster: boolean;
  /** Checking people in at the door. */
  checkIn: boolean;
  /** The queue of devotionals waiting to be published. */
  review: boolean;
}

export function useTeacherTools(): TeacherTools {
  const { isGuest } = useAuth();
  const identity = useIdentity(!isGuest);

  const lesson = useCan(PERM.contentView, !isGuest);
  const roster = useCan(PERM.profilesView, !isGuest);
  const checkIn = useCan(PERM.eventsCheckin, !isGuest);
  const review = useCan(PERM.contentManage, !isGuest);

  return {
    ready: isGuest || !identity.isPending,
    any: lesson || roster || checkIn || review,
    lesson,
    roster,
    checkIn,
    review,
  };
}
